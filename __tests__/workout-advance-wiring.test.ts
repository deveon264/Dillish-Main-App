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
  const calls = { finish: 0, replay: [] as number[], restTicks: [] as number[], complete: 0 };
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
      onComplete: () => {
        calls.complete += 1;
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

// =========================================================================
// completeExercise outcome 1 (rest on, mid-workout): opens the rest countdown
// before the next exercise, seeding it from the configured rest gap.
// =========================================================================

test("completeExercise opens the rest gap (rest on, mid-workout)", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: true });

  act(() => h.result.current.completeExercise("timer"));

  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.result.current.restRemaining, 15);
  assert.equal(h.result.current.index, 0);
  assert.equal(h.calls.finish, 0);
  assert.equal(h.calls.complete, 1);
});

// =========================================================================
// completeExercise outcome 2 (rest off): advances straight to the next
// exercise, resetting the phase, index and per-exercise countdown, no rest.
// =========================================================================

test("completeExercise advances immediately when rest is off", () => {
  const h = renderHook({ total: 3, restGap: 0, paused: true });

  act(() => h.result.current.completeExercise("timer"));

  assert.equal(h.result.current.phase, "active");
  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.remaining, DURATIONS[1]);
  assert.equal(h.result.current.restRemaining, 0);
  assert.equal(h.calls.finish, 0);
  assert.equal(h.calls.complete, 1);
});

// =========================================================================
// completeExercise outcome 3 (last exercise): finishes the workout, firing the
// finish side effect once and landing on the done phase.
// =========================================================================

test("completeExercise on the last exercise finishes the workout", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: true });

  act(() => h.result.current.setIndex(2));
  act(() => h.result.current.completeExercise("timer"));

  assert.equal(h.result.current.phase, "done");
  assert.equal(h.calls.finish, 1);
  assert.equal(h.calls.complete, 1);
});

// =========================================================================
// The countdown-zero effect: an exercise with no playable video completes when
// its per-exercise countdown hits zero (the "timer" completion path).
// =========================================================================

test("the countdown reaching zero completes an exercise with no video", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: true });

  // No video mapped (default videoIdAt is undefined): the timer drives it.
  act(() => h.result.current.setRemaining(0));

  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.result.current.restRemaining, 15);
  assert.equal(h.calls.complete, 1);
});

// =========================================================================
// The countdown-zero effect bows out when a clip is loaded: with a playable
// video the "playToEnd" event (not the timer) drives the completion, so the
// countdown hitting zero must NOT complete the exercise on its own.
// =========================================================================

test("the countdown reaching zero does not complete when a clip is loaded", () => {
  let loadedId: string | null = "v0";
  const h = renderHook(
    { total: 3, restGap: 15, paused: true },
    {
      videoIdAt: (i) => ["v0", "v1", "v2"][i] ?? null,
      getLoadedVideoId: () => loadedId,
      videoDuration: 5,
    },
  );

  // Countdown exhausts while a clip is loaded: the timer effect bows out.
  act(() => h.result.current.setRemaining(0));
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.result.current.index, 0);
  assert.equal(h.calls.complete, 0);

  // The clip's "playToEnd" for the loaded current clip drives it instead.
  act(() => h.result.current.completeExercise("video"));
  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.calls.complete, 1);
});

// =========================================================================
// Double-fire guard: when the countdown and the clip both signal completion for
// the SAME exercise (e.g. the clip ends as the countdown hits zero), the
// exercise advances exactly once, never skipping the next exercise.
// =========================================================================

test("a timer and a video completion for the same exercise count once", () => {
  const h = renderHook(
    { total: 3, restGap: 0, paused: true },
    {
      videoIdAt: (i) => ["v0", "v1", "v2"][i] ?? null,
      getLoadedVideoId: () => "v0",
      videoDuration: 5,
    },
  );

  // Both signals fire before React flushes the advance: the second must be
  // dropped by the double-fire guard so the index moves by exactly one.
  act(() => {
    h.result.current.completeExercise("timer");
    h.result.current.completeExercise("video");
  });

  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.calls.complete, 1);
});

// =========================================================================
// Stale-clip guard: a "playToEnd" from an outgoing clip, fired mid-transition
// while the next exercise's clip is still loading (loadedVideoId is null), is
// dropped so it cannot complete (and skip) the exercise now showing.
// =========================================================================

test("a playToEnd from an outgoing clip during a load does not advance", () => {
  let loadedId: string | null = "v1";
  const h = renderHook(
    { total: 3, restGap: 15, paused: true },
    {
      videoIdAt: (i) => ["v0", "v1", "v2"][i] ?? null,
      getLoadedVideoId: () => loadedId,
      videoDuration: 5,
    },
  );

  // Mid-transition to exercise 1: the new clip has not confirmed-loaded yet.
  act(() => h.result.current.setIndex(1));
  loadedId = null;

  // A late "playToEnd" from the outgoing clip arrives: it must be ignored.
  act(() => h.result.current.completeExercise("video"));

  assert.equal(h.result.current.phase, "active");
  assert.equal(h.result.current.index, 1);
  assert.equal(h.calls.complete, 0);
  assert.equal(h.calls.finish, 0);
});

// =========================================================================
// Per-set playback: a mid-exercise set completion opens a SET rest, the rest
// countdown then starts the NEXT SET of the same exercise (onSetStart fires,
// index stays, remaining reseeds), and the exercise's LAST set hands over to
// the normal exercise rest/advance flow.
// =========================================================================

test("completing a mid-exercise set opens a set rest, then the next set of the SAME exercise starts", () => {
  const setStarts: Array<[number, number]> = [];
  const h = renderHook(
    { total: 3, restGap: 15, paused: true },
    { setsAt: () => 3, onSetStart: (i, s) => setStarts.push([i, s]) },
  );

  act(() => h.result.current.completeExercise("timer"));
  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.result.current.restKind, "set");
  assert.equal(h.result.current.restRemaining, 15);
  assert.equal(h.result.current.index, 0);
  assert.equal(h.calls.complete, 1);

  // "Start now" during a set rest starts the next set, not the next exercise.
  act(() => h.result.current.skipRest());
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.result.current.index, 0);
  assert.equal(h.result.current.currentSet, 1);
  assert.equal(h.result.current.remaining, DURATIONS[0]);
  assert.deepEqual(setStarts, [[0, 1]]);
});

test("the LAST set of an exercise opens an exercise rest and the advance resets currentSet", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: true }, { setsAt: () => 2 });

  // Set 1 of 2 -> set rest -> set 2.
  act(() => h.result.current.completeExercise("timer"));
  act(() => h.result.current.skipRest());
  assert.equal(h.result.current.currentSet, 1);

  // Set 2 of 2 -> exercise rest -> next exercise with currentSet back at 0.
  act(() => h.result.current.completeExercise("timer"));
  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.result.current.restKind, "exercise");
  act(() => h.result.current.skipRest());
  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.currentSet, 0);
  assert.equal(h.result.current.remaining, DURATIONS[1]);
});

test("rest off chains straight from set to set, and each set can complete once", () => {
  const setStarts: Array<[number, number]> = [];
  const h = renderHook(
    { total: 3, restGap: 0, paused: true },
    { setsAt: () => 3, onSetStart: (i, s) => setStarts.push([i, s]) },
  );

  act(() => h.result.current.completeExercise("timer"));
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.result.current.currentSet, 1);

  // A duplicate signal for the set that just completed is NOT ignored for the
  // new set: this is set 2 completing (new pair), so it advances to set 3.
  act(() => h.result.current.completeExercise("timer"));
  assert.equal(h.result.current.currentSet, 2);

  // Final set with rest off advances to the next exercise.
  act(() => h.result.current.completeExercise("timer"));
  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.currentSet, 0);
  assert.deepEqual(setStarts, [[0, 1], [0, 2]]);
});

test("jumpTo an earlier exercise resets currentSet to 0", () => {
  const h = renderHook({ total: 3, restGap: 0, paused: true }, { setsAt: () => 2 });

  // Finish both sets of exercise 0 to land on exercise 1.
  act(() => h.result.current.completeExercise("timer"));
  act(() => h.result.current.completeExercise("timer"));
  assert.equal(h.result.current.index, 1);

  // Move to set 2 of exercise 1, then jump back.
  act(() => h.result.current.completeExercise("timer"));
  assert.equal(h.result.current.currentSet, 1);
  act(() => h.result.current.jumpTo(0));
  assert.equal(h.result.current.index, 0);
  assert.equal(h.result.current.currentSet, 0);
  assert.equal(h.result.current.remaining, DURATIONS[0]);
});
