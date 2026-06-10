import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import {
  decideExerciseCompletion,
  type CompletionInput,
} from "@/lib/workoutAdvance";

// Tell React this is a valid environment for act() so effects flush
// synchronously and no "not configured to support act(...)" warnings are logged.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act } from "react-test-renderer";

import {
  useWorkoutAdvanceCore,
  type WorkoutAdvanceCore,
  type WorkoutAdvanceDeps,
} from "@/hooks/useWorkoutAdvanceCore";

// The screen wires expo-video's "playToEnd" event to the completion machine via
//   useEventListener(player, "playToEnd", () => onVideoEndRef.current());
//   onVideoEndRef.current = () => completeExercise("video");
// so when a clip reaches its end the exercise completes from the REAL video
// (not the per-exercise countdown). That is the path that ends an exercise once
// its demo finishes playing. This suite locks in what a "video finished" signal
// does at the end of the line: enter the rest gap, auto-advance, or finish the
// workout, and that the downstream rest countdown still respects paused. The
// decision itself is server-safe (`decideExerciseCompletion`) and the wiring is
// the deps-injectable `useWorkoutAdvanceCore`, so both test without a renderer.

// =========================================================================
// (1) Pure-logic outcomes: a "video" completion of the CURRENT loaded clip
// resolves to rest / advance / finish straight from a state snapshot.
// =========================================================================

// A mid-workout snapshot: on exercise 0 of a 3-exercise workout, nothing
// completed yet, and the clip that just ended ("v0") is the one confirmed-loaded
// for the current exercise. Override per case.
function videoEnd(over: Partial<CompletionInput> = {}): CompletionInput {
  return {
    phase: "active",
    hasCurrent: true,
    source: "video",
    currentVideoId: "v0",
    loadedVideoId: "v0",
    completedIndex: -1,
    index: 0,
    total: 3,
    restGap: 15,
    ...over,
  };
}

test("video finished mid-workout (rest on) opens the rest gap", () => {
  const d = decideExerciseCompletion(videoEnd());
  assert.equal(d.action, "rest");
  assert.equal(d.completedIndex, 0);
});

test("video finished (rest off) advances straight to the next exercise", () => {
  const d = decideExerciseCompletion(videoEnd({ restGap: 0 }));
  assert.equal(d.action, "advance");
  assert.equal(d.completedIndex, 0);
});

test("video finished on the last exercise finishes the workout", () => {
  const d = decideExerciseCompletion(
    videoEnd({ index: 2, currentVideoId: "v2", loadedVideoId: "v2" }),
  );
  assert.equal(d.action, "finish");
  assert.equal(d.completedIndex, 2);
});

// =========================================================================
// (2) Hook wiring: the same outcomes driven through useWorkoutAdvanceCore via
// completeExercise("video") (exactly what onVideoEndRef.current bridges to).
// =========================================================================

// A three-exercise workout, each with its own clip. durationAt(i) returns these;
// the hook seeds `remaining` from index 0 and resets it on each advance.
const DURATIONS = [30, 40, 50];
const VIDEO_IDS = ["v0", "v1", "v2"];

type Props = { total: number; restGap: number; paused: boolean };

// Renders the hook (a function component returning null), exposes its latest
// return value, records the injected side effects, and lets a test mutate the
// closed-over `loadedId` to model the screen's load token. `getLoadedVideoId`
// reports the clip confirmed-loaded for the exercise now showing, which a
// "video" completion is judged against.
function renderVideoHook(initial: Props) {
  const result: { current: WorkoutAdvanceCore } = { current: {} as WorkoutAdvanceCore };
  const calls = { finish: 0, replay: [] as number[], restTicks: [] as number[], complete: 0 };
  let props = { ...initial };
  // Start with exercise 0's clip confirmed-loaded.
  let loadedId: string | null = "v0";

  function Harness(p: Props) {
    const deps: WorkoutAdvanceDeps = {
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
      videoIdAt: (i) => VIDEO_IDS[i] ?? null,
      getLoadedVideoId: () => loadedId,
      videoDuration: 5,
    };
    result.current = useWorkoutAdvanceCore(deps);
    return null;
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Harness, props));
  });

  return {
    result,
    calls,
    // Model the screen confirming a new clip as loaded for the current exercise.
    setLoaded(id: string | null) {
      loadedId = id;
    },
    update(next: Partial<Props>) {
      props = { ...props, ...next };
      act(() => renderer.update(createElement(Harness, props)));
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

test("a clip ending mid-workout (rest on) opens the rest countdown", () => {
  const h = renderVideoHook({ total: 3, restGap: 15, paused: true });

  act(() => h.result.current.completeExercise("video"));

  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.result.current.restRemaining, 15);
  assert.equal(h.result.current.index, 0);
  assert.equal(h.calls.finish, 0);
  assert.equal(h.calls.complete, 1);
});

test("a clip ending with rest off auto-advances to the next active exercise", () => {
  const h = renderVideoHook({ total: 3, restGap: 0, paused: true });
  // Confirm exercise 1's clip will be loaded after the advance so a follow-up
  // end would be judged against the right id (not needed for this assertion,
  // but mirrors the screen's load sequence).
  act(() => h.result.current.completeExercise("video"));

  assert.equal(h.result.current.phase, "active");
  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.remaining, DURATIONS[1]);
  assert.equal(h.result.current.restRemaining, 0);
  assert.equal(h.calls.finish, 0);
  assert.equal(h.calls.complete, 1);
});

test("a clip ending on the last exercise finishes the workout", () => {
  const h = renderVideoHook({ total: 3, restGap: 15, paused: true });

  // Move to the final exercise and confirm its clip as loaded.
  act(() => h.result.current.setIndex(2));
  h.setLoaded("v2");

  act(() => h.result.current.completeExercise("video"));

  assert.equal(h.result.current.phase, "done");
  assert.equal(h.calls.finish, 1);
  assert.equal(h.calls.complete, 1);
});

// =========================================================================
// The rest gap opened by a clip end still respects paused: the countdown
// freezes while paused and auto-advances once play resumes.
// =========================================================================

test("the rest gap after a clip end freezes while paused, then advances on resume", () => {
  const h = renderVideoHook({ total: 3, restGap: 15, paused: true });

  // A clip ends mid-workout: the rest countdown opens.
  act(() => h.result.current.completeExercise("video"));
  assert.equal(h.result.current.phase, "rest");

  // Drain the countdown to zero while still paused: the rest effect stays idle,
  // so the workout does NOT advance off the rest screen.
  act(() => h.result.current.setRestRemaining(0));
  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.result.current.index, 0);

  // Resuming play lets the exhausted countdown auto-advance to the next
  // exercise, confirming exercise 1's clip as loaded as the screen would.
  h.setLoaded("v1");
  act(() => h.update({ paused: false }));
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.restRemaining, 0);
  assert.equal(h.calls.finish, 0);
});
