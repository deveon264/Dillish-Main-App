import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";

import {
  mapMuscle,
  mapEquipment,
  mapLevel,
  keepCategory,
  toDbExercise,
  type RawDbExercise,
} from "@/lib/exerciseDbMapping";
import { EXERCISE_DB, getDbExercise, findDbExerciseByName } from "@/constants/exerciseDb";
import { BODY_FOCUS_IDS, EQUIPMENT_IDS, FITNESS_LEVELS } from "@/lib/profile";

// constants/workouts.ts require()s image assets; stub the loaders so the seed
// catalog can be inspected (same pattern as find-exercise-image.test.ts).
const ext = (Module as unknown as { _extensions: Record<string, unknown> })._extensions;
for (const e of [".webp", ".png", ".jpg", ".jpeg"]) {
  ext[e] = (m: { exports: unknown }, filename: string) => {
    m.exports = { uri: filename };
  };
}
const req = createRequire(import.meta.url);
const { WORKOUTS } = req("@/constants/workouts") as typeof import("@/constants/workouts");

// --- mapping layer (the exact example mappings from the task) ---

test("muscle mapping covers the repo vocabulary", () => {
  assert.equal(mapMuscle("abdominals"), "core_abs");
  assert.equal(mapMuscle("glutes"), "glutes");
  assert.equal(mapMuscle("quadriceps"), "legs");
  assert.equal(mapMuscle("lats"), "back_posture");
  assert.equal(mapMuscle("chest"), "upper_body");
  assert.equal(mapMuscle("biceps"), "arms");
  assert.equal(mapMuscle("wings"), null);
});

test("equipment mapping covers the repo vocabulary", () => {
  assert.deepEqual(mapEquipment("body only"), []);
  assert.deepEqual(mapEquipment(null), []);
  assert.deepEqual(mapEquipment("dumbbell"), ["dumbbells"]);
  assert.deepEqual(mapEquipment("bands"), ["resistance_bands"]);
  assert.deepEqual(mapEquipment("exercise ball"), ["pilates_equipment"]);
  assert.deepEqual(mapEquipment("barbell"), ["gym_equipment"]);
  assert.equal(mapEquipment("foam roll"), null);
  assert.equal(mapEquipment("hovercraft"), null);
});

test("level and category mapping", () => {
  assert.equal(mapLevel("beginner"), "beginner");
  assert.equal(mapLevel("expert"), "advanced");
  assert.equal(mapLevel("legendary"), null);
  assert.equal(keepCategory("strength"), true);
  assert.equal(keepCategory("stretching"), true);
  assert.equal(keepCategory("strongman"), false);
  assert.equal(keepCategory("powerlifting"), false);
});

test("toDbExercise converts a valid record and rejects excluded ones", () => {
  const raw: RawDbExercise = {
    id: "Test_Move",
    name: "Test Move",
    force: "push",
    level: "beginner",
    mechanic: "compound",
    equipment: "body only",
    primaryMuscles: ["abdominals", "glutes"],
    secondaryMuscles: ["quadriceps"],
    instructions: ["Do the thing.", "Do it again."],
    category: "strength",
  };
  const out = toDbExercise(raw);
  assert.ok(out);
  assert.deepEqual(out!.muscleGroups, ["core_abs", "glutes"]);
  assert.deepEqual(out!.equipment, []);
  assert.ok(out!.tags.includes("force:push"));
  assert.ok(out!.tags.includes("secondary:legs"));

  assert.equal(toDbExercise({ ...raw, category: "strongman" }), null);
  assert.equal(toDbExercise({ ...raw, equipment: "foam roll" }), null);
  assert.equal(toDbExercise({ ...raw, instructions: [] }), null);
});

// --- generated database integrity ---

test("EXERCISE_DB is curated, unique, and fully valid", () => {
  assert.ok(EXERCISE_DB.length >= 200 && EXERCISE_DB.length <= 500, `size ${EXERCISE_DB.length}`);
  const ids = new Set(EXERCISE_DB.map((e) => e.id));
  assert.equal(ids.size, EXERCISE_DB.length);
  for (const e of EXERCISE_DB) {
    assert.ok(e.name.trim(), `${e.id}: empty name`);
    assert.ok(e.instructions.length > 0 && e.instructions.every((s) => s.trim()), `${e.id}: instructions`);
    assert.ok(e.muscleGroups.length > 0, `${e.id}: muscleGroups`);
    for (const m of e.muscleGroups) assert.ok((BODY_FOCUS_IDS as readonly string[]).includes(m), `${e.id}: ${m}`);
    for (const q of e.equipment) assert.ok((EQUIPMENT_IDS as readonly string[]).includes(q), `${e.id}: ${q}`);
    assert.ok((FITNESS_LEVELS as readonly string[]).includes(e.level), `${e.id}: ${e.level}`);
    assert.ok(["strength", "stretching", "cardio", "plyometrics"].includes(e.category), `${e.id}: ${e.category}`);
  }
});

test("lookups work by id and name", () => {
  assert.equal(getDbExercise("Plank")?.name, "Plank");
  assert.equal(findDbExerciseByName("plank")?.id, "Plank");
  assert.equal(getDbExercise("Nope"), undefined);
});

test("first-party entries exist and are tagged", () => {
  for (const id of ["FP_March_In_Place", "FP_Side_Steps", "FP_Standing_Knee_Drive", "FP_Standing_Punches", "FP_Standing_Core_Twist", "FP_Bicycle_Crunch"]) {
    const e = getDbExercise(id);
    assert.ok(e, `${id} missing`);
    assert.ok(e!.tags.includes("first-party"), `${id} not tagged first-party`);
  }
});

// --- workout attachment ---

const namesOf = (workoutId: string) => {
  const w = WORKOUTS.find((w) => w.id === workoutId);
  assert.ok(w, `${workoutId} missing`);
  return w!.exercises.map((e) => e.name);
};

test("Full Body Sculpt uses the requested bodyweight exercise list", () => {
  const names = namesOf("full-body-sculpt");
  for (const n of ["Bodyweight Squat", "Reverse Lunge", "Glute Bridge", "Knee Push-up", "Plank", "Mountain Climbers", "Dead Bug"]) {
    assert.ok(names.includes(n), `missing ${n} (got ${names.join(", ")})`);
  }
  const w = WORKOUTS.find((w) => w.id === "full-body-sculpt")!;
  assert.deepEqual(w.equipment, [], "Full Body Sculpt should be bodyweight now");
});

test("Core Define uses the requested exercise list", () => {
  const names = namesOf("core-define");
  for (const n of ["Dead Bug", "Plank", "Bicycle Crunch", "Side Plank", "Leg Raises", "Russian Twist"]) {
    assert.ok(names.includes(n), `missing ${n} (got ${names.join(", ")})`);
  }
});

test("Low Impact Sweat uses the requested exercise list", () => {
  const names = namesOf("low-impact-sweat");
  for (const n of ["March in Place", "Side Steps", "Bodyweight Squat", "Standing Knee Drive", "Step-Back Lunge", "Standing Punches", "Standing Core Twists", "Cooldown Stretch"]) {
    assert.ok(names.includes(n), `missing ${n} (got ${names.join(", ")})`);
  }
});

test("database-backed workout exercises carry metadata", () => {
  const w = WORKOUTS.find((w) => w.id === "full-body-sculpt")!;
  const squat = w.exercises.find((e) => e.name === "Bodyweight Squat")!;
  assert.ok(squat.muscleGroups && squat.muscleGroups.length > 0);
  assert.deepEqual(squat.equipmentNeeded, []);
  assert.equal(squat.level, "beginner");
  assert.ok(squat.cues.length >= 1 && squat.cues.length <= 4);
});
