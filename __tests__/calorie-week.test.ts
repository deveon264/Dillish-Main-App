import test from "node:test";
import assert from "node:assert/strict";

import { buildCalorieWeek, getCalorieWeekScale, type CalorieWeekLog } from "@/lib/calorieWeek";

function logAt(year: number, month: number, day: number, kcal: number, hour = 12): CalorieWeekLog {
  return { kcal, ts: new Date(year, month, day, hour).getTime() };
}

test("buildCalorieWeek returns a Monday-first week and aggregates each local day", () => {
  const today = new Date(2026, 6, 17, 9); // Friday, Jul 17
  const week = buildCalorieWeek(
    [
      logAt(2026, 6, 13, 450, 8),
      logAt(2026, 6, 13, 650, 19),
      logAt(2026, 6, 17, 725),
      logAt(2026, 6, 20, 999), // Following Monday; excluded.
    ],
    today,
  );

  assert.equal(week.range, "Jul 13 – 19");
  assert.deepEqual(week.days.map((day) => day.label), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  assert.deepEqual(week.days.map((day) => day.dayOfMonth), [13, 14, 15, 16, 17, 18, 19]);
  assert.deepEqual(week.days.map((day) => day.total), [1100, 0, 0, 0, 725, 0, 0]);
  assert.deepEqual(week.days.map((day) => day.isToday), [false, false, false, false, true, false, false]);
  assert.equal(week.days[4].fullDateLabel, "Friday, July 17, 2026");
});

test("buildCalorieWeek formats a range that crosses a month boundary", () => {
  const week = buildCalorieWeek([], new Date(2026, 7, 1, 12)); // Saturday, Aug 1

  assert.equal(week.range, "Jul 27 – Aug 2");
  assert.deepEqual(week.days.map((day) => day.dayOfMonth), [27, 28, 29, 30, 31, 1, 2]);
  assert.equal(week.days[5].isToday, true);
});

test("weekly scale uses the goal for empty, below-goal, and at-goal weeks", () => {
  assert.deepEqual(getCalorieWeekScale([], 1500), { maximum: 1500, midpoint: 750, goal: 1500 });
  assert.deepEqual(getCalorieWeekScale([{ total: 1200 }], 1500), { maximum: 1500, midpoint: 750, goal: 1500 });
  assert.deepEqual(getCalorieWeekScale([{ total: 1500 }], 1500), { maximum: 1500, midpoint: 750, goal: 1500 });
});

test("weekly scale expands over-goal totals to a 500 kcal ceiling", () => {
  assert.deepEqual(getCalorieWeekScale([{ total: 1750 }], 1500), { maximum: 2000, midpoint: 1000, goal: 1500 });
  assert.deepEqual(getCalorieWeekScale([{ total: 2001 }], 1500), { maximum: 2500, midpoint: 1250, goal: 1500 });
});

test("weekly scale stays valid when the profile goal or totals are invalid", () => {
  assert.deepEqual(getCalorieWeekScale([{ total: Number.NaN }, { total: -50 }], 0), {
    maximum: 500,
    midpoint: 250,
    goal: 0,
  });
});
