import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("initial blank routes use content-shaped skeletons", () => {
  const expected: Array<[string, RegExp]> = [
    ["app/index.tsx", /<AppShellSkeleton/],
    ["app/(tabs)/_layout.tsx", /<AppShellSkeleton/],
    ["app/(tabs)/community.tsx", /<CommunityFeedSkeleton/],
    ["app/community/[id].tsx", /<PostDetailSkeleton/],
    ["app/community/notifications.tsx", /<ListRowsSkeleton/],
    ["app/community/compose.tsx", /<FormSkeleton/],
    ["app/exercises.tsx", /<ListRowsSkeleton/],
    ["app/admin/reports.tsx", /<ListRowsSkeleton/],
    ["app/admin/blocked-members.tsx", /<ListRowsSkeleton/],
    ["app/onboarding/thank-you.tsx", /<SkeletonGroup/],
  ];
  for (const [path, pattern] of expected) assert.match(read(path), pattern, path);
  assert.match(read("app/exercises.tsx"), /if \(!loadedOnceRef\.current\) setLoading\(true\)/);
});

test("every Phase 4 empty collection exposes its intended action", () => {
  const expected: Array<[string, RegExp]> = [
    ["components/trackers/CaloriesTracker.tsx", /Card style=\{styles\.polishMealEmpty\}[\s\S]*accessibilityLabel="Log first meal with text"[\s\S]*onPress=\{startTextLogging\}/],
    ["components/trackers/WaterTracker.tsx", /actionLabel="Add 250 ml"[\s\S]*onAction=\{\(\) => logWater\(250\)\}/],
    ["components/trackers/ProgressTracker.tsx", /actionLabel="Enter weight"[\s\S]*weightInputRef\.current\?\.focus/],
    ["components/trackers/ProgressTracker.tsx", /actionLabel="Add first photo"[\s\S]*onAction=\{pickProgressPhoto\}/],
    ["app/(tabs)/workouts.tsx", /actionLabel="Show all workouts"[\s\S]*onAction=\{clearFilters\}/],
    ["app/(tabs)/profile.tsx", /actionLabel="Browse workouts"/],
    ["app/(tabs)/community.tsx", /actionLabel=\{filter === "all" \? "Create a post" : "View all posts"\}/],
    ["app/community/[id].tsx", /actionLabel="Write a comment"[\s\S]*commentInputRef\.current\?\.focus/],
    ["app/community/notifications.tsx", /actionLabel="Visit community"/],
    ["app/exercises.tsx", /actionLabel=\{isAdmin \? "Upload first video" : "Browse workouts"\}/],
    ["app/admin/reports.tsx", /actionLabel="Return to community"/],
    ["app/admin/blocked-members.tsx", /actionLabel="Return to community"/],
    ["app/(tabs)/index.tsx", /No reminders right now[\s\S]*actionLabel="Browse workouts"/],
  ];
  for (const [path, pattern] of expected) assert.match(read(path), pattern, path);
});

test("water and meal persistence remain optimistic and failure-safe", () => {
  const water = read("components/trackers/WaterTracker.tsx");
  assert.match(water, /waterTotalRef\.current = currentMl \+ amountMl;[\s\S]*void addWater\(amountMl\)/);
  assert.doesNotMatch(water, /await addWater\(amountMl\)/);

  const data = read("contexts/DataContext.tsx");
  assert.match(data, /addCalorie: \(entry:[\s\S]*=> Promise<string>/);
  assert.match(data, /updateCaloriePhoto: \(id: string, uri: string\) => Promise<void>/);
  assert.match(data, /if \(!target \|\| target\.photoUri === uri\) return prev/);
  assert.match(data, /prev\.filter\(\(l\) => l\.id !== newEntry\.id\)/);
});
