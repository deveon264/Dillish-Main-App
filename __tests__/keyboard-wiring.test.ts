import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("Expo-pinned controller is mounted inside the gesture root", () => {
  const pkg = JSON.parse(read("package.json"));
  const layout = read("app/_layout.tsx");

  assert.equal(pkg.dependencies["react-native-keyboard-controller"], "1.18.5");
  assert.ok(layout.includes('import { KeyboardProvider } from "react-native-keyboard-controller"'));
  assert.ok(layout.indexOf("<GestureHandlerRootView") < layout.indexOf("<KeyboardProvider>"));
  assert.ok(layout.indexOf("<KeyboardProvider>") < layout.indexOf("<SafeAreaProvider>"));
});

test("multi-field forms expose visual-order focus chaining and toolbar coverage", () => {
  const login = read("app/(auth)/login.tsx");
  const signup = read("app/(auth)/signup.tsx");
  const onboarding = read("app/onboarding/profile.tsx");
  const progress = read("components/trackers/ProgressTracker.tsx");

  assert.match(login, /onSubmitEditing=\{\(\) => passwordRef\.current\?\.focus\(\)\}/);
  assert.match(signup, /needsPasscode \? passcodeRef\.current\?\.focus\(\) : Keyboard\.dismiss\(\)/);
  assert.match(onboarding, /weightRef\.current\?\.focus\(\)/);
  assert.match(onboarding, /goalWeightRef\.current\?\.focus\(\)/);
  assert.match(onboarding, /heightRef\.current\?\.focus\(\)/);
  // The weigh-in form is now a stepper + tappable date chip (no weight->date
  // focus chain), so Progress' visual-order chaining is exercised by the photo
  // details modal instead.
  assert.match(progress, /photoWeightRef\.current\?\.focus\(\)/);
  // The onboarding profile step deliberately has no custom toolbar: its numeric
  // fields rely on the system return keys (Done/Next) for navigation.
  for (const source of [login, signup, progress]) {
    assert.ok(source.includes("<KeyboardFormToolbar"));
  }
  assert.ok(!onboarding.includes("<KeyboardFormToolbar"));
});

test("meal text card owns the native drag-to-dismiss region and web fallback", () => {
  const calories = read("components/trackers/CaloriesTracker.tsx");

  assert.match(calories, /const MEAL_TEXT_INPUT_ID = "meal-text-input"/);
  assert.match(calories, /Platform\.OS === "web"/);
  assert.match(calories, /<KeyboardGestureArea[\s\S]*enableSwipeToDismiss[\s\S]*showOnSwipeUp=\{false\}/);
  assert.match(calories, /textInputNativeID=\{MEAL_TEXT_INPUT_ID\}/);
  assert.match(calories, /nativeID=\{MEAL_TEXT_INPUT_ID\}/);
  assert.match(calories, /<MealTextGestureArea>[\s\S]*<Card style=\{styles\.textCard\}>/);
});

test("legacy React Native keyboard avoiders are gone from app inputs", () => {
  const files = [
    "app/(auth)/login.tsx",
    "app/(auth)/signup.tsx",
    "app/(auth)/forgot-password.tsx",
    "app/onboarding/profile.tsx",
    "app/community/[id].tsx",
    "app/community/compose.tsx",
    "app/admin/reports.tsx",
    "components/trackers/ProgressTracker.tsx",
  ];

  for (const file of files) {
    assert.doesNotMatch(read(file), /from "react-native";[^\n]*KeyboardAvoidingView/);
  }
});

test("numeric fields retain purpose-specific keyboards while multiline inputs keep Return", () => {
  const onboarding = read("app/onboarding/profile.tsx");
  const water = read("components/trackers/WaterTracker.tsx");
  const progress = read("components/trackers/ProgressTracker.tsx");
  const profile = read("app/(tabs)/profile.tsx");
  const compose = read("app/community/compose.tsx");
  const admin = read("app/admin/edit-exercise.tsx");

  assert.match(onboarding, /placeholder="28"[\s\S]{0,180}keyboardType="number-pad"/);
  assert.match(onboarding, /placeholder="65"[\s\S]{0,180}keyboardType="decimal-pad"/);
  assert.match(water, /placeholder="Custom amount \(ml\)"[\s\S]{0,180}keyboardType="number-pad"/);
  assert.match(progress, /keyboardType="decimal-pad"[\s\S]{0,120}style=\{styles\.stepInput\}/);
  assert.match(profile, /value=\{waterInput\}[\s\S]{0,220}keyboardType="decimal-pad"/);
  assert.match(profile, /value=\{calorieInput\}[\s\S]{0,220}keyboardType="number-pad"/);
  assert.match(compose, /placeholder="Share an update[\s\S]{0,240}multiline/);
  assert.match(admin, /placeholder="Cues, form tips[\s\S]{0,240}multiline/);
});
