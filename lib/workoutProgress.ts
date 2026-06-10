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

export function computeWorkoutProgress(input: WorkoutProgressInput): WorkoutProgress {
  const { exerciseSeconds, index, remaining, workoutKcal, hasVideo, videoTime, videoDuration } =
    input;

  const currentSeconds = exerciseSeconds[index] ?? 0;

  // --- whole-workout cumulative time -------------------------------------
  const totalSeconds = exerciseSeconds.reduce((s, sec) => s + sec, 0);
  const priorSeconds = exerciseSeconds.slice(0, index).reduce((s, sec) => s + sec, 0);
  const elapsed = priorSeconds + (currentSeconds - remaining);
  const overall = totalSeconds > 0 ? elapsed / totalSeconds : 0;

  // --- progress bar (branches on whether the exercise has a video) -------
  const barElapsed = hasVideo ? Math.min(videoTime, videoDuration) : currentSeconds - remaining;
  const barTotal = hasVideo ? videoDuration : currentSeconds;

  // --- whole-workout stats (always cumulative) ---------------------------
  const kcalBurned = Math.round(workoutKcal * overall);
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
