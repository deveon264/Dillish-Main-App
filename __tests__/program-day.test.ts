import { test } from "node:test";
import assert from "node:assert/strict";

import type { Program } from "@/constants/programs";
import { flattenProgram, deriveProgramProgress } from "@/lib/programProgress";
import { getTodayWorkout, type RecWorkout } from "@/lib/recommendation";
import { DEFAULT_PROFILE, type Profile } from "@/lib/profile";

const dayKeyOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 6, 1); // 2026-07-01

const program: Program = {
  id: "test-program",
  title: "Test Program",
  goal: "tone",
  level: "Beginner",
  phase: 1,
  description: "",
  weeks: [
    [
      { workoutId: "w-a" },
      { workoutId: null },
      { workoutId: "w-b" },
      { workoutId: null },
      { workoutId: "w-a" },
      { workoutId: "w-c" },
      { workoutId: null },
    ],
  ],
};

const done = (workoutId: string, daysAfterStart: number, offsetMs = 0) => ({
  workoutId,
  ts: START + daysAfterStart * DAY + offsetMs,
});

test("flattenProgram keeps calendar day numbers across rest days", () => {
  const entries = flattenProgram(program);
  assert.deepEqual(
    entries.map((e) => [e.dayNumber, e.workoutId]),
    [
      [1, "w-a"],
      [3, "w-b"],
      [5, "w-a"],
      [6, "w-c"],
    ]
  );
});

test("zero completions points at the first workout day", () => {
  const p = deriveProgramProgress(program, START, [], dayKeyOf);
  assert.equal(p.complete, false);
  if (!p.complete) {
    assert.equal(p.next.workoutId, "w-a");
    assert.equal(p.next.dayNumber, 1);
    assert.equal(p.totalWorkoutDays, 4);
  }
});

test("two completions on the same day advance only once", () => {
  const completions = [done("w-a", 0), done("w-a", 0, 3600_000)];
  const p = deriveProgramProgress(program, START, completions, dayKeyOf);
  assert.equal(p.complete, false);
  if (!p.complete) {
    assert.equal(p.daysAdvanced, 1);
    assert.equal(p.next.workoutId, "w-b");
    assert.equal(p.next.dayNumber, 3); // day 2 is rest, so next reads Day 3
  }
});

test("completions before program start and non-program workouts are ignored", () => {
  const completions = [
    { workoutId: "w-a", ts: START - DAY }, // before start
    done("unrelated-workout", 1),
  ];
  const p = deriveProgramProgress(program, START, completions, dayKeyOf);
  assert.equal(p.complete, false);
  if (!p.complete) assert.equal(p.daysAdvanced, 0);
});

test("completing every workout day finishes the program", () => {
  const completions = [done("w-a", 0), done("w-b", 2), done("w-a", 4), done("w-c", 5)];
  const p = deriveProgramProgress(program, START, completions, dayKeyOf);
  assert.equal(p.complete, true);
  assert.equal(p.daysAdvanced, 4);
});

// --- getTodayWorkout integration over the same synthetic program ---

const wk = (over: Partial<RecWorkout> & { id: string }): RecWorkout => ({
  title: over.id,
  level: "Beginner",
  durationMin: 25,
  category: "Strength",
  primaryGoals: ["tone"],
  secondaryGoals: [],
  equipment: [],
  bodyFocus: ["full_body"],
  suitableFor: ["no_jumping", "low_impact", "knee_friendly", "back_friendly", "postpartum_friendly"],
  intensity: "moderate",
  ...over,
});

const workouts = [
  wk({ id: "w-a" }),
  wk({ id: "w-b", equipment: ["pilates_equipment"], bodyFocus: ["core_abs"] }),
  wk({ id: "w-c", bodyFocus: ["core_abs"] }),
];

const onProgram: Profile = {
  ...DEFAULT_PROFILE,
  goals: ["tone"],
  primaryGoal: "tone",
  fitnessLevel: "beginner",
  equipment: ["none"],
  programId: "test-program",
  programStartedAt: START,
};

test("getTodayWorkout returns the scheduled program workout with its day number", () => {
  const today = getTodayWorkout(onProgram, [], workouts, [program], dayKeyOf);
  assert.ok(today);
  assert.equal(today!.source, "program");
  assert.equal(today!.workout.id, "w-a");
  assert.equal(today!.dayNumber, 1);
});

test("an ineligible scheduled workout is substituted, keeping the day label", () => {
  // Day 3 schedules w-b which needs pilates equipment the user lacks; the
  // substitute should share w-b's core_abs focus (w-c).
  const today = getTodayWorkout(onProgram, [done("w-a", 0)], workouts, [program], dayKeyOf);
  assert.ok(today);
  assert.equal(today!.source, "program");
  assert.equal(today!.dayNumber, 3);
  assert.equal(today!.workout.id, "w-c");
});

test("a finished program flips to recommendations with programComplete", () => {
  const completions = [done("w-a", 0), done("w-b", 2), done("w-a", 4), done("w-c", 5)];
  const today = getTodayWorkout(onProgram, completions, workouts, [program], dayKeyOf);
  assert.ok(today);
  assert.equal(today!.source, "recommended");
  assert.equal(today!.programComplete, true);
});

test("no fitness profile yields null so Home keeps its classic hero", () => {
  const today = getTodayWorkout(DEFAULT_PROFILE, [], workouts, [program], dayKeyOf);
  assert.equal(today, null);
});
