import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_REST_GAP,
  exerciseSets,
  exerciseSetSeconds,
  exerciseTimedSeconds,
  workoutDurationMinutes,
  workoutRestSeconds,
  workoutSessionSeconds,
  workoutTimedSeconds,
  type TimedExercise,
} from "@/lib/workoutDuration";

const REFORMER_EXERCISES: TimedExercise[] = [
  { sets: 3, seconds: 60 },
  { sets: 3, seconds: 50 },
  { sets: 2, seconds: 60 },
  { sets: 3, seconds: 45 },
  { sets: 3, seconds: 60 },
  { sets: 2, seconds: 50 },
  { sets: 2, seconds: 50 },
  { sets: 2, seconds: 45 },
];

test("reformer pilates duration is calculated from sets, seconds, and rests between sets AND exercises", () => {
  assert.equal(exerciseSetSeconds(REFORMER_EXERCISES[0]), 60);
  assert.equal(exerciseSets(REFORMER_EXERCISES[0]), 3);
  assert.equal(exerciseTimedSeconds(REFORMER_EXERCISES[0]), 180);
  assert.equal(workoutTimedSeconds(REFORMER_EXERCISES), 1055);
  // 20 total sets -> 12 rests between sets, plus 7 between exercises = 19 gaps.
  assert.equal(workoutRestSeconds(REFORMER_EXERCISES, DEFAULT_REST_GAP), 19 * 15);
  assert.equal(workoutSessionSeconds(REFORMER_EXERCISES, DEFAULT_REST_GAP), 1055 + 285);
  assert.equal(workoutDurationMinutes(REFORMER_EXERCISES, DEFAULT_REST_GAP), 23);
});

test("longer rest gaps increase the displayed session duration", () => {
  assert.equal(workoutDurationMinutes(REFORMER_EXERCISES, 30), 28);
});

test("single-set exercises add no inter-set rest and rest off zeroes all gaps", () => {
  const singles: TimedExercise[] = [{ seconds: 60 }, { sets: 1, seconds: 30 }];
  assert.equal(workoutRestSeconds(singles, 15), 15); // only between the two exercises
  assert.equal(workoutSessionSeconds(REFORMER_EXERCISES, 0), 1055);
});
