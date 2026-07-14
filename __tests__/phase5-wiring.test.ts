import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("Phase 5 dependency and screen entrance wiring stay Expo Go compatible", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["react-native-ease"], "0.7.3");

  const motion = read("components/Motion.tsx");
  assert.match(motion, /hasViewManagerConfig/);
  assert.match(motion, /require\("react-native-ease"\)/);
  assert.match(motion, /catch \{/);
  assert.match(motion, /standard: 220/);
  assert.match(motion, /counter: 260/);

  assert.match(read("components/GradientBackground.tsx"), /<ScreenEntrance/);
  assert.match(read("app/welcome.tsx"), /<ScreenEntrance/);
  assert.match(read("app/onboarding/thank-you.tsx"), /<ScreenEntrance/);
});

test("dynamic collections use the shared mutation transition", () => {
  const files = [
    "components/trackers/CaloriesTracker.tsx",
    "components/trackers/WaterTracker.tsx",
    "components/trackers/ProgressTracker.tsx",
    "components/community/MemberNotices.tsx",
    "app/(tabs)/community.tsx",
    "app/(tabs)/index.tsx",
    "app/community/[id].tsx",
    "app/exercises.tsx",
    "app/admin/reports.tsx",
    "app/admin/blocked-members.tsx",
  ];
  for (const file of files) {
    assert.match(read(file), /MotionListItem/, `${file} should animate true collection mutations`);
  }
});

test("daily calorie and water totals use AnimatedNumber", () => {
  for (const file of [
    "components/trackers/CaloriesTracker.tsx",
    "components/trackers/WaterTracker.tsx",
    "app/(tabs)/index.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /AnimatedNumber/);
  }
});

test("decorative loops and staggered Bouncy entrances stay removed", () => {
  const decorativeFiles = [
    "app/welcome.tsx",
    "app/(tabs)/index.tsx",
    "app/(tabs)/community.tsx",
    "components/onboarding/OnboardKit.tsx",
    "components/WaterCircle.tsx",
    "components/trackers/WaterTracker.tsx",
  ];
  for (const file of decorativeFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /withRepeat|Animated\.loop/, file);
  }

  const bouncy = read("components/Bouncy.tsx");
  assert.doesNotMatch(bouncy, /FadeIn|entering=|index\?:/);
  assert.match(read("components/Skeleton.tsx"), /withRepeat/);
  assert.match(read("components/trackers/CaloriesTracker.tsx"), /Animated\.loop/);
});
