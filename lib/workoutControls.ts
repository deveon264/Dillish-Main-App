// Pure control logic for the active workout player's playback buttons.
//
// Two controls drive the player and have to behave the same whether the current
// exercise has a loaded clip or only the simulated per-exercise countdown:
//
// - the play/pause button, whose intent is "mirrored" onto the real video so the
//   button, the countdown and the clip all start/stop together, and
// - the 15s forward/back seek, which seeks the real clip when one is loaded and
//   otherwise nudges the countdown so the buttons still do something.
//
// Both decisions live in the workout screen (app/workout/[id].tsx), which imports
// expo-video and so cannot run in the node:test + tsx suite directly. The
// decisions are extracted here, free of any React Native / expo-video imports
// (same pattern as `@/lib/workoutAdvance` and `@/lib/workoutClipLoader`), so they
// can be unit-tested without a renderer. The screen calls these exact helpers.

// --- Play/pause mirror ----------------------------------------------------
//
// When the member toggles play/pause, the intent is mirrored onto the real
// video so the existing play button drives the clip too. With no clip loaded
// for the current exercise there is nothing to mirror onto (the countdown reacts
// to `paused` on its own), so the mirror is a no-op.

export type PlayPauseInput = {
  // Whether the current exercise has a clip to mirror the intent onto. When
  // false there is no video and the player must not be touched.
  hasVideo: boolean;
  // The member's current play/pause intent (true = paused).
  paused: boolean;
};

export type PlayPauseAction =
  // No clip for this exercise: leave the player alone.
  | "none"
  // Mirror "playing" onto the clip.
  | "play"
  // Mirror "paused" onto the clip.
  | "pause";

export function decidePlayPauseMirror(input: PlayPauseInput): PlayPauseAction {
  if (!input.hasVideo) return "none";
  return input.paused ? "pause" : "play";
}

// --- 15s forward/back seek ------------------------------------------------
//
// The forward/back buttons jump by a fixed step. With a real clip loaded
// (duration known) we seek the clip itself; otherwise (no video, or a mapped
// video that failed to load) we nudge the simulated per-exercise countdown so
// the buttons stay responsive. A back-seek adds time to the countdown, a
// forward-seek removes it, clamped to [0, the exercise's configured seconds].

export type SeekInput = {
  // Whether the current exercise has a mapped clip.
  hasVideo: boolean;
  // Live duration (seconds) of the loaded clip. <= 0.1 means no playable video
  // is actually loaded yet, so the countdown branch is taken instead.
  videoDuration: number;
  // The signed step (seconds): positive seeks forward, negative seeks back.
  delta: number;
  // The current exercise's configured length (seconds), the upper bound the
  // countdown nudge clamps to. Falls back to the live `remaining` when unknown.
  currentSeconds: number | null;
  // The live per-exercise countdown value (seconds left).
  remaining: number;
};

export type SeekDecision =
  // A real clip is loaded: seek it by `by` seconds (the original signed delta).
  | { action: "seek"; by: number }
  // No playable clip: set the countdown to `remaining` (already clamped).
  | { action: "countdown"; remaining: number };

export function decideSeek(input: SeekInput): SeekDecision {
  const { hasVideo, videoDuration, delta, currentSeconds, remaining } = input;
  // Only seek the clip when a video is actually loaded (duration known).
  if (hasVideo && videoDuration > 0.1) {
    return { action: "seek", by: delta };
  }
  // No video (or it failed to load): nudge the countdown. A forward jump
  // (positive delta) removes time, a back jump adds it; clamp to the exercise's
  // length so the bar can't run past either end.
  const max = currentSeconds ?? remaining;
  const next = Math.max(0, Math.min(max, remaining - delta));
  return { action: "countdown", remaining: next };
}
