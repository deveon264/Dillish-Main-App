import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";

// constants/workouts.ts `require()`s real .webp/.jpg asset bytes (handled by
// Metro at runtime). Node/tsx can't parse those, so stub the image loaders to
// return the resolved file path. That lets us both import the module and assert
// exactly which bundled photo findExerciseImage picked.
const ext = (Module as unknown as { _extensions: Record<string, unknown> })._extensions;
for (const e of [".webp", ".png", ".jpg", ".jpeg"]) {
  ext[e] = (m: { exports: unknown }, filename: string) => {
    m.exports = { uri: filename };
  };
}

const req = createRequire(import.meta.url);
const { findExerciseImage } = req("@/constants/workouts") as typeof import("@/constants/workouts");

// The stub above makes every image a { uri: "/abs/path/to/asset.webp" }.
function fileOf(image: unknown): string | undefined {
  if (image && typeof image === "object" && "uri" in image) {
    const uri = (image as { uri: unknown }).uri;
    if (typeof uri === "string") return uri.split(/[/\\]/).pop();
  }
  return undefined;
}

test("matches on workoutId + workoutExerciseId", () => {
  const image = findExerciseImage({
    workoutId: "reformer-pilates",
    workoutExerciseId: "e1",
  });
  assert.equal(fileOf(image), "the-hundred.webp");
});

test("falls back to workoutExerciseId alone when no/wrong workoutId", () => {
  // "y3" lives in morning-yoga; with no workoutId it should still resolve.
  const noWorkout = findExerciseImage({ workoutExerciseId: "y3" });
  assert.equal(fileOf(noWorkout), "downward-dog.webp");

  // A workoutId that doesn't contain the exercise should not block the
  // id-only fallback from finding it elsewhere.
  const wrongWorkout = findExerciseImage({
    workoutId: "hiit-burn",
    workoutExerciseId: "y3",
  });
  assert.equal(fileOf(wrongWorkout), "downward-dog.webp");
});

test("matches on exercise name, case-insensitively and trimmed", () => {
  const image = findExerciseImage({ name: "  dOwNwArD dOg  " });
  assert.equal(fileOf(image), "downward-dog.webp");
});

test("returns undefined when nothing matches", () => {
  assert.equal(findExerciseImage({}), undefined);
  assert.equal(
    findExerciseImage({
      workoutId: "no-such-workout",
      workoutExerciseId: "no-such-exercise",
      name: "Not A Real Exercise",
    }),
    undefined,
  );
});
