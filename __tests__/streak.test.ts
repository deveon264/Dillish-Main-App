import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_STREAK_STATE,
  STREAK_WINDOW_DAYS,
  type StreakState,
  dayKeyOf,
  isDayKey,
  sanitizeStreakState,
  recordActiveDay,
  mergeWindow,
  computeStreak,
  combineDays,
  displayStreak,
  MIN_PERSONAL_BEST,
  DEFAULT_PB_CELEBRATION,
  type PbCelebration,
  sanitizePbCelebration,
  advancePbCelebration,
  isCelebratingToday,
} from "@/lib/streak";

// --- dayKeyOf / isDayKey ---------------------------------------------------

test("dayKeyOf formats a local date as zero-padded YYYY-MM-DD", () => {
  // Local date parts, so the key is stable regardless of the test machine's TZ.
  assert.equal(dayKeyOf(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(dayKeyOf(new Date(2026, 11, 31)), "2026-12-31");
});

test("isDayKey accepts only YYYY-MM-DD strings", () => {
  assert.equal(isDayKey("2026-06-09"), true);
  assert.equal(isDayKey("2026-6-9"), false);
  assert.equal(isDayKey("not-a-day"), false);
  assert.equal(isDayKey(20260609), false);
  assert.equal(isDayKey(null), false);
  assert.equal(isDayKey(undefined), false);
});

// --- sanitizeStreakState ---------------------------------------------------

test("sanitizeStreakState coerces garbage to the default-shaped state", () => {
  assert.deepEqual(sanitizeStreakState(null), DEFAULT_STREAK_STATE);
  assert.deepEqual(sanitizeStreakState("nope"), DEFAULT_STREAK_STATE);
  assert.deepEqual(sanitizeStreakState(42), DEFAULT_STREAK_STATE);
});

test("sanitizeStreakState clamps count, validates day, and prunes the window", () => {
  const s = sanitizeStreakState({
    count: -3.9,
    lastActiveDay: "garbage",
    recentDays: ["2026-06-09", "bad", "2026-06-08", "2026-06-09"],
    updatedAt: -5,
  });
  assert.equal(s.count, 0); // negative floored then clamped to 0
  assert.equal(s.lastActiveDay, null); // invalid key dropped
  // Deduped, sorted ascending, invalid filtered out.
  assert.deepEqual(s.recentDays, ["2026-06-08", "2026-06-09"]);
  assert.equal(s.updatedAt, 0); // negative clamped to 0
});

test("sanitizeStreakState floors a fractional count and keeps a valid day", () => {
  const s = sanitizeStreakState({ count: 4.7, lastActiveDay: "2026-06-09", updatedAt: 123 });
  assert.equal(s.count, 4);
  assert.equal(s.lastActiveDay, "2026-06-09");
  assert.equal(s.updatedAt, 123);
});

test("sanitizeStreakState bounds the window to STREAK_WINDOW_DAYS most-recent keys", () => {
  const many: string[] = [];
  for (let i = 0; i < STREAK_WINDOW_DAYS + 10; i++) {
    const d = new Date(Date.UTC(2026, 0, 1));
    d.setUTCDate(d.getUTCDate() + i);
    many.push(d.toISOString().slice(0, 10));
  }
  const s = sanitizeStreakState({ recentDays: many });
  assert.equal(s.recentDays.length, STREAK_WINDOW_DAYS);
  // Keeps the most-recent slice (ascending), so the last key is preserved.
  assert.equal(s.recentDays[s.recentDays.length - 1], many[many.length - 1]);
});

// --- recordActiveDay -------------------------------------------------------

test("recordActiveDay starts a streak from the default state at count 1", () => {
  const next = recordActiveDay(DEFAULT_STREAK_STATE, "2026-06-09", 1000);
  assert.equal(next.count, 1);
  assert.equal(next.lastActiveDay, "2026-06-09");
  assert.deepEqual(next.recentDays, ["2026-06-09"]);
  assert.equal(next.updatedAt, 1000);
});

test("recordActiveDay increments the count on a consecutive next day", () => {
  const day1 = recordActiveDay(DEFAULT_STREAK_STATE, "2026-06-08", 1);
  const day2 = recordActiveDay(day1, "2026-06-09", 2);
  assert.equal(day2.count, 2);
  assert.equal(day2.lastActiveDay, "2026-06-09");
  assert.deepEqual(day2.recentDays, ["2026-06-08", "2026-06-09"]);
});

test("recordActiveDay resets the count to 1 when there is a gap", () => {
  const day1 = recordActiveDay(DEFAULT_STREAK_STATE, "2026-06-05", 1);
  const day1b = recordActiveDay(day1, "2026-06-06", 2);
  assert.equal(day1b.count, 2);
  // Skip a day: 06-08 is not consecutive with 06-06.
  const gap = recordActiveDay(day1b, "2026-06-08", 3);
  assert.equal(gap.count, 1);
  assert.equal(gap.lastActiveDay, "2026-06-08");
});

test("recordActiveDay is idempotent for the same day (returns prev unchanged)", () => {
  const day1 = recordActiveDay(DEFAULT_STREAK_STATE, "2026-06-09", 1);
  const again = recordActiveDay(day1, "2026-06-09", 999);
  assert.equal(again, day1); // same reference, no churn
  assert.equal(again.updatedAt, 1); // not bumped to 999
});

test("recordActiveDay ignores an invalid day", () => {
  const day1 = recordActiveDay(DEFAULT_STREAK_STATE, "2026-06-09", 1);
  const same = recordActiveDay(day1, "bad-day", 2);
  assert.equal(same, day1);
});

test("recordActiveDay with an older day only joins the window, not the count", () => {
  const day1 = recordActiveDay(DEFAULT_STREAK_STATE, "2026-06-09", 1);
  const older = recordActiveDay(day1, "2026-06-05", 2);
  assert.equal(older.count, 1); // count untouched
  assert.equal(older.lastActiveDay, "2026-06-09"); // frontier untouched
  assert.deepEqual(older.recentDays, ["2026-06-05", "2026-06-09"]); // window grew
});

// --- mergeWindow -----------------------------------------------------------

test("mergeWindow folds extra days into the window without touching count/frontier", () => {
  const base = recordActiveDay(DEFAULT_STREAK_STATE, "2026-06-09", 1);
  const merged = mergeWindow(base, ["2026-06-01", "2026-06-02", "bad"], 5);
  assert.equal(merged.count, base.count);
  assert.equal(merged.lastActiveDay, base.lastActiveDay);
  assert.deepEqual(merged.recentDays, ["2026-06-01", "2026-06-02", "2026-06-09"]);
  assert.equal(merged.updatedAt, 5);
});

test("mergeWindow returns prev unchanged when the window does not change", () => {
  const base = recordActiveDay(DEFAULT_STREAK_STATE, "2026-06-09", 1);
  const merged = mergeWindow(base, ["2026-06-09"], 9);
  assert.equal(merged, base);
});

// --- computeStreak ---------------------------------------------------------

test("computeStreak counts a consecutive run ending today", () => {
  const days = new Set(["2026-06-07", "2026-06-08", "2026-06-09"]);
  assert.equal(computeStreak(days, "2026-06-09"), 3);
});

test("computeStreak anchors to yesterday when today is absent", () => {
  const days = new Set(["2026-06-07", "2026-06-08"]);
  assert.equal(computeStreak(days, "2026-06-09"), 2);
});

test("computeStreak is 0 when neither today nor yesterday is present", () => {
  const days = new Set(["2026-06-01", "2026-06-02"]);
  assert.equal(computeStreak(days, "2026-06-09"), 0);
});

test("computeStreak stops at the first gap", () => {
  const days = new Set(["2026-06-05", "2026-06-08", "2026-06-09"]);
  assert.equal(computeStreak(days, "2026-06-09"), 2);
});

// --- combineDays -----------------------------------------------------------

test("combineDays unions active and completion days, dropping invalid keys", () => {
  const set = combineDays(["2026-06-08", "bad"], ["2026-06-08", "2026-06-09", "nope"]);
  assert.deepEqual([...set].sort(), ["2026-06-08", "2026-06-09"]);
});

// --- displayStreak ---------------------------------------------------------

test("displayStreak takes the live union run when it is the longer one", () => {
  const state: StreakState = { count: 1, longest: 1, lastActiveDay: "2026-06-09", recentDays: ["2026-06-09"], updatedAt: 1 };
  // Workout-completion days extend the live run beyond the server count.
  const combined = combineDays(["2026-06-09"], ["2026-06-07", "2026-06-08"]);
  assert.equal(displayStreak(state, combined, "2026-06-09"), 3);
});

test("displayStreak takes the alive server count when it beats the live run", () => {
  // Server tracked a long streak (e.g. restored on a fresh device with an empty
  // local window) whose last active day is today: it stays counted.
  const state: StreakState = { count: 10, longest: 10, lastActiveDay: "2026-06-09", recentDays: ["2026-06-09"], updatedAt: 1 };
  const combined = combineDays(["2026-06-09"], []);
  assert.equal(displayStreak(state, combined, "2026-06-09"), 10);
});

test("displayStreak counts the server streak when its last day is yesterday", () => {
  const state: StreakState = { count: 7, longest: 7, lastActiveDay: "2026-06-08", recentDays: ["2026-06-08"], updatedAt: 1 };
  const combined = combineDays(["2026-06-08"], []);
  assert.equal(displayStreak(state, combined, "2026-06-09"), 7);
});

test("displayStreak drops a stale server streak (last day older than yesterday)", () => {
  const state: StreakState = { count: 99, longest: 99, lastActiveDay: "2026-06-01", recentDays: ["2026-06-01"], updatedAt: 1 };
  const combined = combineDays([], []);
  assert.equal(displayStreak(state, combined, "2026-06-09"), 0);
});

// --- personal-best celebration --------------------------------------------

test("sanitizePbCelebration coerces garbage to the never-seeded default", () => {
  assert.deepEqual(sanitizePbCelebration(null), DEFAULT_PB_CELEBRATION);
  assert.deepEqual(sanitizePbCelebration("nope"), DEFAULT_PB_CELEBRATION);
  assert.deepEqual(sanitizePbCelebration({ value: "x", day: 5 }), DEFAULT_PB_CELEBRATION);
  assert.deepEqual(sanitizePbCelebration({ value: 7.9, day: "2026-06-09" }), { value: 7, day: "2026-06-09" });
  // A non day-key string day is dropped to "".
  assert.deepEqual(sanitizePbCelebration({ value: 7, day: "soon" }), { value: 7, day: "" });
});

test("advancePbCelebration baselines silently on first call (value < 0)", () => {
  // Never-seeded record adopts the current best with an empty day, so no
  // celebration fires for an already-established record.
  assert.deepEqual(advancePbCelebration(DEFAULT_PB_CELEBRATION, 14, "2026-06-09"), { value: 14, day: "" });
  assert.deepEqual(advancePbCelebration(DEFAULT_PB_CELEBRATION, 0, "2026-06-09"), { value: 0, day: "" });
});

test("advancePbCelebration stamps today when the best beats the stored record", () => {
  const prev: PbCelebration = { value: 14, day: "" };
  assert.deepEqual(advancePbCelebration(prev, 15, "2026-06-09"), { value: 15, day: "2026-06-09" });
});

test("advancePbCelebration is a no-op when the best did not improve", () => {
  const prev: PbCelebration = { value: 14, day: "2026-06-08" };
  // Same reference returned (no change) when best is equal or lower.
  assert.equal(advancePbCelebration(prev, 14, "2026-06-09"), prev);
  assert.equal(advancePbCelebration(prev, 5, "2026-06-09"), prev);
});

test("advancePbCelebration does not announce a sub-minimum best (1 day)", () => {
  const prev: PbCelebration = { value: 0, day: "" };
  // 1 > 0 but below MIN_PERSONAL_BEST, so no record stamp.
  assert.equal(advancePbCelebration(prev, 1, "2026-06-09"), prev);
  assert.equal(MIN_PERSONAL_BEST, 2);
  // The first announceable record is the minimum.
  assert.deepEqual(advancePbCelebration(prev, 2, "2026-06-09"), { value: 2, day: "2026-06-09" });
});

test("isCelebratingToday only fires for a record stamped today and at/above the minimum", () => {
  assert.equal(isCelebratingToday({ value: 15, day: "2026-06-09" }, "2026-06-09"), true);
  // Stamped a different day: stale, no celebration.
  assert.equal(isCelebratingToday({ value: 15, day: "2026-06-08" }, "2026-06-09"), false);
  // Silent baseline (empty day) never celebrates.
  assert.equal(isCelebratingToday({ value: 15, day: "" }, "2026-06-09"), false);
  // Below the announce minimum.
  assert.equal(isCelebratingToday({ value: 1, day: "2026-06-09" }, "2026-06-09"), false);
});

test("advance + isCelebratingToday: record fires once, de-duped across same-day re-checks", () => {
  const today = "2026-06-09";
  let rec: PbCelebration = { value: 14, day: "" };
  // Best climbs to a new record today.
  rec = advancePbCelebration(rec, 15, today);
  assert.equal(isCelebratingToday(rec, today), true);
  // Re-running the same day with the same best does not move the record.
  const again = advancePbCelebration(rec, 15, today);
  assert.equal(again, rec);
  // The next day, with no further improvement, the celebration no longer shows.
  assert.equal(isCelebratingToday(rec, "2026-06-10"), false);
});
