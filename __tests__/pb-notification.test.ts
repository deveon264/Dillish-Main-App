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
const PB_ID = `pb:${TODAY}`;
const STREAK_ID = `streak:${TODAY}`;

// A profile whose water goal is already met and a workout logged today, so the
// only "activity" notifications that can fire are the streak / personal-best
// ones we are actually exercising. Meals are logged so the meals nudge is off.
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

function buildAllQuiet(newBest: number | null, streak: number) {
  return buildNotifications({
    waterLogs: waterMetToday(),
    calorieLogs: mealLoggedToday(),
    completions: workoutDoneToday(),
    profile: PROFILE,
    streak,
    newBest,
  });
}

// =========================================================================
// A new personal best emits exactly one `pb:<day>` notification, and the
// generic streak milestone that would otherwise fire on a milestone day is
// suppressed so the member sees only the bigger celebration.
// =========================================================================

test("a new personal best emits one pb:<day> notification and suppresses the milestone", () => {
  // streak 7 is a milestone day, so without the PB the streak card would fire.
  const out = buildAllQuiet(7, 7);

  const pbCards = out.filter((n) => n.id === PB_ID);
  assert.equal(pbCards.length, 1, "exactly one personal-best notification");
  assert.equal(pbCards[0].title, "New personal best: 7 days! 🎉");
  assert.equal(pbCards[0].tone, "highlight");
  assert.equal(pbCards[0].icon, "trophy-outline");

  // The generic streak milestone is suppressed on the same day a PB fires.
  assert.equal(out.some((n) => n.id === STREAK_ID), false);
});

// =========================================================================
// The personal-best id is stable for the day (always `pb:<day>`), so once it
// is in the read set the rebuilt notification comes back marked read: reopening
// the app the same day does not resurface an already-seen celebration.
// =========================================================================

test("once pb:<day> is in the read set, the rebuilt notification is read", () => {
  const base = buildAllQuiet(7, 7);
  assert.equal(base.some((n) => n.id === PB_ID), true);

  // First open: nothing read yet, the PB card is unread.
  const fresh = applyReadState(base, []);
  const freshPb = fresh.find((n) => n.id === PB_ID);
  assert.ok(freshPb);
  assert.equal(freshPb.read, false);

  // Reopen the same day with the id persisted in the read set: now read.
  const rebuilt = applyReadState(buildAllQuiet(7, 7), [PB_ID]);
  const seenPb = rebuilt.find((n) => n.id === PB_ID);
  assert.ok(seenPb);
  assert.equal(seenPb.read, true);
});

// =========================================================================
// A singular best reads "1 day" (not "1 days").
// =========================================================================

test("a personal best of 1 uses the singular 'day'", () => {
  const out = buildNotifications({
    waterLogs: waterMetToday(),
    calorieLogs: mealLoggedToday(),
    completions: workoutDoneToday(),
    profile: PROFILE,
    streak: 1,
    newBest: 1,
  });
  const pb = out.find((n) => n.id === PB_ID);
  assert.ok(pb);
  assert.equal(pb.title, "New personal best: 1 day! 🎉");
});

// =========================================================================
// With no new best, no personal-best card is emitted, and the normal milestone
// notification fires on a milestone-streak day exactly as before.
// =========================================================================

test("newBest = null emits no pb card and the milestone fires normally", () => {
  const out = buildAllQuiet(null, 7);

  assert.equal(out.some((n) => n.id === PB_ID), false);

  // The generic streak milestone is back when nothing is being celebrated.
  const streakCard = out.find((n) => n.id === STREAK_ID);
  assert.ok(streakCard, "milestone notification fires on a milestone day");
  assert.equal(streakCard.title, "7-day streak! 🔥");
});

// =========================================================================
// newBest = 0 is treated as "nothing to celebrate" (a best of zero is not a
// record), so no personal-best card is emitted.
// =========================================================================

test("newBest = 0 does not emit a personal-best card", () => {
  const out = buildAllQuiet(0, 7);
  assert.equal(out.some((n) => n.id === PB_ID), false);
  // And the ordinary milestone is free to fire instead.
  assert.equal(out.some((n) => n.id === STREAK_ID), true);
});

// =========================================================================
// On a non-milestone streak with no new best, neither the PB nor the milestone
// card fires (only the always-on activity nudges, which we have silenced here).
// =========================================================================

test("no pb and a non-milestone streak emits neither celebration card", () => {
  const out = buildAllQuiet(null, 5);
  assert.equal(out.some((n) => n.id === PB_ID), false);
  assert.equal(out.some((n) => n.id === STREAK_ID), false);
});
