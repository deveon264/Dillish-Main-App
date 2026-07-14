import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildNotifications,
  type WaterLog,
  type CalorieLog,
  type WorkoutCompletion,
} from "@/lib/notifications";
import { dayKeyOf } from "@/lib/streak";
import { DEFAULT_PROFILE } from "@/lib/profile";

// `buildNotifications` derives its day key from the real local date, so anchor
// every fixture to "today" the same way the builder does. A timestamp inside
// today's key counts as a today-event; everything else is yesterday/older.
const TODAY = dayKeyOf();
const NOW = Date.now();
const YESTERDAY = NOW - 24 * 60 * 60 * 1000;

const WORKOUT_ID = `workout:${TODAY}`;
const HYDRATION_ID = `hydration:${TODAY}`;
const MEALS_ID = `meals:${TODAY}`;
const STREAK_ID = `streak:${TODAY}`;

// A profile whose water goal is a plain round number so the remaining-liters
// wording is easy to assert against.
const PROFILE = { ...DEFAULT_PROFILE, waterGoalMl: 2000 };

function waterMetToday(): WaterLog[] {
  return [{ id: "w1", amountMl: 2500, ts: NOW }];
}
function mealLoggedToday(): CalorieLog[] {
  return [
    { id: "c1", name: "Lunch", kcal: 500, protein: 30, carbs: 40, fats: 15, ts: NOW },
  ];
}
function workoutDoneToday(): WorkoutCompletion[] {
  return [{ id: "k1", workoutId: "wk1", ts: NOW, kcal: 300, durationMin: 30 }];
}

// Builds the feed with every always-on nudge silenced by default (water met,
// a meal logged, a workout done, no streak milestone, no new best), so a test
// can flip exactly one slice and observe the single card it cares about.
function buildWith(
  overrides: Partial<{
    waterLogs: WaterLog[];
    calorieLogs: CalorieLog[];
    completions: WorkoutCompletion[];
    profile: typeof PROFILE;
    streak: number;
    newBest: number | null;
  }>
) {
  return buildNotifications({
    waterLogs: waterMetToday(),
    calorieLogs: mealLoggedToday(),
    completions: workoutDoneToday(),
    profile: PROFILE,
    streak: 0,
    newBest: null,
    ...overrides,
  });
}

// =========================================================================
// Workout card: "today's workout is waiting".
// =========================================================================

test("workout card fires with the new-streak body when no workout today and streak is 0", () => {
  const out = buildWith({ completions: [], streak: 0 });
  const card = out.find((n) => n.id === WORKOUT_ID);
  assert.ok(card, "workout card fires when nothing is logged today");
  assert.equal(card.title, "Today's workout is waiting");
  assert.equal(card.tone, "accent");
  assert.equal(card.icon, "barbell-outline");
  assert.equal(card.body, "Move your body today and start a new streak.");
});

test("workout card uses the streak-aware body when a streak is alive", () => {
  const out = buildWith({ completions: [], streak: 5 });
  const card = out.find((n) => n.id === WORKOUT_ID);
  assert.ok(card);
  assert.equal(card.body, "Keep your 5-day streak alive. Finish today's session.");
});

test("a workout logged yesterday still counts as no workout today", () => {
  const out = buildWith({
    completions: [{ id: "k0", workoutId: "wk0", ts: YESTERDAY, kcal: 300, durationMin: 30 }],
    streak: 5,
  });
  assert.equal(out.some((n) => n.id === WORKOUT_ID), true);
});

test("workout card does not fire once a workout is logged today", () => {
  const out = buildWith({ completions: workoutDoneToday(), streak: 5 });
  assert.equal(out.some((n) => n.id === WORKOUT_ID), false);
  // And the workout branch being satisfied is what lets the milestone card show.
  assert.equal(out.some((n) => n.id === STREAK_ID), false); // 5 is not a milestone
});

// =========================================================================
// Hydration card: "time to hydrate".
// =========================================================================

test("hydration card fires below goal and formats the remaining liters", () => {
  // 2000 goal, 500 logged today => 1.5 L remaining.
  const out = buildWith({ waterLogs: [{ id: "w1", amountMl: 500, ts: NOW }] });
  const card = out.find((n) => n.id === HYDRATION_ID);
  assert.ok(card, "hydration card fires when today's water is below goal");
  assert.equal(card.title, "Time to hydrate");
  assert.equal(card.tone, "water");
  assert.equal(card.icon, "water-outline");
  assert.equal(card.body, "You're 1.5 L away from today's water goal.");
});

test("hydration card only counts today's water, not yesterday's", () => {
  // A big drink yesterday must not satisfy today's goal.
  const out = buildWith({
    waterLogs: [{ id: "wY", amountMl: 5000, ts: YESTERDAY }],
  });
  const card = out.find((n) => n.id === HYDRATION_ID);
  assert.ok(card);
  // Nothing logged today => full 2000 ml = 2.0 L remaining.
  assert.equal(card.body, "You're 2.0 L away from today's water goal.");
});

test("hydration card falls back to the 2500 ml default when the profile goal is 0", () => {
  // Goal 0 => default 2500; nothing logged today => 2.5 L remaining.
  const out = buildWith({
    profile: { ...PROFILE, waterGoalMl: 0 },
    waterLogs: [],
  });
  const card = out.find((n) => n.id === HYDRATION_ID);
  assert.ok(card, "the default goal still produces a hydration nudge");
  assert.equal(card.body, "You're 2.5 L away from today's water goal.");
});

test("hydration card does not fire when today's goal is met", () => {
  const out = buildWith({ waterLogs: waterMetToday() }); // 2500 >= 2000
  assert.equal(out.some((n) => n.id === HYDRATION_ID), false);
});

test("hydration card does not fire when today's water exactly equals the goal", () => {
  const out = buildWith({ waterLogs: [{ id: "w1", amountMl: 2000, ts: NOW }] });
  assert.equal(out.some((n) => n.id === HYDRATION_ID), false);
});

// =========================================================================
// Meals card: "log your meals".
// =========================================================================

test("meals card fires when no meal is logged today", () => {
  const out = buildWith({ calorieLogs: [] });
  const card = out.find((n) => n.id === MEALS_ID);
  assert.ok(card, "meals card fires when nothing is logged today");
  assert.equal(card.title, "Log your meals");
  assert.equal(card.tone, "coach");
  assert.equal(card.icon, "restaurant-outline");
  assert.equal(card.body, "Snap a photo of your food to keep your nutrition on track.");
});

test("a meal logged yesterday still counts as no meal today", () => {
  const out = buildWith({
    calorieLogs: [
      { id: "cY", name: "Dinner", kcal: 600, protein: 35, carbs: 50, fats: 20, ts: YESTERDAY },
    ],
  });
  assert.equal(out.some((n) => n.id === MEALS_ID), true);
});

test("meals card does not fire once a meal is logged today", () => {
  const out = buildWith({ calorieLogs: mealLoggedToday() });
  assert.equal(out.some((n) => n.id === MEALS_ID), false);
});

// =========================================================================
// Welcome card: greets a brand-new member who has no activity yet.
// =========================================================================

test("welcome card fires for a new member with no activity and sits on top", () => {
  const out = buildWith({ waterLogs: [], calorieLogs: [], completions: [] });
  const card = out.find((n) => n.id === "welcome");
  assert.ok(card, "welcome card fires when the member has no activity at all");
  assert.equal(out[0].id, "welcome", "welcome sits at the top of the feed");
  assert.equal(card.title, "Welcome to Florish! 🌸");
  assert.equal(card.tone, "accent");
  assert.equal(card.icon, "sparkles-outline");
});

test("welcome card does not fire once the member has any activity", () => {
  // Default buildWith has water met, a meal, and a workout logged today.
  assert.equal(buildWith({}).some((n) => n.id === "welcome"), false);
  // Partial activity (only today's workout missing) is still not a new member.
  assert.equal(
    buildWith({ completions: [], streak: 0 }).some((n) => n.id === "welcome"),
    false
  );
});
