---
name: Streak offline-to-online sync
description: Behavioral constraints + refactor gotchas for the device streak glue (local cache <-> /api/streak)
---

# Streak offline-to-online sync (device glue)

The streak sync logic lives in a deps-injectable hook so it can be tested with
react-test-renderer (no RN). It hydrates the AsyncStorage cache first, reconciles
against the server streak, then records today and pushes the local rolling window.

## Offline-gap recovery only works when the GET does NOT clobber local
**Rule:** offline days survive and reconcile *only* via the POST carrying the
local `recentDays` window. The hydrate GET overwrites the local cache with the
bare server response. So if a (stale) non-null server streak comes back on a
fresh hydrate, the local offline window is lost *before* the record/push reads it.
**Why:** server is treated as source of truth on GET; it does not merge local in.
**How to apply:** real recovery happens when GET returns null (server has no
streak yet) OR via the foreground re-record path within a live session (no
intervening GET). Don't write a test asserting offline-gap recovery with a
non-null server GET, it contradicts the real flow.

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
