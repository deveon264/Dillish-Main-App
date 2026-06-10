import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

// Tell React this is a valid environment for act() so effects flush
// synchronously and no "not configured to support act(...)" warnings are logged.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act } from "react-test-renderer";

import {
  useWorkoutAdvanceCore,
  type WorkoutAdvanceCore,
  type WorkoutAdvanceDeps,
} from "@/hooks/useWorkoutAdvanceCore";

// A three-exercise workout. durationAt(i) returns these; the hook seeds
// `remaining` from index 0 and resets it to durationAt(next) on each advance.
const DURATIONS = [30, 40, 50];

type Props = { total: number; restGap: number; paused: boolean };

// Renders the hook (a function component returning null), exposes its latest
// return value, records the injected side effects (finish / replay / rest tick),
// and drives the reactive inputs (paused / total / restGap) through act() so the
// rest-countdown effect re-runs exactly as it does on device.
function renderHook(initial: Props, overrides: Partial<WorkoutAdvanceDeps> = {}) {
  const result: { current: WorkoutAdvanceCore } = { current: {} as WorkoutAdvanceCore };
  const calls = { finish: 0, replay: [] as number[], restTicks: [] as number[] };
  let props = { ...initial };

  function Harness(p: Props) {
    result.current = useWorkoutAdvanceCore({
      total: p.total,
      restGap: p.restGap,
      paused: p.paused,
      durationAt: (i) => DURATIONS[i] ?? 0,
      initialRemaining: DURATIONS[0],
      onFinish: () => {
        calls.finish += 1;
      },
      onReplay: (i) => {
        calls.replay.push(i);
      },
      onRestTick: (rr) => {
        calls.restTicks.push(rr);
      },
      ...overrides,
    });
    return null;
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Harness, props));
  });

  return {
    result,
    calls,
    update(next: Partial<Props>) {
      props = { ...props, ...next };
      act(() => renderer.update(createElement(Harness, props)));
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

// =========================================================================
// goNext: a mid-workout advance steps to the next exercise and resets the
// phase, the per-exercise countdown and the leftover rest countdown.
// =========================================================================

test("goNext steps to the next exercise and resets phase/remaining/restRemaining", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: true });

  // Leave a stale rest countdown behind (paused, so the rest effect stays idle).
  act(() => h.result.current.setRestRemaining(7));
  assert.equal(h.result.current.restRemaining, 7);

  act(() => h.result.current.goNext());
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.remaining, DURATIONS[1]);
  assert.equal(h.result.current.restRemaining, 0);
  assert.equal(h.calls.finish, 0);
});

// =========================================================================
// goNext on the final exercise finishes the workout: the finish side effects
// fire exactly once and the phase lands on "done".
// =========================================================================

test("goNext on the final exercise finishes (onFinish once, phase done)", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: true });

  act(() => h.result.current.setIndex(2));
  act(() => h.result.current.goNext());

  assert.equal(h.result.current.phase, "done");
  assert.equal(h.calls.finish, 1);
});

// =========================================================================
// The rest-countdown effect -> goNext wiring: a rest countdown at zero (and not
// paused) auto-advances to the next exercise's active phase.
// =========================================================================

test("a rest countdown reaching zero auto-advances to the next active exercise", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: false });

  // Enter the rest phase with the countdown exhausted: the effect must advance.
  act(() => {
    h.result.current.setPhase("rest");
    h.result.current.setRestRemaining(0);
  });

  assert.equal(h.result.current.phase, "active");
  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.remaining, DURATIONS[1]);
  assert.equal(h.result.current.restRemaining, 0);
  assert.equal(h.calls.finish, 0);
});

// =========================================================================
// The same wiring on the final exercise finishes the workout instead of
// advancing (rest -> done).
// =========================================================================

test("a rest countdown after the final exercise finishes the workout", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: false });

  act(() => h.result.current.setIndex(2));
  act(() => {
    h.result.current.setPhase("rest");
    h.result.current.setRestRemaining(0);
  });

  assert.equal(h.result.current.phase, "done");
  assert.equal(h.calls.finish, 1);
});

// =========================================================================
// A paused rest countdown freezes: no auto-advance, even at zero.
// =========================================================================

test("a paused rest countdown does not auto-advance", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: true });

  act(() => {
    h.result.current.setPhase("rest");
    h.result.current.setRestRemaining(0);
  });

  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.result.current.index, 0);
  assert.equal(h.calls.finish, 0);
});

// =========================================================================
// The rest countdown ticks down one second per render-tick, firing the rest
// haptic hook each second, then auto-advances when it hits zero.
// =========================================================================

test("the rest countdown ticks down one second at a time, then advances", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const h = renderHook({ total: 3, restGap: 15, paused: false });

    act(() => {
      h.result.current.setPhase("rest");
      h.result.current.setRestRemaining(2);
    });
    assert.equal(h.result.current.restRemaining, 2);

    // One second elapses: the tick fires with 2 left, then the countdown is 1.
    act(() => {
      mock.timers.tick(1000);
    });
    assert.equal(h.result.current.restRemaining, 1);
    assert.deepEqual(h.calls.restTicks, [2]);

    // The next second drops it to 0, and the effect immediately advances.
    act(() => {
      mock.timers.tick(1000);
    });
    assert.deepEqual(h.calls.restTicks, [2, 1]);
    assert.equal(h.result.current.phase, "active");
    assert.equal(h.result.current.index, 1);
    assert.equal(h.result.current.restRemaining, 0);
  } finally {
    mock.timers.reset();
  }
});

// =========================================================================
// jumpTo (replay): tapping an earlier exercise jumps back to it, resetting the
// phase, index, per-exercise countdown and rest countdown, and fires onReplay.
// =========================================================================

test("jumpTo replays an earlier exercise and resets phase/index/remaining/rest", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: true });

  // Move to the last exercise mid-rest with stale countdowns (paused = idle).
  act(() => {
    h.result.current.setIndex(2);
    h.result.current.setRemaining(5);
    h.result.current.setRestRemaining(9);
    h.result.current.setPhase("rest");
  });

  act(() => h.result.current.jumpTo(0));
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.result.current.index, 0);
  assert.equal(h.result.current.remaining, DURATIONS[0]);
  assert.equal(h.result.current.restRemaining, 0);
  assert.deepEqual(h.calls.replay, [0]);
});

// =========================================================================
// jumpTo ignores a tap on the current or a later exercise (no skipping ahead,
// no needless restart): state is untouched and onReplay never fires.
// =========================================================================

test("jumpTo ignores the current and later exercises", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: true });

  act(() => h.result.current.setIndex(1));
  act(() => h.result.current.jumpTo(1)); // current
  act(() => h.result.current.jumpTo(2)); // later

  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.phase, "active");
  assert.deepEqual(h.calls.replay, []);
});
