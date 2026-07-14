import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeWorkoutProgress,
  estimateKcalBurned,
  formatClock,
  REFERENCE_WEIGHT_KG,
  type WorkoutProgressInput,
} from "@/lib/workoutProgress";

// A 3-exercise workout: 30s, 60s, 30s = 120s total.
function input(over: Partial<WorkoutProgressInput> = {}): WorkoutProgressInput {
  return {
    exerciseSeconds: [30, 60, 30],
    index: 0,
    remaining: 30,
    workoutKcal: 300,
    hasVideo: false,
    videoTime: 0,
    videoDuration: 0,
    ...over,
  };
}

// --- (1) uploaded-video branch tracks clip videoTime/videoDuration --------

test("video branch: bar tracks the clip's time/duration, not the exercise", () => {
  // On the 2nd exercise (60s configured), with a 20s clip 8s in. The bar must
  // reflect the CLIP (8/20), ignoring the exercise's own 60s duration.
  const p = computeWorkoutProgress(
    input({ index: 1, remaining: 45, hasVideo: true, videoTime: 8, videoDuration: 20 }),
  );
  assert.equal(p.barElapsed, 8);
  assert.equal(p.barTotal, 20);
  assert.equal(p.barPct, "40%");
});

test("video branch: bar elapsed is clamped to the clip duration", () => {
  // A stale timeUpdate can report past the end; the bar must not overshoot.
  const p = computeWorkoutProgress(
    input({ hasVideo: true, videoTime: 25, videoDuration: 20 }),
  );
  assert.equal(p.barElapsed, 20);
  assert.equal(p.barTotal, 20);
  assert.equal(p.barPct, "100%");
});

test("video branch: zero duration (clip still loading) shows an empty bar", () => {
  const p = computeWorkoutProgress(
    input({ hasVideo: true, videoTime: 0, videoDuration: 0 }),
  );
  assert.equal(p.barElapsed, 0);
  assert.equal(p.barTotal, 0);
  assert.equal(p.barPct, "0%");
});

// --- (2) no-video branch shows current exercise's own duration ------------

test("no-video branch: total is the current exercise's seconds, elapsed is seconds - remaining", () => {
  // 2nd exercise is 60s, 45s remaining => 15s elapsed within THIS exercise.
  const p = computeWorkoutProgress(input({ index: 1, remaining: 45 }));
  assert.equal(p.barTotal, 60);
  assert.equal(p.barElapsed, 15);
  assert.equal(p.barPct, "25%");
});

test("no-video branch: a fresh exercise (full remaining) shows an empty bar", () => {
  const p = computeWorkoutProgress(input({ index: 2, remaining: 30 }));
  assert.equal(p.barTotal, 30);
  assert.equal(p.barElapsed, 0);
  assert.equal(p.barPct, "0%");
});

test("no-video branch: bar resets per exercise (total follows the current exercise)", () => {
  // Same elapsed-within-exercise (10s) but on exercises of different lengths:
  // the bar total must follow whichever exercise is current, not the workout.
  const onShort = computeWorkoutProgress(input({ index: 0, remaining: 20 })); // 30s ex
  const onLong = computeWorkoutProgress(input({ index: 1, remaining: 50 })); // 60s ex
  assert.equal(onShort.barTotal, 30);
  assert.equal(onShort.barElapsed, 10);
  assert.equal(onLong.barTotal, 60);
  assert.equal(onLong.barElapsed, 10);
  // Same absolute elapsed, different bar fill, because total differs.
  assert.equal(onShort.barPct, "33%");
  assert.equal(onLong.barPct, "17%");
});

// --- (3) whole-workout stats always use cumulative elapsed/totalSeconds ----

test("whole-workout stats use cumulative time regardless of the video branch", () => {
  // 2nd exercise (prior 30s), 45s remaining of its 60s => 15s into it.
  // Cumulative elapsed = 30 + 15 = 45 of 120 total => 37.5% overall.
  const noVideo = computeWorkoutProgress(input({ index: 1, remaining: 45 }));
  assert.equal(noVideo.totalSeconds, 120);
  assert.equal(noVideo.elapsed, 45);
  assert.equal(noVideo.overallPct, "38%"); // Math.round(37.5)

  // The video branch must NOT change the cumulative whole-workout numbers,
  // even though its bar tracks a clip with a wildly different time.
  const withVideo = computeWorkoutProgress(
    input({ index: 1, remaining: 45, hasVideo: true, videoTime: 3, videoDuration: 99 }),
  );
  assert.equal(withVideo.totalSeconds, 120);
  assert.equal(withVideo.elapsed, 45);
  assert.equal(withVideo.overallPct, "38%");
  assert.equal(withVideo.overall, noVideo.overall);
});

test("whole-workout stats can include rest gaps in session totals", () => {
  // 2nd exercise (prior 30s + one 15s rest), 45s remaining of its 60s => 15s
  // into it. Cumulative elapsed = 30 + 15 rest + 15 = 60 of 150 total.
  const p = computeWorkoutProgress(input({ index: 1, remaining: 45, restGap: 15 }));
  assert.equal(p.totalSeconds, 150);
  assert.equal(p.elapsed, 60);
  assert.equal(p.overallPct, "40%");
});

test("kcal and bpm/zone scale off cumulative overall, not the bar", () => {
  // Halfway through the workout: 1st (30) done + 30s of the 60s 2nd = 60/120.
  const p = computeWorkoutProgress(
    input({ index: 1, remaining: 30, hasVideo: true, videoTime: 1, videoDuration: 2 }),
  );
  assert.equal(p.overall, 0.5);
  assert.equal(p.kcalBurned, 150); // 300 * 0.5
  assert.equal(p.bpm, 118); // 96 + round(0.5 * 44)
  assert.equal(p.zone, "Moderate");
  // The bar still reflects the clip (1/2), independent of these stats.
  assert.equal(p.barPct, "50%");
});

test("zone thresholds: Light below 110 bpm, Intense at/above 135", () => {
  const start = computeWorkoutProgress(input({ index: 0, remaining: 30 })); // 0% => bpm 96
  assert.equal(start.bpm, 96);
  assert.equal(start.zone, "Light");

  // End of workout: last exercise fully elapsed => overall 1 => bpm 140.
  const end = computeWorkoutProgress(input({ index: 2, remaining: 0 }));
  assert.equal(end.overall, 1);
  assert.equal(end.bpm, 140);
  assert.equal(end.zone, "Intense");
});

test("empty workout (no exercises) never divides by zero", () => {
  const p = computeWorkoutProgress({
    exerciseSeconds: [],
    index: 0,
    remaining: 0,
    workoutKcal: 200,
    hasVideo: false,
    videoTime: 0,
    videoDuration: 0,
  });
  assert.equal(p.totalSeconds, 0);
  assert.equal(p.overall, 0);
  assert.equal(p.overallPct, "0%");
  assert.equal(p.barPct, "0%");
  assert.equal(p.kcalBurned, 0);
});

// --- (3b) real active-time elapsed (activeElapsedSeconds) ------------------

test("real elapsed: whole-workout elapsed/overall follow activeElapsedSeconds when given", () => {
  // The countdown would put legacy elapsed at 45 (30 prior + 15 into ex 2), but
  // the real wall-clock accumulator says only 20s of active time has passed.
  const p = computeWorkoutProgress(input({ index: 1, remaining: 45, activeElapsedSeconds: 20 }));
  assert.equal(p.elapsed, 20);
  assert.equal(p.totalSeconds, 120);
  assert.equal(p.overallPct, "17%"); // round(20/120)
});

test("real elapsed: overall clamps at 1 when active time overruns the configured total", () => {
  // A session that runs long (e.g. video clips longer than configured seconds)
  // must not report >100% or overshoot the kcal estimate.
  const p = computeWorkoutProgress(input({ activeElapsedSeconds: 200 }));
  assert.equal(p.elapsed, 200);
  assert.equal(p.overall, 1);
  assert.equal(p.overallPct, "100%");
  assert.equal(p.kcalBurned, 300); // 300 * 1
});

test("real elapsed: decoupled from the countdown and the video clip", () => {
  // Neither a stalled countdown (remaining clamped at 0, the video-tail case)
  // nor the clip time changes the real elapsed once the accumulator drives it.
  const p = computeWorkoutProgress(
    input({ index: 2, remaining: 0, hasVideo: true, videoTime: 5, videoDuration: 99, activeElapsedSeconds: 75 }),
  );
  assert.equal(p.elapsed, 75);
  assert.equal(p.overall, 0.625); // 75/120
  // The bar still honestly reflects the clip, independent of the stat.
  assert.equal(p.barTotal, 99);
});

test("real elapsed: omitting activeElapsedSeconds reproduces the legacy countdown numbers", () => {
  // Regression guard: existing callers that don't pass the accumulator keep the
  // old configured-duration behavior.
  const legacy = computeWorkoutProgress(input({ index: 1, remaining: 45 }));
  assert.equal(legacy.elapsed, 45);
  assert.equal(legacy.overallPct, "38%");
});

// --- (3c) weight-personalized kcal (estimateKcalBurned) --------------------

test("estimateKcalBurned: scales linearly around the reference weight", () => {
  // At the reference weight the authored figure is used unscaled.
  assert.equal(estimateKcalBurned({ workoutKcal: 300, overall: 1, weightKg: REFERENCE_WEIGHT_KG }), 300);
  // Heavier burns proportionally more, lighter proportionally less.
  assert.equal(estimateKcalBurned({ workoutKcal: 300, overall: 1, weightKg: REFERENCE_WEIGHT_KG * 1.5 }), 450);
  assert.equal(estimateKcalBurned({ workoutKcal: 300, overall: 1, weightKg: REFERENCE_WEIGHT_KG * 0.5 }), 150);
  // Also scales by progress.
  assert.equal(estimateKcalBurned({ workoutKcal: 300, overall: 0.5, weightKg: REFERENCE_WEIGHT_KG }), 150);
});

test("estimateKcalBurned: falls back to the authored figure when weight is unknown or invalid", () => {
  assert.equal(estimateKcalBurned({ workoutKcal: 300, overall: 1 }), 300);
  assert.equal(estimateKcalBurned({ workoutKcal: 300, overall: 1, weightKg: 0 }), 300);
  assert.equal(estimateKcalBurned({ workoutKcal: 300, overall: 1, weightKg: -5 }), 300);
  assert.equal(estimateKcalBurned({ workoutKcal: 300, overall: 1, weightKg: NaN }), 300);
});

test("computeWorkoutProgress applies the member's weight to kcalBurned", () => {
  // 60s of real active time = 0.5 of the 120s total; a 2x-reference member.
  const p = computeWorkoutProgress(
    input({ activeElapsedSeconds: 60, weightKg: REFERENCE_WEIGHT_KG * 2 }),
  );
  assert.equal(p.overall, 0.5);
  assert.equal(p.kcalBurned, 300); // 300 * 0.5 * 2
});

// --- (4) formatClock: the "m:ss" clock on the bar and session stats --------

test("formatClock: countdown mode (whole exercise seconds) formats m:ss", () => {
  // Countdown mode feeds the bar whole seconds (currentSeconds - remaining).
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(5), "0:05");
  assert.equal(formatClock(59), "0:59");
  assert.equal(formatClock(60), "1:00");
  assert.equal(formatClock(75), "1:15");
  assert.equal(formatClock(600), "10:00");
});

test("formatClock: clip mode (fractional clip times) floors to the second", () => {
  // Video mode feeds the bar fractional clip times (videoTime/videoDuration).
  // They must floor to a whole second on screen, never round up early.
  assert.equal(formatClock(8.5), "0:08");
  assert.equal(formatClock(8.99), "0:08");
  assert.equal(formatClock(59.9), "0:59");
  assert.equal(formatClock(119.4), "1:59");
});

test("formatClock: negatives and non-finite inputs clamp to 0:00", () => {
  // An overshoot (stale timeUpdate, or remaining > total) must never render a
  // negative clock, and a not-yet-known duration (NaN) shows 0:00.
  assert.equal(formatClock(-1), "0:00");
  assert.equal(formatClock(-0.5), "0:00");
  assert.equal(formatClock(NaN), "0:00");
  assert.equal(formatClock(Infinity), "0:00");
});

test("formatClock: matches the bar values from computeWorkoutProgress in both modes", () => {
  // The helper formats whatever the progress math produces. Prove the two flow
  // together: clip mode (fractional) and countdown mode (whole seconds).
  const clip = computeWorkoutProgress(
    input({ index: 1, remaining: 45, hasVideo: true, videoTime: 8.7, videoDuration: 20 }),
  );
  assert.equal(formatClock(clip.barElapsed), "0:08");
  assert.equal(formatClock(clip.barTotal), "0:20");

  const countdown = computeWorkoutProgress(input({ index: 1, remaining: 45 }));
  assert.equal(formatClock(countdown.barElapsed), "0:15");
  assert.equal(formatClock(countdown.barTotal), "1:00");
});
