import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_PROFILE, type Profile } from "@/lib/profile";
import {
  scoreWorkout,
  getRecommendedWorkouts,
  getRecommendedProgram,
  type RecWorkout,
} from "@/lib/recommendation";
import { PROGRAMS } from "@/constants/programs";

const prof = (over: Partial<Profile>): Profile => ({ ...DEFAULT_PROFILE, ...over });

const wk = (over: Partial<RecWorkout> & { id: string }): RecWorkout => ({
  title: over.id,
  level: "Beginner",
  durationMin: 25,
  category: "Strength",
  primaryGoals: [],
  secondaryGoals: [],
  equipment: [],
  bodyFocus: [],
  suitableFor: [],
  intensity: "moderate",
  ...over,
});

const fitProfile = prof({
  goals: ["tone", "energy"],
  primaryGoal: "tone",
  fitnessLevel: "beginner",
  durationPreference: "20_30",
  bodyFocus: ["glutes"],
});

test("primary goal match outranks secondary goal match", () => {
  const primaryHit = wk({ id: "a", primaryGoals: ["tone"] });
  const secondaryHit = wk({ id: "b", secondaryGoals: ["tone"] });
  assert.ok(scoreWorkout(fitProfile, primaryHit) > scoreWorkout(fitProfile, secondaryHit));
});

test("exact level match outranks adjacent level", () => {
  const exact = wk({ id: "a", level: "Beginner" });
  const adjacent = wk({ id: "b", level: "Intermediate" });
  assert.ok(scoreWorkout(fitProfile, exact) > scoreWorkout(fitProfile, adjacent));
});

test("duration band scores exact > adjacent > distant", () => {
  const inBand = wk({ id: "a", durationMin: 25 }); // 20_30
  const adjacent = wk({ id: "b", durationMin: 12 }); // 10_15
  const far = wk({ id: "c", durationMin: 60 }); // 45_plus (two bands away)
  const s = (w: RecWorkout) => scoreWorkout(fitProfile, w);
  assert.ok(s(inBand) > s(adjacent));
  assert.ok(s(adjacent) > s(far));
});

test("body focus overlap scores and caps at two areas", () => {
  const p = prof({ ...fitProfile, bodyFocus: ["glutes", "legs", "core_abs"] });
  const one = wk({ id: "a", bodyFocus: ["glutes"] });
  const three = wk({ id: "b", bodyFocus: ["glutes", "legs", "core_abs"] });
  const diff = scoreWorkout(p, three) - scoreWorkout(p, one);
  assert.equal(diff, 8); // capped at 16 total, so only one extra area counts
});

test("secondary goal contributions cap", () => {
  const p = prof({
    goals: ["tone", "energy", "wellness", "flexibility"],
    primaryGoal: "tone",
    fitnessLevel: "beginner",
  });
  // Three secondary goals all hitting primaryGoals would be 36 uncapped.
  const many = wk({ id: "a", primaryGoals: ["energy", "wellness", "flexibility"] });
  const two = wk({ id: "b", primaryGoals: ["energy", "wellness"] });
  assert.equal(scoreWorkout(p, many), scoreWorkout(p, two)); // both capped at 24
});

test("ranking is deterministic with title tie-break", () => {
  const twin1 = wk({ id: "b-twin", title: "B Twin", primaryGoals: ["tone"] });
  const twin2 = wk({ id: "a-twin", title: "A Twin", primaryGoals: ["tone"] });
  const ranked = getRecommendedWorkouts(fitProfile, [twin1, twin2]);
  assert.deepEqual(ranked.map((w) => w.title), ["A Twin", "B Twin"]);
});

test("no fitness profile falls back to gentle beginner ordering, never empty", () => {
  const noProfile = prof({ goals: ["strength"] }); // fitnessLevel null
  const advanced = wk({ id: "adv", level: "Advanced", intensity: "high", bodyFocus: ["full_body"] });
  const gentle = wk({ id: "gentle", level: "Beginner", intensity: "low", bodyFocus: ["mobility"] });
  const beginnerArms = wk({ id: "arms", level: "Beginner", intensity: "moderate", bodyFocus: ["arms"] });
  const ranked = getRecommendedWorkouts(noProfile, [advanced, beginnerArms, gentle]);
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].id, "gentle");
  assert.equal(ranked[ranked.length - 1].id, "adv");
});

test("getRecommendedProgram matches primary goal and level", () => {
  const p = prof({ goals: ["tone"], primaryGoal: "tone", fitnessLevel: "beginner" });
  const program = getRecommendedProgram(p, PROGRAMS);
  assert.equal(program?.id, "tone-sculpt-4w");

  // Falls back to goals[0] when no primary set; null when no goals at all.
  const noPrimary = prof({ goals: ["flexibility"] });
  assert.equal(getRecommendedProgram(noPrimary, PROGRAMS)?.id, "flexibility-reset-14d");
  assert.equal(getRecommendedProgram(prof({}), PROGRAMS), null);
});

test("every goal id has a program", () => {
  for (const goal of ["lose-weight", "tone", "strength", "flexibility", "wellness", "energy"]) {
    const p = prof({ goals: [goal], primaryGoal: goal, fitnessLevel: "beginner" });
    assert.ok(getRecommendedProgram(p, PROGRAMS), `no program for goal ${goal}`);
  }
});

test("getRecommendedProgram picks the phase from fitness level", () => {
  const at = (fitnessLevel: Profile["fitnessLevel"]) =>
    getRecommendedProgram(prof({ goals: ["tone"], primaryGoal: "tone", fitnessLevel }), PROGRAMS);
  assert.equal(at("beginner")?.id, "tone-sculpt-4w"); // phase 1
  assert.equal(at("intermediate")?.id, "sculpt-define-4w"); // phase 2
  assert.equal(at("advanced")?.id, "sculpt-define-4w"); // phase 2
  assert.equal(at(null)?.phase, 1); // unknown level starts the journey
});

test("intermediate users of every goal land on a phase-2 program", () => {
  for (const goal of ["lose-weight", "tone", "strength", "flexibility", "wellness", "energy"]) {
    const p = prof({ goals: [goal], primaryGoal: goal, fitnessLevel: "intermediate" });
    const program = getRecommendedProgram(p, PROGRAMS);
    assert.equal(program?.phase, 2, `goal ${goal} gave ${program?.id ?? "nothing"}`);
  }
});

test("a goal with only phase-1 programs still resolves for intermediate users", () => {
  const only1 = PROGRAMS.filter((p) => p.goal === "tone" && p.phase === 1);
  const p = prof({ goals: ["tone"], primaryGoal: "tone", fitnessLevel: "intermediate" });
  assert.equal(getRecommendedProgram(p, only1)?.id, "tone-sculpt-4w");
});
