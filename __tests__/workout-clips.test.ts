import { test } from "node:test";
import assert from "node:assert/strict";

import { buildClipMap, type ClipItem } from "@/lib/workoutClips";

const clip = (over: Partial<ClipItem> & { id: string; createdAt: number }): ClipItem => ({
  hasPoster: false,
  workoutId: null,
  workoutExerciseId: null,
  moveId: null,
  ...over,
});

test("buildClipMap prefers exact workout exercise clips over shared move clips", () => {
  const map = buildClipMap(
    [{ id: "e1", moveId: "squat" }],
    [
      clip({ id: "shared-new", moveId: "squat", createdAt: 300 }),
      clip({
        id: "exact-old",
        workoutId: "w1",
        workoutExerciseId: "e1",
        moveId: "squat",
        createdAt: 100,
        hasPoster: true,
      }),
    ],
    "w1"
  );

  assert.deepEqual(map, { e1: { id: "exact-old", hasPoster: true } });
});

test("buildClipMap reuses the newest shared move clip when no exact clip exists", () => {
  const map = buildClipMap(
    [
      { id: "e1", moveId: "squat" },
      { id: "e2", moveId: "bridge" },
      { id: "e3", moveId: null },
    ],
    [
      clip({ id: "squat-old", moveId: "squat", createdAt: 100 }),
      clip({ id: "squat-new", moveId: "squat", createdAt: 300, hasPoster: true }),
      clip({ id: "bridge", moveId: "bridge", createdAt: 200 }),
    ],
    "w2"
  );

  assert.deepEqual(map, {
    e1: { id: "squat-new", hasPoster: true },
    e2: { id: "bridge", hasPoster: false },
  });
});
