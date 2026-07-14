// Pure clip-selection logic for the workout player (react-native-free so it is
// unit-testable with tsx, like lib/workoutProgress.ts).
//
// Coach clips are keyed two ways on the server: legacy uploads carry only
// (workoutId, workoutExerciseId); newer uploads also carry the canonical
// moveId (constants/workouts.ts Exercise.moveId) so one filmed clip serves
// every workout using the same move. Precedence per workout exercise:
//   1. newest clip uploaded for this exact (workoutId, workoutExerciseId) —
//      keeps legacy uploads working and lets the coach override a shared clip
//      for one specific workout;
//   2. newest clip whose moveId matches the exercise's canonical move.

export type ClipItem = {
  id: string;
  hasPoster: boolean;
  workoutId?: string | null;
  workoutExerciseId?: string | null;
  moveId?: string | null;
  createdAt: number;
  // Byte size of the uploaded clip; feeds the phone-side cache key so a
  // replaced video (same id, new file) re-downloads.
  videoSize?: number;
};

export type ClipRef = { id: string; hasPoster: boolean; videoSize?: number };

export function buildClipMap(
  exercises: { id: string; moveId?: string | null }[],
  items: ClipItem[],
  workoutId: string
): Record<string, ClipRef> {
  const newestFirst = [...items].sort((a, b) => b.createdAt - a.createdAt);
  const map: Record<string, ClipRef> = {};
  for (const e of exercises) {
    const exact = newestFirst.find(
      (it) => it.workoutId === workoutId && it.workoutExerciseId === e.id
    );
    const match =
      exact ?? (e.moveId ? newestFirst.find((it) => it.moveId === e.moveId) : undefined);
    if (match) {
      map[e.id] = { id: match.id, hasPoster: match.hasPoster };
      if (match.videoSize != null) map[e.id].videoSize = match.videoSize;
    }
  }
  return map;
}
