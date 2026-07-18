import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("progress rings keep the legacy default and support the 600ms handoff sweep", () => {
  const ring = read("components/ProgressRing.tsx");
  assert.match(ring, /durationMs = 280/);
  assert.match(ring, /duration: durationMs/);
  assert.match(ring, /Easing\.out\(Easing\.cubic\)/);
  assert.match(ring, /Math\.max\(0, Math\.min\(1, progress\)\)/);

  const home = read("app/(tabs)/index.tsx");
  const tracker = read("components/trackers/CaloriesTracker.tsx");
  assert.ok((home.match(/durationMs=\{600\}/g) ?? []).length >= 2);
  assert.match(tracker, /durationMs=\{600\}/);
});

test("Home uses the full-bleed handoff composition and preserves its live actions", () => {
  const home = read("app/(tabs)/index.tsx");
  assert.match(home, /styles\.polishHero/);
  assert.match(home, /openNotifs/);
  assert.match(home, /openStreakHistory/);
  assert.match(home, /router\.push\(`\/workout\/\$\{featured\.id\}`\)/);
  assert.match(home, /router\.navigate\("\/\(tabs\)\/tracker\?mode=water"\)/);
  assert.match(home, /router\.navigate\("\/\(tabs\)\/tracker\?mode=calories"\)/);
  assert.match(home, /toggleFavorite\(workout\.id\)/);
  assert.doesNotMatch(home, /WATER_QUICK|logQuickWater/);
});

test("Home keeps the hero workout copy in a compact visual rhythm", () => {
  const home = read("app/(tabs)/index.tsx");
  assert.match(home, /polishHeroBottom:[\s\S]*bottom: 32,/);
  // Sizes enlarged on request (2026-07-19) so the hero copy reads clearly.
  assert.match(home, /polishHeroEyebrow:[\s\S]*fontSize: 11,[\s\S]*marginBottom: 4,/);
  assert.match(home, /polishHeroTitle: \{[^}]*fontSize: 30,[^}]*lineHeight: 34,/);
  assert.match(home, /polishHeroActions:[\s\S]*gap: 10,[\s\S]*marginTop: 0,/);
  assert.match(home, /isNarrowHero && styles\.polishHeroActionsNarrow/);
  assert.match(home, /polishHeroActionsNarrow: \{ marginTop: 10 \}/);
  assert.match(home, /polishHeroCtaLift:[\s\S]*transform: \[\{ translateY: -4 \}\]/);
  assert.match(home, /polishHeroCtaInner:[\s\S]*paddingHorizontal: 19,[\s\S]*paddingVertical: 12,/);
});

test("Calorie Tracker starts compact and launches each logging flow from one tile", () => {
  const tracker = read("components/trackers/CaloriesTracker.tsx");
  assert.match(tracker, /useState<LogTab \| null>\(null\)/);
  assert.match(tracker, /onPress=\{\(\) => openLogFlow\(item\.key\)\}/);
  assert.match(tracker, /if \(next === "photo"\)[\s\S]*requestAnimationFrame\(choosePhotoSource\)/);
  assert.match(tracker, /else if \(next === "text"\)[\s\S]*mealTextInputRef\.current\?\.focus/);
  assert.match(tracker, /tab === "voice"/);
  assert.match(tracker, /tab === "photo"[\s\S]*choosePhotoSource/);
});

test("the production bottom bar remains untouched by the polish pass", () => {
  const tabs = read("components/TabBar.tsx");
  assert.match(tabs, /community: \{ label: "Circle"/);
  assert.match(tabs, /tracker: \{ label: "Tracker", name: "flame-outline"/);
});
