import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildNotifications,
  applyReadState,
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
const STREAK_ID = `streak:${TODAY}`;

// A profile whose water goal is already met (see `waterMetToday`) so the only
// cards that can fire are the streak milestone we are exercising here.
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

// Builds the feed with every other nudge silenced by default (water met, a meal
// logged, a workout done today, no new best), so each test can vary only the
// `streak` value and observe whether the milestone card appears.
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
// Milestone days: each of the seven milestone values emits the streak card
// with the exact id, title, icon and tone.
// =========================================================================

const MILESTONES = [3, 7, 14, 21, 30, 50, 100];

for (const day of MILESTONES) {
  test(`streak ${day} emits the milestone card with the correct id, title, icon and tone`, () => {
    const out = buildWith({ streak: day });
    const card = out.find((n) => n.id === STREAK_ID);
    assert.ok(card, `milestone card fires on a ${day}-day streak`);
    assert.equal(card.id, STREAK_ID);
    assert.equal(card.title, `${day}-day streak! 🔥`);
    assert.equal(card.icon, "flame-outline");
    assert.equal(card.tone, "highlight");
  });
}

// =========================================================================
// Non-milestone days: a representative spread of values must NOT emit the card.
// =========================================================================

const NON_MILESTONES = [1, 2, 4, 5, 6, 8, 29, 31, 99];

for (const day of NON_MILESTONES) {
  test(`streak ${day} does not emit the milestone card`, () => {
    const out = buildWith({ streak: day });
    assert.equal(out.some((n) => n.id === STREAK_ID), false);
  });
}

// =========================================================================
// Requires a workout today: a milestone streak alone is not enough, the
// member must have completed today's workout for the card to fire.
// =========================================================================

test("the milestone card does not fire when no workout is completed today", () => {
  const out = buildWith({ completions: [], streak: 7 });
  assert.equal(out.some((n) => n.id === STREAK_ID), false);
});

// =========================================================================
// PB suppression: when a personal best is being celebrated the same day, the
// generic milestone card is suppressed in favour of the bigger celebration.
// (The full personal-best story lives in pb-notification.test.ts.)
// =========================================================================

test("the milestone card is suppressed when a personal best fires the same day", () => {
  const out = buildWith({ streak: 7, newBest: 7 });
  assert.equal(out.some((n) => n.id === STREAK_ID), false);
  // Sanity: the PB card is what took its place.
  assert.equal(out.some((n) => n.id === `pb:${TODAY}`), true);
});

// =========================================================================
// Read-state round-trip: the milestone card is unread on first open, and read
// once its date-stable id is in the persisted read set.
// =========================================================================

test("the milestone card's read state round-trips through applyReadState", () => {
  const base = buildWith({ streak: 7 });
  assert.equal(base.some((n) => n.id === STREAK_ID), true);

  // First open: nothing read yet, the milestone card is unread.
  const fresh = applyReadState(base, []);
  const freshCard = fresh.find((n) => n.id === STREAK_ID);
  assert.ok(freshCard);
  assert.equal(freshCard.read, false);

  // Reopen the same day with the id persisted in the read set: now read.
  const rebuilt = applyReadState(buildWith({ streak: 7 }), [STREAK_ID]);
  const seenCard = rebuilt.find((n) => n.id === STREAK_ID);
  assert.ok(seenCard);
  assert.equal(seenCard.read, true);
});
