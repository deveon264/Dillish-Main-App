import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decidePlayPauseMirror,
  decideSeek,
} from "@/lib/workoutControls";

// This suite covers the workout player's playback-button logic: the play/pause
// "mirror" onto the real clip and the 15s forward/back seek-vs-countdown branch.
// Both live in the workout screen (app/workout/[id].tsx), which imports
// expo-video and so cannot run in node:test directly; the decisions are
// extracted into `@/lib/workoutControls` (the same pattern as
// `@/lib/workoutAdvance` / `@/lib/workoutClipLoader`) so they can be exercised
// here. The screen calls these exact helpers.

// ---- play/pause mirror ---------------------------------------------------

test("mirror pauses the loaded clip when the member pauses", () => {
  assert.equal(decidePlayPauseMirror({ hasVideo: true, paused: true }), "pause");
});

test("mirror plays the loaded clip when the member resumes", () => {
  assert.equal(decidePlayPauseMirror({ hasVideo: true, paused: false }), "play");
});

test("mirror is a no-op when the exercise has no clip (countdown only)", () => {
  assert.equal(decidePlayPauseMirror({ hasVideo: false, paused: true }), "none");
  assert.equal(decidePlayPauseMirror({ hasVideo: false, paused: false }), "none");
});

// ---- seek: a loaded clip is seeked, not the countdown --------------------

test("a loaded clip is seeked by the signed delta (forward)", () => {
  const d = decideSeek({
    hasVideo: true,
    videoDuration: 30,
    delta: 15,
    currentSeconds: 45,
    remaining: 45,
  });
  assert.deepEqual(d, { action: "seek", by: 15 });
});

test("a loaded clip is seeked by the signed delta (back)", () => {
  const d = decideSeek({
    hasVideo: true,
    videoDuration: 30,
    delta: -15,
    currentSeconds: 45,
    remaining: 10,
  });
  assert.deepEqual(d, { action: "seek", by: -15 });
});

test("a mapped video that has not loaded yet (duration ~0) falls through to the countdown", () => {
  const d = decideSeek({
    hasVideo: true,
    videoDuration: 0,
    delta: 15,
    currentSeconds: 45,
    remaining: 45,
  });
  // No playable clip yet, so the countdown is nudged instead of seeking.
  assert.deepEqual(d, { action: "countdown", remaining: 30 });
});

// ---- seek: no video nudges the simulated countdown ----------------------

test("forward seek with no video removes time from the countdown", () => {
  const d = decideSeek({
    hasVideo: false,
    videoDuration: 0,
    delta: 15,
    currentSeconds: 45,
    remaining: 45,
  });
  assert.deepEqual(d, { action: "countdown", remaining: 30 });
});

test("back seek with no video adds time to the countdown, clamped to the exercise length", () => {
  const d = decideSeek({
    hasVideo: false,
    videoDuration: 0,
    delta: -15,
    currentSeconds: 45,
    remaining: 40,
  });
  // 40 - (-15) = 55, clamped to the 45s exercise length.
  assert.deepEqual(d, { action: "countdown", remaining: 45 });
});

test("forward seek can't drive the countdown below zero", () => {
  const d = decideSeek({
    hasVideo: false,
    videoDuration: 0,
    delta: 15,
    currentSeconds: 45,
    remaining: 5,
  });
  assert.deepEqual(d, { action: "countdown", remaining: 0 });
});

test("the countdown clamp falls back to the live remaining when the exercise length is unknown", () => {
  const d = decideSeek({
    hasVideo: false,
    videoDuration: 0,
    delta: -15,
    currentSeconds: null,
    remaining: 20,
  });
  // 20 - (-15) = 35, clamped to the fallback max (remaining=20).
  assert.deepEqual(d, { action: "countdown", remaining: 20 });
});
