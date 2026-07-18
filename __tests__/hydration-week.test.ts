import test from "node:test";
import assert from "node:assert/strict";

import { buildHydrationWeek, type HydrationLog } from "@/lib/hydrationWeek";

function logAt(year: number, month: number, day: number, amountMl: number, hour = 12): HydrationLog {
  return { amountMl, ts: new Date(year, month, day, hour).getTime() };
}

const GOAL = 2500;

test("buildHydrationWeek returns a Monday-first week and aggregates each local day", () => {
  const today = new Date(2026, 6, 17, 9); // Friday, Jul 17
  const week = buildHydrationWeek(
    [
      logAt(2026, 6, 13, 1500, 8),
      logAt(2026, 6, 13, 1000, 19),
      logAt(2026, 6, 17, 800),
      logAt(2026, 6, 20, 999), // Following Monday; excluded from the visible week.
    ],
    GOAL,
    today,
  );

  assert.equal(week.range, "Jul 13 – 19");
  assert.deepEqual(week.days.map((d) => d.label), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  assert.deepEqual(week.days.map((d) => d.dayOfMonth), [13, 14, 15, 16, 17, 18, 19]);
  assert.deepEqual(week.days.map((d) => d.totalMl), [2500, 0, 0, 0, 800, 0, 0]);
  assert.deepEqual(week.days.map((d) => d.isToday), [false, false, false, false, true, false, false]);
  assert.deepEqual(week.days.map((d) => d.reached), [true, false, false, false, false, false, false]);
});

test("buildHydrationWeek averages over elapsed days and counts goal days", () => {
  const today = new Date(2026, 6, 15, 20); // Wednesday, Jul 15 (3 elapsed days)
  const week = buildHydrationWeek(
    [
      logAt(2026, 6, 13, 2500),
      logAt(2026, 6, 14, 2500),
      logAt(2026, 6, 15, 500),
    ],
    GOAL,
    today,
  );

  // (2500 + 2500 + 500) / 3 elapsed days = 1833.33 -> 1833
  assert.equal(week.dailyAvgMl, 1833);
  assert.equal(week.goalDays, 2);
});

test("buildHydrationWeek counts a reached-goal streak through today", () => {
  const today = new Date(2026, 6, 17, 21); // Friday
  const week = buildHydrationWeek(
    [
      logAt(2026, 6, 15, 2500),
      logAt(2026, 6, 16, 2600),
      logAt(2026, 6, 17, 2500),
    ],
    GOAL,
    today,
  );
  assert.equal(week.streak, 3);
});

test("an unmet but in-progress today does not break the streak", () => {
  const today = new Date(2026, 6, 17, 10); // Friday, only 500ml so far
  const week = buildHydrationWeek(
    [
      logAt(2026, 6, 15, 2500),
      logAt(2026, 6, 16, 2500),
      logAt(2026, 6, 17, 500),
    ],
    GOAL,
    today,
  );
  // Today is still open (500 < goal) so the streak is measured through Thursday.
  assert.equal(week.streak, 2);
});

test("a missed prior day breaks the streak", () => {
  const today = new Date(2026, 6, 17, 21); // Friday
  const week = buildHydrationWeek(
    [
      logAt(2026, 6, 14, 2500),
      // Jul 15 missed
      logAt(2026, 6, 16, 2500),
      logAt(2026, 6, 17, 2500),
    ],
    GOAL,
    today,
  );
  assert.equal(week.streak, 2);
});

test("buildHydrationWeek handles an empty log and formats a month-crossing range", () => {
  const week = buildHydrationWeek([], GOAL, new Date(2026, 7, 1, 12)); // Saturday, Aug 1
  assert.equal(week.range, "Jul 27 – Aug 2");
  assert.equal(week.dailyAvgMl, 0);
  assert.equal(week.goalDays, 0);
  assert.equal(week.streak, 0);
  assert.deepEqual(week.days.map((d) => d.dayOfMonth), [27, 28, 29, 30, 31, 1, 2]);
  assert.equal(week.days[5].isToday, true);
});
