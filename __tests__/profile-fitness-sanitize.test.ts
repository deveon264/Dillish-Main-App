import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PROFILE,
  sanitizeProfilePatch,
  sanitizeProfile,
  isDefaultProfile,
  hasFitnessProfile,
  secondaryGoalsOf,
} from "@/lib/profile";

test("fitness enum fields keep valid values and drop garbage", () => {
  const out = sanitizeProfilePatch({
    primaryGoal: "tone",
    fitnessLevel: "beginner",
    durationPreference: "20_30",
  });
  assert.equal(out.primaryGoal, "tone");
  assert.equal(out.fitnessLevel, "beginner");
  assert.equal(out.durationPreference, "20_30");

  const bad = sanitizeProfilePatch({
    primaryGoal: "get-swole",
    fitnessLevel: "ultra",
    durationPreference: "90_plus",
  });
  assert.equal("primaryGoal" in bad, false);
  assert.equal("fitnessLevel" in bad, false);
  assert.equal("durationPreference" in bad, false);
});

test("explicit nulls are preserved for nullable fitness fields", () => {
  const out = sanitizeProfilePatch({
    primaryGoal: null,
    fitnessLevel: null,
    durationPreference: null,
    daysPerWeek: null,
    programId: null,
    programStartedAt: null,
  });
  assert.equal(out.primaryGoal, null);
  assert.equal(out.fitnessLevel, null);
  assert.equal(out.durationPreference, null);
  assert.equal(out.daysPerWeek, null);
  assert.equal(out.programId, null);
  assert.equal(out.programStartedAt, null);
});

test("array fields filter to enum members and dedupe", () => {
  const out = sanitizeProfilePatch({
    equipment: ["dumbbells", "dumbbells", "lightsabers", "yoga_mat", 42, null],
    bodyFocus: ["glutes", "glutes", "wings"],
    limitations: ["no_jumping", "none", "no_jumping", "knee_friendly"],
  });
  assert.deepEqual(out.equipment, ["dumbbells", "yoga_mat"]);
  assert.deepEqual(out.bodyFocus, ["glutes"]);
  // "none" is a UI answer, never a stored limitation value.
  assert.deepEqual(out.limitations, ["no_jumping", "knee_friendly"]);
});

test("daysPerWeek is clamped to 2..6 and rounded", () => {
  assert.equal(sanitizeProfilePatch({ daysPerWeek: 4 }).daysPerWeek, 4);
  assert.equal(sanitizeProfilePatch({ daysPerWeek: 1 }).daysPerWeek, 2);
  assert.equal(sanitizeProfilePatch({ daysPerWeek: 9 }).daysPerWeek, 6);
  assert.equal(sanitizeProfilePatch({ daysPerWeek: 3.6 }).daysPerWeek, 4);
  assert.equal("daysPerWeek" in sanitizeProfilePatch({ daysPerWeek: "lots" }), false);
});

test("programId and programStartedAt validate shape", () => {
  const out = sanitizeProfilePatch({ programId: "  tone-sculpt-4w  ", programStartedAt: 1751900000000 });
  assert.equal(out.programId, "tone-sculpt-4w");
  assert.equal(out.programStartedAt, 1751900000000);

  const bad = sanitizeProfilePatch({ programId: "   ", programStartedAt: -5 });
  assert.equal("programId" in bad, false);
  assert.equal("programStartedAt" in bad, false);
});

test("legacy profile blobs (no fitness keys) sanitize to fitness defaults", () => {
  const legacy = { goals: ["tone"], calorieGoal: 2000 };
  const full = sanitizeProfile(legacy);
  assert.equal(full.primaryGoal, null);
  assert.equal(full.fitnessLevel, null);
  assert.deepEqual(full.equipment, []);
  assert.deepEqual(full.limitations, []);
  assert.equal(full.programId, null);
  assert.equal(hasFitnessProfile(full), false);
});

test("isDefaultProfile turns false once any fitness field is set", () => {
  assert.equal(isDefaultProfile(DEFAULT_PROFILE), true);
  assert.equal(isDefaultProfile({ ...DEFAULT_PROFILE, fitnessLevel: "beginner" }), false);
  assert.equal(isDefaultProfile({ ...DEFAULT_PROFILE, equipment: ["dumbbells"] }), false);
  assert.equal(isDefaultProfile({ ...DEFAULT_PROFILE, programId: "tone-sculpt-4w" }), false);
});

test("secondaryGoalsOf derives goals minus primary", () => {
  const p = { ...DEFAULT_PROFILE, goals: ["tone", "energy", "wellness"], primaryGoal: "tone" };
  assert.deepEqual(secondaryGoalsOf(p), ["energy", "wellness"]);
  assert.deepEqual(secondaryGoalsOf({ ...p, primaryGoal: null }), ["tone", "energy", "wellness"]);
});
