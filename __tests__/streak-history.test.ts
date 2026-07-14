import { test } from "node:test";
import assert from "node:assert/strict";

import { buildWeekHistory, WEEK_DAY_LABELS } from "@/lib/streakHistory";

// 2026-07-09 is a Thursday; its week runs Mon Jul 6 → Sun Jul 12.
const THURSDAY = new Date(2026, 6, 9);

test("week containing today starts on Monday and flags today", () => {
  const rows = buildWeekHistory(new Set(["2026-07-09"]), 1, THURSDAY);
  assert.equal(rows.length, 1);
  const week = rows[0];
  assert.equal(week.isCurrent, true);
  assert.equal(week.rangeLabel, "This week");
  assert.deepEqual(
    week.days.map((d) => d.key),
    ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"]
  );
  assert.deepEqual(week.days.map((d) => d.label), WEEK_DAY_LABELS);
  assert.deepEqual(week.days.map((d) => d.isToday), [false, false, false, true, false, false, false]);
});

test("active flags and activeCount reflect the day set", () => {
  const rows = buildWeekHistory(new Set(["2026-07-06", "2026-07-09", "2026-07-12", "2026-07-13"]), 1, THURSDAY);
  const week = rows[0];
  assert.deepEqual(
    week.days.map((d) => d.active),
    [true, false, false, true, false, false, true]
  );
  assert.equal(week.activeCount, 3); // Jul 13 is next week, excluded
});

test("weeks come newest first with This week / Last week / date-range labels", () => {
  const rows = buildWeekHistory(new Set(), 3, THURSDAY);
  assert.equal(rows[0].rangeLabel, "This week");
  assert.equal(rows[1].rangeLabel, "Last week");
  assert.equal(rows[2].rangeLabel, "Jun 22 – 28");
  assert.equal(rows[1].days[0].key, "2026-06-29");
  assert.equal(rows[2].days[6].key, "2026-06-28");
  assert.deepEqual(rows.map((r) => r.isCurrent), [true, false, false]);
});

test("range label spans a month boundary", () => {
  // 4 weeks back from Thursday Jul 9: Mon Jun 15, Mon Jun 8, Mon Jun 1, Mon May 25.
  const rows = buildWeekHistory(new Set(), 7, THURSDAY);
  assert.equal(rows[6].rangeLabel, "May 25 – 31");
  assert.equal(rows[5].rangeLabel, "Jun 1 – 7");
  // A week that actually crosses months: Mon Jun 29 → Sun Jul 5 is rows[1]
  // ("Last week"); force its label form by asking from one week later.
  const later = buildWeekHistory(new Set(), 3, new Date(2026, 6, 16));
  assert.equal(later[2].rangeLabel, "Jun 29 – Jul 5");
});

test("a week with no active days has activeCount 0 and all-inactive marks", () => {
  const rows = buildWeekHistory(new Set(["2026-07-06"]), 2, THURSDAY);
  const lastWeek = rows[1];
  assert.equal(lastWeek.activeCount, 0);
  assert.ok(lastWeek.days.every((d) => !d.active && !d.isToday));
});

test("Monday today is its own week start", () => {
  const monday = new Date(2026, 6, 6);
  const rows = buildWeekHistory(new Set(["2026-07-06"]), 1, monday);
  assert.equal(rows[0].days[0].key, "2026-07-06");
  assert.equal(rows[0].days[0].isToday, true);
  assert.equal(rows[0].days[0].active, true);
});
