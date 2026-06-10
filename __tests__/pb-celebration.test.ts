import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

// Tell React this is a valid environment for act() so effects flush
// synchronously and no "not configured to support act(...)" warnings are logged.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act } from "react-test-renderer";

import {
  usePbCelebrationCore,
  type PbCelebrationCore,
  type PbCelebrationDeps,
} from "@/hooks/usePbCelebrationCore";
import { DEFAULT_PB_CELEBRATION, type PbCelebration } from "@/lib/streak";

const TODAY = "2026-06-10";
const UID = "u1";

// A fresh device's storage holds the unseeded default until the first baseline.
const FRESH: PbCelebration = DEFAULT_PB_CELEBRATION;

// Records every persist call so a test can assert exactly when (and what) the
// celebration logic writes back to the streak_pb cache. `today` is pinned so the
// "fires today" / "same day" assertions are deterministic.
function makeDeps() {
  const writes: { uid: string; rec: PbCelebration }[] = [];
  const deps: PbCelebrationDeps = {
    persist: (uid, rec) => writes.push({ uid, rec }),
    today: () => TODAY,
  };
  return { deps, writes };
}

// Renders the hook (a function component returning null) and exposes its latest
// return value plus a setter for the reactive inputs (uid / ready / streakBest),
// each update driven through act() so effects flush. `deps` is stable across
// updates so the stamping effect only re-runs when streakBest actually changes.
function renderHook(deps: PbCelebrationDeps, initial: { uid: string | null; ready: boolean; streakBest: number }) {
  const result: { current: PbCelebrationCore } = { current: {} as PbCelebrationCore };
  let props = { ...initial };

  function Harness(p: { uid: string | null; ready: boolean; streakBest: number }) {
    result.current = usePbCelebrationCore({ ...p, deps });
    return null;
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Harness, props));
  });

  return {
    result,
    update(next: Partial<typeof props>) {
      props = { ...props, ...next };
      act(() => renderer.update(createElement(Harness, props)));
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

// =========================================================================
// First load with an existing best baselines silently: the record is stamped
// with day "" so nothing is celebrated, and once `ready` flips with the best
// unchanged the stamping effect leaves it alone.
// =========================================================================

test("baselines an existing best silently and never celebrates it", () => {
  const { deps, writes } = makeDeps();
  const h = renderHook(deps, { uid: UID, ready: false, streakBest: 0 });

  // Hydrate as the data context does: a fresh device record + the pre-today best.
  act(() => h.result.current.hydratePb(FRESH, 5));
  assert.deepEqual(h.result.current.pbCelebration, { value: 5, day: "" });
  assert.equal(h.result.current.newBestToday, null);
  // The silent baseline is written back once.
  assert.deepEqual(writes, [{ uid: UID, rec: { value: 5, day: "" } }]);

  // App becomes ready with the displayed best equal to the baseline: no stamp.
  h.update({ ready: true, streakBest: 5 });
  assert.deepEqual(h.result.current.pbCelebration, { value: 5, day: "" });
  assert.equal(h.result.current.newBestToday, null);
  assert.equal(writes.length, 1);
});

// =========================================================================
// A record beaten today fires exactly once, and reopening the app the same day
// (a fresh mount that loads the already-stamped record) does not re-fire.
// =========================================================================

test("a record beaten today fires once and does not re-fire on reopen", () => {
  const { deps, writes } = makeDeps();
  const h = renderHook(deps, { uid: UID, ready: false, streakBest: 0 });

  act(() => h.result.current.hydratePb(FRESH, 5));
  h.update({ ready: true, streakBest: 5 });
  assert.equal(h.result.current.newBestToday, null);
  writes.length = 0;

  // The streak climbs past the best during the session: stamp today, once.
  h.update({ streakBest: 6 });
  assert.deepEqual(h.result.current.pbCelebration, { value: 6, day: TODAY });
  assert.equal(h.result.current.newBestToday, 6);
  assert.deepEqual(writes, [{ uid: UID, rec: { value: 6, day: TODAY } }]);

  // A re-render with the same best does not stamp again (one stamp per value).
  h.update({ streakBest: 6 });
  assert.equal(writes.length, 1);

  // Reopening the app the same day: a fresh mount that loads the stamped record.
  const reopen = makeDeps();
  const h2 = renderHook(reopen.deps, { uid: UID, ready: false, streakBest: 0 });
  act(() => h2.result.current.hydratePb({ value: 6, day: TODAY }, 6));
  h2.update({ ready: true, streakBest: 6 });
  // Still shows today's celebration, but nothing is re-stamped or re-written.
  assert.deepEqual(h2.result.current.pbCelebration, { value: 6, day: TODAY });
  assert.deepEqual(reopen.writes, []);
});

// =========================================================================
// A streak that breaks and rebuilds below the all-time best never fires: the
// displayed best can't drop, so it never climbs past the baselined value.
// =========================================================================

test("a streak rebuilding below the all-time best does not fire", () => {
  const { deps, writes } = makeDeps();
  const h = renderHook(deps, { uid: UID, ready: false, streakBest: 0 });

  // Established best of 10 (set on some earlier day), baselined silently.
  act(() => h.result.current.hydratePb(FRESH, 10));
  h.update({ ready: true, streakBest: 10 });
  writes.length = 0;

  // The live streak broke and is rebuilding (say 3 days), but displayBest keeps
  // the best at 10, so the input the hook sees never drops below 10.
  h.update({ streakBest: 10 });
  assert.equal(h.result.current.newBestToday, null);
  assert.deepEqual(h.result.current.pbCelebration, { value: 10, day: "" });
  assert.deepEqual(writes, []);
});

// =========================================================================
// New-device case: a member with an established best loads on a fresh device
// (no local record). They are re-baselined silently rather than re-congratulated
// for a record they already hold.
// =========================================================================

test("a fresh device re-baselines an established best silently", () => {
  const { deps, writes } = makeDeps();
  const h = renderHook(deps, { uid: UID, ready: false, streakBest: 0 });

  // Fresh device: storage default, but the server streak carries a best of 8.
  act(() => h.result.current.hydratePb(FRESH, 8));
  h.update({ ready: true, streakBest: 8 });

  // Silently baselined at 8 (day ""), never celebrated.
  assert.deepEqual(h.result.current.pbCelebration, { value: 8, day: "" });
  assert.equal(h.result.current.newBestToday, null);
  assert.deepEqual(writes, [{ uid: UID, rec: { value: 8, day: "" } }]);
});

// =========================================================================
// Signing out clears the record back to the unseeded default so the next member
// starts from a clean baseline (and is not handed the previous member's best).
// =========================================================================

test("resetPb clears the record on sign-out", () => {
  const { deps } = makeDeps();
  const h = renderHook(deps, { uid: UID, ready: false, streakBest: 0 });

  act(() => h.result.current.hydratePb({ value: 6, day: TODAY }, 6));
  assert.deepEqual(h.result.current.pbCelebration, { value: 6, day: TODAY });

  act(() => h.result.current.resetPb());
  assert.deepEqual(h.result.current.pbCelebration, DEFAULT_PB_CELEBRATION);
  assert.equal(h.result.current.newBestToday, null);
});
