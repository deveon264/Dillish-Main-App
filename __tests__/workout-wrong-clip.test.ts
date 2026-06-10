import { test, mock } from "node:test";
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

// This suite stress-tests the one contract that keeps a member who taps through
// exercises quickly (or whose clip fires "playToEnd" just as the exercise
// changes) from ever advancing on the WRONG clip. Two guards must hold across
// every switching path:
//   - the screen-level monotonic load token (modelled here as `loadedVideoId`
//     being reset to null at the start of every clip load), and
//   - `decideExerciseCompletion`, which drops any "video" signal whose clip id
//     does not match the exercise now showing.
// The existing suites cover the basic stale-clip case; this one walks the full
// set of plausible switches (advance, rapid sequential, jump-back, video ->
// no-video) and asserts a stale clip end never completes the wrong exercise.

// =========================================================================
// (1) Pure-logic cases: decideExerciseCompletion drops mismatched/mid-load
// video signals straight from a state snapshot.
// =========================================================================

// A mid-workout snapshot: on exercise 0 of a 3-exercise workout, nothing
// completed yet, rest gap on, no video involved. Override per case.
function input(over: Partial<CompletionInput> = {}): CompletionInput {
  return {
    phase: "active",
    hasCurrent: true,
    source: "timer",
    currentVideoId: null,
    loadedVideoId: null,
    completedIndex: -1,
    index: 0,
    total: 3,
    restGap: 15,
    ...over,
  };
}

test("wrong clip: after advancing, the outgoing clip's id still loaded but the current id has moved on is ignored", () => {
  // We advanced to exercise 1 (its clip is vid-B). The outgoing clip vid-A is
  // still what `loadedVideoId` reports, so its late playToEnd must be dropped:
  // the loaded id no longer matches the exercise now showing.
  const d = decideExerciseCompletion(
    input({ source: "video", index: 1, currentVideoId: "vid-B", loadedVideoId: "vid-A" }),
  );
  assert.equal(d.action, "ignore");
  assert.equal(d.completedIndex, null);
});

test("wrong clip: switching from a video exercise to a no-video one drops a lingering video signal", () => {
  // The new exercise has no video (currentVideoId null). A leftover playToEnd
  // from the previous clip must be ignored regardless of what loadedVideoId
  // still holds.
  const d = decideExerciseCompletion(
    input({ source: "video", index: 1, currentVideoId: null, loadedVideoId: "vid-A" }),
  );
  assert.equal(d.action, "ignore");
  assert.equal(d.completedIndex, null);
});

test("wrong clip: a mid-load state (loaded id null) with a real current id drops the video signal", () => {
  // The next exercise's clip (vid-B) has not confirmed-loaded yet, so
  // loadedVideoId is still null. A playToEnd arriving in this window has not
  // been proven to belong to the current exercise and is ignored.
  const d = decideExerciseCompletion(
    input({ source: "video", index: 1, currentVideoId: "vid-B", loadedVideoId: null }),
  );
  assert.equal(d.action, "ignore");
  assert.equal(d.completedIndex, null);
});

// =========================================================================
// (2) Hook-wiring cases: the same guard wired through useWorkoutAdvanceCore,
// driving real index/phase transitions across every switching path.
// =========================================================================

// A three-exercise workout. durationAt(i) returns these; the hook seeds
// `remaining` from index 0 and resets it to durationAt(next) on each advance.
const DURATIONS = [30, 40, 50];

type Props = { total: number; restGap: number; paused: boolean };

// Renders the hook (a function component returning null), exposes its latest
// return value, records the injected side effects, and lets a test mutate the
// closed-over `loadedId` to simulate the screen's load token being reset to
// null at the start of each clip load.
function renderHook(
  initial: Props,
  overrides: Partial<WorkoutAdvanceDeps> = {},
) {
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

// A clip-mapped workout whose loaded id the test controls. `setLoaded` mutates
// the value `getLoadedVideoId` returns, modelling the screen nulling its load
// token at the start of every clip switch.
function renderClipHook(initial: Props) {
  let loadedId: string | null = "v0";
  const h = renderHook(initial, {
    videoIdAt: (i) => ["v0", "v1", "v2"][i] ?? null,
    getLoadedVideoId: () => loadedId,
    videoDuration: 5,
  });
  return {
    ...h,
    setLoaded(id: string | null) {
      loadedId = id;
    },
  };
}

// --- goNext then a stale playToEnd ----------------------------------------

test("goNext then a stale playToEnd is ignored and the index stays put", () => {
  const h = renderClipHook({ total: 3, restGap: 15, paused: true });

  // Advance from exercise 0 to exercise 1.
  act(() => h.result.current.goNext());
  assert.equal(h.result.current.index, 1);

  // The next clip has not confirmed-loaded yet (the load token is null). A late
  // playToEnd from exercise 0's outgoing clip arrives: it must be dropped.
  h.setLoaded(null);
  act(() => h.result.current.completeExercise("video"));

  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.calls.complete, 0);
  assert.equal(h.calls.finish, 0);
});

// --- rapid sequential switches --------------------------------------------

test("rapid sequential switches: stale video ends for earlier clips never push past the current exercise", () => {
  const h = renderClipHook({ total: 3, restGap: 15, paused: true });

  // 0 -> 1: enter the load window, then a stale end for exercise 0 fires.
  act(() => h.result.current.goNext());
  h.setLoaded(null);
  act(() => h.result.current.completeExercise("video"));
  assert.equal(h.result.current.index, 1);
  assert.equal(h.calls.complete, 0);

  // 1 -> 2: enter the load window, then a stale end for exercise 1 fires.
  act(() => h.result.current.goNext());
  h.setLoaded(null);
  act(() => h.result.current.completeExercise("video"));

  // Neither stale signal moved the workout past exercise 2.
  assert.equal(h.result.current.index, 2);
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.calls.complete, 0);
  assert.equal(h.calls.finish, 0);
});

// --- jumpTo then a stale playToEnd ----------------------------------------

test("jumpTo back then a stale playToEnd from the later clip does not re-complete the replayed exercise", () => {
  const h = renderClipHook({ total: 3, restGap: 15, paused: true });

  // Move to the last exercise, then jump back to exercise 0 to replay it.
  act(() => h.result.current.setIndex(2));
  act(() => h.result.current.jumpTo(0));
  assert.equal(h.result.current.index, 0);
  assert.deepEqual(h.calls.replay, [0]);

  // Exercise 0's clip is still loading after the jump (load token null). A stale
  // playToEnd from exercise 2's clip arrives: it must not complete exercise 0.
  h.setLoaded(null);
  act(() => h.result.current.completeExercise("video"));

  assert.equal(h.result.current.index, 0);
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.calls.complete, 0);
  assert.equal(h.calls.finish, 0);
});

// --- jumpTo resets the completion guard -----------------------------------

test("jumpTo resets the completion guard so a replayed exercise can complete again", () => {
  const h = renderHook({ total: 3, restGap: 15, paused: true });

  // Exercise 0 completes once (no video, so the timer path), opening rest.
  act(() => h.result.current.completeExercise("timer"));
  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.calls.complete, 1);

  // Move on to exercise 1, then jump back to replay exercise 0.
  act(() => h.result.current.goNext());
  assert.equal(h.result.current.index, 1);
  act(() => h.result.current.jumpTo(0));
  assert.equal(h.result.current.index, 0);
  assert.deepEqual(h.calls.replay, [0]);

  // The completion guard reset on the index change, so the replayed exercise 0
  // can complete a second time rather than being dropped as a duplicate.
  act(() => h.result.current.completeExercise("timer"));
  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.result.current.restRemaining, 15);
  assert.equal(h.calls.complete, 2);
});

// --- video -> no-video switch ---------------------------------------------

test("video-to-no-video switch: a stale video end is ignored and the timer drives the no-video exercise", () => {
  let loadedId: string | null = "v0";
  // Only exercise 0 has a clip; exercise 1 has no video.
  const h = renderHook(
    { total: 3, restGap: 15, paused: true },
    {
      videoIdAt: (i) => (i === 0 ? "v0" : null),
      getLoadedVideoId: () => loadedId,
      videoDuration: 5,
    },
  );

  // Advance from the video exercise 0 to the no-video exercise 1.
  act(() => h.result.current.goNext());
  assert.equal(h.result.current.index, 1);

  // A stale playToEnd from exercise 0's clip arrives. Exercise 1 has no video,
  // so the signal is dropped regardless of the lingering load token.
  loadedId = "v0";
  act(() => h.result.current.completeExercise("video"));
  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.calls.complete, 0);

  // The countdown reaching zero is what completes a no-video exercise: it opens
  // the rest gap as normal.
  act(() => h.result.current.setRemaining(0));
  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.result.current.restRemaining, 15);
  assert.equal(h.result.current.index, 1);
  assert.equal(h.calls.complete, 1);
});
