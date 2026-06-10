import { test } from "node:test";
import assert from "node:assert/strict";

import { nextVideoTime, acceptedVideoDuration } from "@/lib/workoutProgress";

// --- "timeUpdate" -> videoTime --------------------------------------------

test("timeUpdate: a normal event commits its currentTime", () => {
  assert.equal(nextVideoTime({ currentTime: 8.5 }), 8.5);
  assert.equal(nextVideoTime({ currentTime: 0 }), 0);
});

test("timeUpdate: a missing currentTime falls back to 0", () => {
  // The bar must never track an undefined position.
  assert.equal(nextVideoTime({}), 0);
  assert.equal(nextVideoTime(undefined), 0);
  assert.equal(nextVideoTime(null), 0);
});

// --- "statusChange" -> videoDuration --------------------------------------

test("statusChange: ready with a good duration commits it", () => {
  assert.equal(acceptedVideoDuration("readyToPlay", 20), 20);
  assert.equal(acceptedVideoDuration("readyToPlay", 0.5), 0.5);
});

test("statusChange: a non-ready status is rejected even with a good duration", () => {
  // A duration can be known before the player is ready; ignore it until ready.
  assert.equal(acceptedVideoDuration("loading", 20), null);
  assert.equal(acceptedVideoDuration("idle", 20), null);
  assert.equal(acceptedVideoDuration("error", 20), null);
});

test("statusChange: ready but a NaN / 0 / negative duration is rejected", () => {
  // A clip still loading reports a garbage length; never latch onto it.
  assert.equal(acceptedVideoDuration("readyToPlay", NaN), null);
  assert.equal(acceptedVideoDuration("readyToPlay", 0), null);
  assert.equal(acceptedVideoDuration("readyToPlay", -5), null);
  assert.equal(acceptedVideoDuration("readyToPlay", Infinity), null);
});

test("statusChange: a non-number duration is rejected", () => {
  assert.equal(acceptedVideoDuration("readyToPlay", undefined), null);
  assert.equal(acceptedVideoDuration("readyToPlay", null), null);
  assert.equal(acceptedVideoDuration("readyToPlay", "20"), null);
});
