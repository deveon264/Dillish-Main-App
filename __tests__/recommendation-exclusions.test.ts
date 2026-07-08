import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";

// constants/workouts.ts require()s real image assets; stub the loaders so the
// real seed catalog can be ranked here (same pattern as find-exercise-image).
const ext = (Module as unknown as { _extensions: Record<string, unknown> })._extensions;
for (const e of [".webp", ".png", ".jpg", ".jpeg"]) {
  ext[e] = (m: { exports: unknown }, filename: string) => {
    m.exports = { uri: filename };
  };
}
const req = createRequire(import.meta.url);
const { WORKOUTS } = req("@/constants/workouts") as typeof import("@/constants/workouts");

import { DEFAULT_PROFILE, type Profile } from "@/lib/profile";
import { isEligible, getRecommendedWorkouts, rankForLibrary } from "@/lib/recommendation";

const prof = (over: Partial<Profile>): Profile => ({ ...DEFAULT_PROFILE, ...over });

const byId = (id: string) => {
  const w = WORKOUTS.find((w) => w.id === id);
  assert.ok(w, `seed workout ${id} missing`);
  return w!;
};

test("workouts needing unavailable equipment are never recommended", () => {
  const noEquipment = prof({
    goals: ["tone"],
    primaryGoal: "tone",
    fitnessLevel: "intermediate",
    equipment: ["none"],
  });
  assert.equal(isEligible(noEquipment, byId("reformer-pilates")), false);
  assert.equal(isEligible(noEquipment, byId("full-body-dumbbell")), false);

  const ranked = getRecommendedWorkouts(noEquipment, WORKOUTS);
  assert.ok(ranked.length > 0);
  assert.ok(!ranked.some((w) => w.id === "reformer-pilates"));
  assert.ok(ranked.every((w) => w.equipment.length === 0));
});

test("Full Body Sculpt is bodyweight and eligible without equipment", () => {
  const noEquipment = prof({
    goals: ["tone"],
    primaryGoal: "tone",
    fitnessLevel: "intermediate",
    equipment: ["none"],
  });
  assert.equal(isEligible(noEquipment, byId("full-body-sculpt")), true);
});

test("pilates equipment unlocks the reformer workout", () => {
  const withReformer = prof({
    goals: ["tone"],
    primaryGoal: "tone",
    fitnessLevel: "intermediate",
    equipment: ["pilates_equipment", "yoga_mat"],
  });
  assert.equal(isEligible(withReformer, byId("reformer-pilates")), true);
});

test("gym equipment implies dumbbells", () => {
  const gymOnly = prof({
    goals: ["strength"],
    primaryGoal: "strength",
    fitnessLevel: "intermediate",
    equipment: ["gym_equipment"],
  });
  assert.equal(isEligible(gymOnly, byId("full-body-dumbbell")), true);
});

test("no_jumping users never receive jumping workouts", () => {
  const noJump = prof({
    goals: ["lose-weight"],
    primaryGoal: "lose-weight",
    fitnessLevel: "intermediate",
    equipment: ["none"],
    limitations: ["no_jumping"],
  });
  const ranked = getRecommendedWorkouts(noJump, WORKOUTS);
  assert.ok(ranked.length > 0);
  for (const banned of ["hiit-burn", "full-body-cardio-sculpt", "lower-body-power", "beginner-fat-burn"]) {
    assert.ok(!ranked.some((w) => w.id === banned), `${banned} leaked past no_jumping`);
  }
  // The purpose-built alternative should rank near the top.
  assert.ok(ranked.slice(0, 3).some((w) => w.id === "no-jumping-fat-burn"));
});

test("low impact only excludes advanced HIIT", () => {
  const lowImpact = prof({
    goals: ["lose-weight"],
    primaryGoal: "lose-weight",
    fitnessLevel: "advanced",
    equipment: ["none"],
    limitations: ["low_impact"],
  });
  const ranked = getRecommendedWorkouts(lowImpact, WORKOUTS);
  assert.ok(!ranked.some((w) => w.id === "hiit-burn"));
  assert.ok(ranked.every((w) => w.suitableFor.includes("low_impact")));
});

test("beginners never receive Advanced workouts", () => {
  const beginner = prof({
    goals: ["strength"],
    primaryGoal: "strength",
    fitnessLevel: "beginner",
    equipment: ["dumbbells"],
  });
  const ranked = getRecommendedWorkouts(beginner, WORKOUTS);
  assert.ok(ranked.length > 0);
  assert.ok(ranked.every((w) => w.level !== "Advanced"));
});

test("library ranking keeps ineligible workouts browsable at the bottom", () => {
  const noEquipment = prof({
    goals: ["tone"],
    primaryGoal: "tone",
    fitnessLevel: "beginner",
    equipment: ["none"],
  });
  const ranked = rankForLibrary(noEquipment, WORKOUTS);
  assert.equal(ranked.length, WORKOUTS.length); // nothing hidden
  const firstIneligible = ranked.findIndex((w) => !isEligible(noEquipment, w));
  const lastEligible = ranked.map((w) => isEligible(noEquipment, w)).lastIndexOf(true);
  assert.ok(firstIneligible > lastEligible, "ineligible workout ranked above an eligible one");
});
