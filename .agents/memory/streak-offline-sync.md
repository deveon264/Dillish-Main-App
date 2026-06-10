---
name: Streak offline-to-online sync
description: Behavioral constraints + refactor gotchas for the device streak glue (local cache <-> /api/streak)
---

# Streak offline-to-online sync (device glue)

The streak sync logic lives in a deps-injectable hook so it can be tested with
react-test-renderer (no RN). It hydrates the AsyncStorage cache first, reconciles
against the server streak, then records today and pushes the local rolling window.

## Hydrate GET folds the local window into the server response (no longer clobbers)
**Rule:** on hydrate, when the server returns a non-null streak the device folds
its local `recentDays` into the server response via `mergeWindow` before saving,
so the union of both windows wins. Offline days now survive a cold start (full
quit + reopen) and reconcile up on the next push; recovery no longer depends on
the GET returning null or on staying in the foreground.
**Why:** the previous code blindly overwrote the local cache with the bare server
GET, dropping offline-recorded days before the record/push could read them, so a
cold start with a stale non-null server streak silently reset the streak lower.
**How to apply:** keep the merge in the hydrate path; the server count/frontier is
still authoritative, but the live union over the merged window carries the real
streak. Cold-start-after-offline is covered by a regression test in
`__tests__/streak-sync-device.test.ts`.

## Splitting the hydrate+record effect needs an internal `hydrated` gate
**Rule:** if you split the single hydrate effect into separate hydrate and
record effects, the record effect must gate on an internal `hydrated` flag set
*after* reconcile, not just the caller's external `ready`.
**Why:** the original single effect set `ready` only at the very end (after the
streak GET), so recording always saw the reconciled streak. With separate
effects, `ready` can flip before the hook finishes hydrating, so record races
the reconcile and records against a pre-reconcile (or default) streak.

## Do not rely on React eager-state-computation for a sync side-effect flag
**Rule:** the `let shouldSync=false; setState(prev => {shouldSync=true; ...});
if(!shouldSync) return;` pattern only works because React eagerly runs the
updater during dispatch when the fiber has no pending lanes. That is fragile and
fails when the update is dispatched while other updates are pending (e.g. record
fires in the same commit as hydrate settling) -> the push is silently skipped.
**How to apply:** read the latest state from a ref (`streakStateRef.current`,
synced every render + on each optimistic write) and decide synchronously. Same
observable behavior, deterministic under test.
