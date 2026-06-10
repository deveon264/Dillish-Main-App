import { test } from "node:test";
import assert from "node:assert/strict";

import { decideExerciseCompletion, type CompletionInput } from "@/lib/workoutAdvance";

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

// --- (1) the countdown reaching zero advances exactly once ----------------

test("countdown: a timer completion opens the rest gap and marks the exercise done", () => {
  const d = decideExerciseCompletion(input({ source: "timer" }));
  assert.equal(d.action, "rest");
  assert.equal(d.completedIndex, 0);
});

test("countdown: a second timer signal for the same exercise is ignored (no double-count)", () => {
  // First tick marked index 0 done; the guard now holds 0.
  const second = decideExerciseCompletion(input({ source: "timer", completedIndex: 0 }));
  assert.equal(second.action, "ignore");
  assert.equal(second.completedIndex, null);
});

test("countdown: with rest off, the timer advances straight to the next exercise", () => {
  const d = decideExerciseCompletion(input({ source: "timer", restGap: 0 }));
  assert.equal(d.action, "advance");
  assert.equal(d.completedIndex, 0);
});

test("countdown: the final exercise finishes the workout instead of advancing", () => {
  const d = decideExerciseCompletion(input({ source: "timer", index: 2, total: 3 }));
  assert.equal(d.action, "finish");
  assert.equal(d.completedIndex, 2);
});

// --- (2) a video "play to end" advances the same exercise only once --------

test("video: a playToEnd for the loaded current clip advances once", () => {
  const d = decideExerciseCompletion(
    input({ source: "video", currentVideoId: "vid-A", loadedVideoId: "vid-A" }),
  );
  assert.equal(d.action, "rest");
  assert.equal(d.completedIndex, 0);
});

test("video then countdown: once the clip completes, a same-exercise timer is ignored", () => {
  // The clip ended and marked index 0 done.
  const fromVideo = decideExerciseCompletion(
    input({ source: "video", currentVideoId: "vid-A", loadedVideoId: "vid-A" }),
  );
  assert.equal(fromVideo.action, "rest");
  assert.equal(fromVideo.completedIndex, 0);
  // The countdown then hits zero for the SAME exercise: it must not fire again.
  const fromTimer = decideExerciseCompletion(
    input({ source: "timer", currentVideoId: "vid-A", loadedVideoId: "vid-A", completedIndex: 0 }),
  );
  assert.equal(fromTimer.action, "ignore");
  assert.equal(fromTimer.completedIndex, null);
});

// --- (3) a stale video-end from an outgoing clip does NOT advance ----------

test("stale video: a playToEnd while the next clip is still loading is ignored", () => {
  // We have advanced to exercise 1 (its video is vid-B) but vid-B has not
  // finished loading yet, so loadedVideoId is still null. A late playToEnd
  // from the outgoing clip must not advance exercise 1.
  const d = decideExerciseCompletion(
    input({ source: "video", index: 1, currentVideoId: "vid-B", loadedVideoId: null }),
  );
  assert.equal(d.action, "ignore");
  assert.equal(d.completedIndex, null);
});

test("stale video: a playToEnd whose clip id no longer matches the current exercise is ignored", () => {
  // The outgoing clip vid-A fires playToEnd after exercise 1 (vid-B) has loaded.
  const d = decideExerciseCompletion(
    input({ source: "video", index: 1, currentVideoId: "vid-B", loadedVideoId: "vid-A" }),
  );
  assert.equal(d.action, "ignore");
  assert.equal(d.completedIndex, null);
});

test("video: a playToEnd on an exercise that has no video is ignored", () => {
  const d = decideExerciseCompletion(
    input({ source: "video", currentVideoId: null, loadedVideoId: null }),
  );
  assert.equal(d.action, "ignore");
  assert.equal(d.completedIndex, null);
});

// --- guards independent of the source -------------------------------------

test("a completion outside the active phase is ignored", () => {
  assert.equal(decideExerciseCompletion(input({ phase: "rest" })).action, "ignore");
  assert.equal(decideExerciseCompletion(input({ phase: "done" })).action, "ignore");
});

test("a completion with no current exercise is ignored", () => {
  const d = decideExerciseCompletion(input({ hasCurrent: false }));
  assert.equal(d.action, "ignore");
  assert.equal(d.completedIndex, null);
});

test("a timer is unaffected by the loaded-clip guard (only video completions check it)", () => {
  // A no-video exercise has currentVideoId null / loadedVideoId null, but a
  // timer completion must still advance: the clip check is video-only.
  const d = decideExerciseCompletion(
    input({ source: "timer", currentVideoId: null, loadedVideoId: null, restGap: 0 }),
  );
  assert.equal(d.action, "advance");
  assert.equal(d.completedIndex, 0);
});
