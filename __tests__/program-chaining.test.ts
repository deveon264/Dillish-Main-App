import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_PROFILE, type Profile } from "@/lib/profile";
import { getTodayWorkout, type RecWorkout } from "@/lib/recommendation";
import { PROGRAMS } from "@/constants/programs";
import { flattenProgram } from "@/lib/programProgress";

// The chaining flow end to end: finishing a phase-1 program surfaces its
// phase-2 continuation, and starting that continuation puts the user on its
// day 1. Uses synthetic workouts (one per id referenced by the programs) so
// the test stays react-native-free.

const prof = (over: Partial<Profile>): Profile => ({ ...DEFAULT_PROFILE, ...over });

const wk = (id: string): RecWorkout & { id: string } => ({
  id,
  title: id,
  level: "Beginner",
  durationMin: 20,
  category: "Strength",
  primaryGoals: [],
  secondaryGoals: [],
  equipment: [],
  bodyFocus: [],
  suitableFor: [],
  intensity: "moderate",
});

const WORKOUT_IDS = [
  ...new Set(
    PROGRAMS.flatMap((p) => p.weeks.flat().map((d) => d.workoutId)).filter(
      (id): id is string => !!id
    )
  ),
];
const WORKOUTS = WORKOUT_IDS.map(wk);

const DAY_MS = 86_400_000;
const dayKeyOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);

const phase1 = PROGRAMS.find((p) => p.id === "energy-boost-7d")!;
const phase2 = PROGRAMS.find((p) => p.id === phase1.nextProgramId)!;

const startTs = Date.UTC(2026, 0, 5); // a Monday, far from DST concerns in UTC keys

// One completion per program workout day, each on its own calendar day.
function completeAll(program: typeof phase1, from: number) {
  return flattenProgram(program).map((entry, i) => ({
    workoutId: entry.workoutId,
    ts: from + i * DAY_MS + 3_600_000,
  }));
}

test("finishing a phase-1 program surfaces its phase-2 continuation", () => {
  const profile = prof({
    goals: ["energy"],
    primaryGoal: "energy",
    fitnessLevel: "beginner",
    programId: phase1.id,
    programStartedAt: startTs,
  });
  const completions = completeAll(phase1, startTs);

  const today = getTodayWorkout(profile, completions, WORKOUTS, PROGRAMS, dayKeyOf);
  assert.ok(today, "expected a today plan");
  assert.equal(today.programComplete, true);
  assert.equal(today.program?.id, phase1.id);
  assert.equal(today.nextProgram?.id, phase2.id, "phase 2 should be offered");
});

test("starting the offered phase 2 lands on its day 1", () => {
  const completions = completeAll(phase1, startTs);
  const phase2Start = startTs + 30 * DAY_MS;
  const profile = prof({
    goals: ["energy"],
    primaryGoal: "energy",
    fitnessLevel: "beginner",
    programId: phase2.id,
    programStartedAt: phase2Start,
  });

  const today = getTodayWorkout(profile, completions, WORKOUTS, PROGRAMS, dayKeyOf);
  assert.ok(today, "expected a today plan");
  assert.equal(today.source, "program");
  assert.equal(today.program?.id, phase2.id);
  const firstEntry = flattenProgram(phase2)[0];
  assert.equal(today.dayNumber, firstEntry.dayNumber);
  assert.equal(today.workout.id, firstEntry.workoutId);
});

test("finishing a phase-2 program offers nothing further", () => {
  const phase2Start = startTs + 30 * DAY_MS;
  const profile = prof({
    goals: ["energy"],
    primaryGoal: "energy",
    fitnessLevel: "beginner",
    programId: phase2.id,
    programStartedAt: phase2Start,
  });
  const completions = completeAll(phase2, phase2Start);

  const today = getTodayWorkout(profile, completions, WORKOUTS, PROGRAMS, dayKeyOf);
  assert.ok(today, "expected a today plan");
  assert.equal(today.programComplete, true);
  assert.equal(today.nextProgram, undefined);
});
