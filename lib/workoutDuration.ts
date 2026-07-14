export type TimedExercise = {
  seconds: number;
  sets?: number;
};

export const REST_OPTIONS = [0, 10, 15, 30, 60] as const;
export type RestGapSeconds = (typeof REST_OPTIONS)[number];

export const REST_GAP_KEY = "florish.restGapSeconds";
export const DEFAULT_REST_GAP: RestGapSeconds = 15;

export function isRestGapSeconds(value: unknown): value is RestGapSeconds {
  return typeof value === "number" && REST_OPTIONS.includes(value as RestGapSeconds);
}

// One set's duration in seconds (0 when unset/invalid).
export function exerciseSetSeconds(exercise: TimedExercise): number {
  return Number.isFinite(exercise.seconds) && exercise.seconds > 0 ? exercise.seconds : 0;
}

// The exercise's configured set count, defaulting to 1 when unset/invalid.
export function exerciseSets(exercise: TimedExercise): number {
  return exercise.sets == null
    ? 1
    : Number.isFinite(exercise.sets) && exercise.sets > 0
      ? exercise.sets
      : 1;
}

export function exerciseTimedSeconds(exercise: TimedExercise): number {
  return exerciseSetSeconds(exercise) * exerciseSets(exercise);
}

export function workoutTimedSeconds(exercises: TimedExercise[]): number {
  return exercises.reduce((sum, exercise) => sum + exerciseTimedSeconds(exercise), 0);
}

// Total rest pauses in a session: the player rests between every set of an
// exercise as well as between exercises, all using the same configured gap.
export function workoutRestSeconds(
  exercises: TimedExercise[],
  restGapSeconds = DEFAULT_REST_GAP,
): number {
  const gap = Math.max(0, restGapSeconds);
  const betweenExercises = Math.max(0, exercises.length - 1);
  const betweenSets = exercises.reduce((sum, e) => sum + Math.max(0, exerciseSets(e) - 1), 0);
  return (betweenExercises + betweenSets) * gap;
}

export function workoutSessionSeconds(
  exercises: TimedExercise[],
  restGapSeconds = DEFAULT_REST_GAP,
): number {
  return workoutTimedSeconds(exercises) + workoutRestSeconds(exercises, restGapSeconds);
}

export function workoutDurationMinutes(
  exercises: TimedExercise[],
  restGapSeconds = DEFAULT_REST_GAP,
): number {
  const total = workoutSessionSeconds(exercises, restGapSeconds);
  return total > 0 ? Math.ceil(total / 60) : 0;
}
