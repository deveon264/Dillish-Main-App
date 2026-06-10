// Pure advance/completion-guard logic for the active workout player.
//
// An exercise can be "completed" from two independent signals:
//
// - a "timer" signal, when an exercise with no playable video reaches the end
//   of its countdown (remaining hits 0), or
// - a "video" signal, when the loaded clip fires "playToEnd".
//
// Both can fire for the same exercise (e.g. a clip ends at the same moment the
// countdown reaches zero), and a stale "playToEnd" from an outgoing clip can
// fire mid-transition while the next exercise is still loading. This helper
// decides, from a snapshot of the player's state, whether a completion signal
// should be acted on and what the resulting action is, so the player never
// skips an exercise or counts one twice.
//
// It is extracted here, free of any React Native imports, so it can be
// unit-tested in the node:test + tsx suite without a renderer.

export type WorkoutPhase = "active" | "rest" | "done";

// Which signal fired the completion.
export type CompletionSource = "video" | "timer";

export type CompletionInput = {
  // Current player phase. Only "active" exercises can complete.
  phase: WorkoutPhase;
  // Whether there is a current exercise at `index`.
  hasCurrent: boolean;
  // Which signal fired this completion.
  source: CompletionSource;
  // The current exercise's mapped video id, or null when it has no video.
  currentVideoId: string | null;
  // The video id confirmed-loaded into the player, or null while a new clip is
  // still loading (set to null at the start of every load).
  loadedVideoId: string | null;
  // The exercise index already marked complete (the double-fire guard's value).
  // -1 means nothing completed yet for the current exercise.
  completedIndex: number;
  // Index of the exercise currently playing.
  index: number;
  // Total number of exercises in the workout.
  total: number;
  // Rest gap (seconds) configured between exercises. <= 0 means advance
  // immediately with no rest screen.
  restGap: number;
};

export type CompletionAction =
  // Signal is stale or a duplicate: do nothing.
  | "ignore"
  // This was the last exercise: finish the workout.
  | "finish"
  // Advance straight to the next exercise (rest is off).
  | "advance"
  // Open the rest countdown before the next exercise.
  | "rest";

export type CompletionDecision = {
  action: CompletionAction;
  // The value to store back into the double-fire guard, or null when the signal
  // is ignored (the guard must not move).
  completedIndex: number | null;
};

const ignore = (): CompletionDecision => ({ action: "ignore", completedIndex: null });

export function decideExerciseCompletion(input: CompletionInput): CompletionDecision {
  const {
    phase,
    hasCurrent,
    source,
    currentVideoId,
    loadedVideoId,
    completedIndex,
    index,
    total,
    restGap,
  } = input;

  // Only an exercise that is actively playing can complete.
  if (phase !== "active" || !hasCurrent) return ignore();

  // A "video" completion only counts when the clip that ended is the one
  // confirmed-loaded for the CURRENT exercise. A stale end event from an
  // outgoing clip (mid-transition, before the next clip has loaded) is dropped.
  if (source === "video" && (currentVideoId == null || loadedVideoId !== currentVideoId)) {
    return ignore();
  }

  // Already completed this exercise (e.g. the countdown and the clip ended
  // together): ignore the second signal so it can't double-count or skip ahead.
  if (completedIndex === index) return ignore();

  if (index + 1 >= total) return { action: "finish", completedIndex: index };
  if (restGap <= 0) return { action: "advance", completedIndex: index };
  return { action: "rest", completedIndex: index };
}

// --- Rest countdown -> auto-advance ---------------------------------------
//
// After an exercise completes with rest "on", the player enters the "rest"
// phase and ticks a countdown down once per second. When the countdown reaches
// zero it advances to the next exercise (or finishes). The countdown pauses
// with the rest of the player. This helper decides, from a snapshot, what the
// rest-countdown effect should do on each render.

export type RestTickInput = {
  // Current player phase. Only the "rest" phase ticks.
  phase: WorkoutPhase;
  // Whether the player is paused (the rest countdown pauses too).
  paused: boolean;
  // Seconds left on the rest countdown.
  restRemaining: number;
};

export type RestTickAction =
  // Not resting (or paused): do nothing.
  | "idle"
  // Countdown is exhausted: move on to the next exercise (or finish).
  | "advance"
  // Countdown still has time left: tick one second down.
  | "tick";

export function decideRestTick(input: RestTickInput): RestTickAction {
  const { phase, paused, restRemaining } = input;
  if (phase !== "rest" || paused) return "idle";
  if (restRemaining <= 0) return "advance";
  return "tick";
}

// --- Advance target (next exercise vs finish) ----------------------------
//
// Moving on from the current exercise (after the rest countdown, or straight
// away when rest is "Off") either steps to the next exercise or, if this was
// the last one, finishes the workout. Computes which, plus the index to land on.

export type AdvanceInput = {
  // Index of the exercise being left.
  index: number;
  // Total number of exercises in the workout.
  total: number;
};

export type AdvanceDecision =
  // The current exercise was the last one: finish the workout.
  | { action: "finish"; nextIndex: null }
  // Step forward to `nextIndex`.
  | { action: "advance"; nextIndex: number };

export function decideAdvanceTarget(input: AdvanceInput): AdvanceDecision {
  const { index, total } = input;
  if (index + 1 < total) return { action: "advance", nextIndex: index + 1 };
  return { action: "finish", nextIndex: null };
}

// --- Replay / jump-back guard --------------------------------------------
//
// Tapping an exercise in the list replays it, but only an EARLIER exercise:
// you can jump back to redo a move, never skip ahead past the current one. A
// tap on the current exercise, or one further along, is ignored.

export type JumpInput = {
  // The exercise index the member tapped.
  target: number;
  // The index currently playing.
  index: number;
};

export type JumpAction =
  // Target is the current or a later exercise: ignore (no skipping ahead).
  | "ignore"
  // Target is an earlier exercise: jump back to replay it.
  | "jump";

export function decideJump(input: JumpInput): JumpAction {
  const { target, index } = input;
  if (target >= index) return "ignore";
  return "jump";
}
