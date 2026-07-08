import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";

// constants/workouts.ts require()s real image assets; stub the loaders so the
// seed catalog can be validated here (same pattern as find-exercise-image).
const ext = (Module as unknown as { _extensions: Record<string, unknown> })._extensions;
for (const e of [".webp", ".png", ".jpg", ".jpeg"]) {
  ext[e] = (m: { exports: unknown }, filename: string) => {
    m.exports = { uri: filename };
  };
}
const req = createRequire(import.meta.url);
const { WORKOUTS, CATEGORIES } = req("@/constants/workouts") as typeof import("@/constants/workouts");

import { PROGRAMS } from "@/constants/programs";
import { workoutDurationMinutes, DEFAULT_REST_GAP } from "@/lib/workoutDuration";
import { GOAL_IDS } from "@/lib/profile";

test("catalog has at least 20 workouts with unique ids", () => {
  assert.ok(WORKOUTS.length >= 20, `only ${WORKOUTS.length} workouts`);
  const ids = new Set(WORKOUTS.map((w) => w.id));
  assert.equal(ids.size, WORKOUTS.length);
});

test("every workout is fully tagged for recommendations", () => {
  for (const w of WORKOUTS) {
    assert.ok(w.primaryGoals.length > 0, `${w.id}: no primaryGoals`);
    assert.ok(Array.isArray(w.equipment), `${w.id}: no equipment array`);
    assert.ok(w.bodyFocus.length > 0, `${w.id}: no bodyFocus`);
    assert.ok(Array.isArray(w.suitableFor), `${w.id}: no suitableFor`);
    assert.ok(["low", "moderate", "high"].includes(w.intensity), `${w.id}: bad intensity`);
  }
});

test("every workout has real exercises with cues and timing", () => {
  for (const w of WORKOUTS) {
    assert.ok(w.exercises.length >= 3, `${w.id}: only ${w.exercises.length} exercises`);
    const exIds = new Set(w.exercises.map((e) => e.id));
    assert.equal(exIds.size, w.exercises.length, `${w.id}: duplicate exercise ids`);
    for (const e of w.exercises) {
      assert.ok(e.name.trim(), `${w.id}/${e.id}: empty name`);
      assert.ok(e.cues.length > 0 && e.cues.every((c) => c.trim()), `${w.id}/${e.id}: empty cues`);
      assert.ok(e.modifications.trim(), `${w.id}/${e.id}: empty modifications`);
      assert.ok(e.sets > 0, `${w.id}/${e.id}: sets ${e.sets}`);
      assert.ok(e.seconds > 0, `${w.id}/${e.id}: seconds ${e.seconds}`);
    }
  }
});

test("authored durationMin roughly matches computed session length", () => {
  for (const w of WORKOUTS) {
    const computed = workoutDurationMinutes(w.exercises, DEFAULT_REST_GAP);
    assert.ok(
      Math.abs(w.durationMin - computed) <= 10,
      `${w.id}: durationMin ${w.durationMin} vs computed ${computed}`
    );
  }
});

test("no jumping moves inside no_jumping or low_impact workouts", () => {
  const jumpingNames = ["jumping jacks", "squat jumps", "burpees", "high knees"];
  for (const w of WORKOUTS) {
    const claims = w.suitableFor.includes("no_jumping") || w.suitableFor.includes("low_impact");
    if (!claims) continue;
    for (const e of w.exercises) {
      assert.ok(
        !jumpingNames.includes(e.name.trim().toLowerCase()),
        `${w.id} claims no_jumping/low_impact but contains ${e.name}`
      );
    }
  }
});

test("workout categories and focusAreas stay within the filter chip list", () => {
  for (const w of WORKOUTS) {
    assert.ok(CATEGORIES.includes(w.category), `${w.id}: unknown category ${w.category}`);
    for (const f of w.focusAreas ?? []) {
      assert.ok(CATEGORIES.includes(f), `${w.id}: unknown focusArea ${f}`);
    }
  }
});

test("new filter chips each match at least one workout", () => {
  for (const chip of ["Mobility", "Stretch", "Low Impact", "Recovery"]) {
    const hit = WORKOUTS.some((w) => w.category === chip || w.focusAreas?.includes(chip));
    assert.ok(hit, `no workout matches the ${chip} chip`);
  }
});

test("programs reference real workouts and are structurally sound", () => {
  const ids = new Set(WORKOUTS.map((w) => w.id));
  for (const p of PROGRAMS) {
    assert.ok(p.weeks.length > 0, `${p.id}: no weeks`);
    for (const [i, days] of p.weeks.entries()) {
      assert.equal(days.length, 7, `${p.id}: week ${i + 1} has ${days.length} days`);
      assert.ok(days.some((d) => d.workoutId === null), `${p.id}: week ${i + 1} has no rest day`);
      assert.ok(days.some((d) => d.workoutId !== null), `${p.id}: week ${i + 1} has no workout day`);
      for (const day of days) {
        if (day.workoutId) assert.ok(ids.has(day.workoutId), `${p.id}: unknown workout ${day.workoutId}`);
      }
    }
  }
});

test("every goal has a program", () => {
  const covered = new Set(PROGRAMS.map((p) => p.goal));
  for (const goal of GOAL_IDS) {
    assert.ok(covered.has(goal), `no program for ${goal}`);
  }
});
