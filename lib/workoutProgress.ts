// Pure progress math for the active workout player. The player's progress bar
// computes its left (elapsed) and right (total) time two different ways:
//
// - When the current exercise has an uploaded video, the bar tracks the real
//   clip (videoTime / videoDuration), so it stays honest to what is on screen.
// - When the current exercise has no video, the bar shows that single
//   exercise's own configured duration and the time elapsed within it,
//   resetting as the workout advances to the next exercise.
//
// Whole-workout stats (overall %, kcal, bpm/zone) always use CUMULATIVE time
// across the whole workout, regardless of the per-bar branch above.
//
// This logic is extracted here, free of any React Native imports, so it can be
// unit-tested in the node:test + tsx suite without a renderer.

export type WorkoutProgressInput = {
  // The configured durations (seconds) of every exercise in the workout, in
  // order. Used for cumulative whole-workout time.
  exerciseSeconds: number[];
  // Index of the exercise currently playing.
  index: number;
  // Seconds remaining in the current exercise's countdown.
  remaining: number;
  // Total kcal estimate for the whole workout (scaled by overall progress).
  workoutKcal: number;
  // Whether the current exercise has a mapped/uploaded video.
  hasVideo: boolean;
  // Live playback position/length of the loaded clip (only meaningful when
  // hasVideo is true).
  videoTime: number;
  videoDuration: number;
  // Rest gap between exercises. Optional so existing callers/tests that only
  // care about active exercise time keep the old no-rest behavior.
  restGap?: number;
  // Sets configured per exercise, parallel to exerciseSeconds. When provided,
  // the whole-workout total also counts the rest pauses BETWEEN SETS (the
  // player rests between sets using the same gap), keeping `overall` honest
  // under per-set playback. Optional so pre-set callers keep the old math.
  setsPerExercise?: number[];
  // Duration (seconds) of ONE SET of the current exercise. Under per-set
  // playback the countdown bar tracks a single set, so the bar's total is this
  // rather than the exercise's full sets x seconds. Optional for old callers.
  setSeconds?: number;
  // Real active seconds accumulated by a wall-clock timer on the player (it
  // ticks 1/s while the session is running and not paused, independent of the
  // per-exercise countdown). When provided, the whole-workout `elapsed`/`overall`
  // are driven by this instead of the configured-duration countdown, so a video
  // exercise whose clip runs longer/shorter than its configured seconds no longer
  // freezes or jumps the elapsed stat. Optional so existing callers/tests keep
  // the old countdown-derived behavior.
  activeElapsedSeconds?: number;
  // The member's body weight in kilograms, used to personalize the kcal estimate.
  // Optional/undefined when unknown, in which case the authored per-workout kcal
  // is used unscaled.
  weightKg?: number;
};

// Percentages are typed as the template-literal `${number}%` so they remain
// assignable to React Native's `DimensionValue` style props at the call site.
type Pct = `${number}%`;

export type WorkoutProgress = {
  // Cumulative time across the whole workout.
  totalSeconds: number;
  elapsed: number;
  overall: number;
  overallPct: Pct;
  // The progress bar's own elapsed/total (branches on hasVideo).
  barElapsed: number;
  barTotal: number;
  barPct: Pct;
  // Whole-workout stats derived from cumulative `overall`.
  kcalBurned: number;
  bpm: number;
  zone: "Light" | "Moderate" | "Intense";
  bpmPct: Pct;
};

const pct = (n: number): Pct => `${Math.round(n * 100)}%`;

// The body weight the authored per-workout `kcal` estimates are calibrated for.
// The live kcal figure scales linearly around this reference, so a heavier member
// burns proportionally more and a lighter one less than the authored number.
export const REFERENCE_WEIGHT_KG = 70;

// Estimates calories burned so far: the authored whole-workout kcal, scaled by
// how far through the session the member is (`overall`, 0..1) and by their body
// weight relative to the reference. When weight is unknown the authored estimate
// is used unscaled. This is an estimate, not a measurement — it assumes a roughly
// uniform burn rate across the session.
export function estimateKcalBurned({
  workoutKcal,
  overall,
  weightKg,
}: {
  workoutKcal: number;
  overall: number;
  weightKg?: number;
}): number {
  const weightFactor =
    typeof weightKg === "number" && Number.isFinite(weightKg) && weightKg > 0
      ? weightKg / REFERENCE_WEIGHT_KG
      : 1;
  return Math.round(workoutKcal * overall * weightFactor);
}

// Formats a number of seconds as the "m:ss" clock shown on the player bar and
// session stats. The same helper formats both the bar's elapsed/total (which in
// video mode are fractional clip times, e.g. 8.5s, and in countdown mode are
// whole exercise seconds) and the cumulative session stats. Fractional seconds
// floor to the second on screen, and negatives clamp to 0:00 so an overshoot
// (a stale timeUpdate, or remaining > total) can never render "-1:59".
export function formatClock(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// The video player feeds two raw expo-video events into the progress bar's
// videoTime / videoDuration state. The translation from a raw event into the
// committed state lives here, free of any React Native imports, so the guard
// logic can be unit-tested without a renderer.

// "timeUpdate" reports the clip's current playback position. A missing
// currentTime (null/undefined event payload) falls back to 0 so the bar never
// tracks an undefined position.
export function nextVideoTime(e: { currentTime?: number } | null | undefined): number {
  return e?.currentTime ?? 0;
}

// "statusChange" should only commit a new duration once the player is actually
// ready AND reports a sane length. Non-ready statuses, or a NaN/0/negative
// duration (clip still loading), are rejected so a stuck or wrong bar can't
// latch onto a garbage total. Returns the duration to commit, or null to skip.
export function acceptedVideoDuration(status: string, duration: unknown): number | null {
  if (status !== "readyToPlay") return null;
  return typeof duration === "number" && Number.isFinite(duration) && duration > 0
    ? duration
    : null;
}

export function computeWorkoutProgress(input: WorkoutProgressInput): WorkoutProgress {
  const { exerciseSeconds, index, remaining, workoutKcal, hasVideo, videoTime, videoDuration, restGap = 0, setsPerExercise, setSeconds, activeElapsedSeconds, weightKg } =
    input;

  const currentSeconds = setSeconds ?? exerciseSeconds[index] ?? 0;
  const safeRestGap = Math.max(0, restGap);

  // --- whole-workout cumulative time -------------------------------------
  const exerciseTotalSeconds = exerciseSeconds.reduce((s, sec) => s + sec, 0);
  const interSetRests = (setsPerExercise ?? []).reduce(
    (s, sets) => s + Math.max(0, (Number.isFinite(sets) && sets > 0 ? sets : 1) - 1),
    0
  );
  const totalRestSeconds = (Math.max(0, exerciseSeconds.length - 1) + interSetRests) * safeRestGap;
  const totalSeconds = exerciseTotalSeconds + totalRestSeconds;
  const priorExerciseSeconds = exerciseSeconds.slice(0, index).reduce((s, sec) => s + sec, 0);
  const priorRestSeconds = Math.min(index, Math.max(0, exerciseSeconds.length - 1)) * safeRestGap;
  const priorSeconds = priorExerciseSeconds + priorRestSeconds;
  // Prefer the real active-time accumulator when the caller provides it, so the
  // elapsed/overall stats track wall-clock time honestly (and stay in step with
  // the video bar) instead of the configured-duration countdown. `overall` is
  // clamped to 1 so a session that overruns its configured total can't report
  // >100% or overshoot the kcal estimate.
  const useRealElapsed = typeof activeElapsedSeconds === "number" && Number.isFinite(activeElapsedSeconds);
  const elapsed = useRealElapsed
    ? Math.max(0, activeElapsedSeconds as number)
    : priorSeconds + (currentSeconds - remaining);
  const overall = totalSeconds > 0 ? Math.min(1, elapsed / totalSeconds) : 0;

  // --- progress bar (branches on whether the exercise has a video) -------
  const barElapsed = hasVideo ? Math.min(videoTime, videoDuration) : currentSeconds - remaining;
  const barTotal = hasVideo ? videoDuration : currentSeconds;

  // --- whole-workout stats (always cumulative) ---------------------------
  const kcalBurned = estimateKcalBurned({ workoutKcal, overall, weightKg });
  const bpm = 96 + Math.round(overall * 44);
  const zone = bpm < 110 ? "Light" : bpm < 135 ? "Moderate" : "Intense";

  return {
    totalSeconds,
    elapsed,
    overall,
    overallPct: pct(overall),
    barElapsed,
    barTotal,
    barPct: pct(barTotal > 0 ? barElapsed / barTotal : 0),
    kcalBurned,
    bpm,
    zone,
    bpmPct: `${Math.min(100, Math.round(((bpm - 60) / 120) * 100))}%`,
  };
}
