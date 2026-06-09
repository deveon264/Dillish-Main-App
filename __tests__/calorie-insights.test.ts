import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getCalorieInsight,
  dayOfYear,
  type Macro,
  type InsightInput,
} from "@/lib/calorieInsights";

// Convenience builders so each test reads as a day-state, not a wall of fields.
function totals(t: Partial<InsightInput["totals"]> = {}) {
  return { kcal: 0, protein: 0, carbs: 0, fats: 0, ...t };
}
function goals(g: Partial<InsightInput["goals"]> = {}) {
  return { kcal: 2000, protein: 150, carbs: 200, fats: 60, ...g };
}

// Seeds chosen to exercise rotation; the engine must be stable for each.
const SEEDS = [0, 1, 2, 3, 7, 12, 33, 100, 365, -1, -7, -200];

// --- category selection & priority order ----------------------------------

test("empty day (nothing logged) selects the 'start' category", () => {
  for (const seed of SEEDS) {
    const insight = getCalorieInsight({ totals: totals(), goals: goals(), seed });
    assert.equal(insight.category, "start");
  }
});

test("a logged zero-kcal day still counts as empty ('start')", () => {
  // kcal <= 0 is the empty test, so an explicit 0 must route to "start".
  const insight = getCalorieInsight({
    totals: totals({ kcal: 0, protein: 10 }),
    goals: goals(),
    seed: 1,
  });
  assert.equal(insight.category, "start");
});

test("over the calorie goal selects 'over'", () => {
  const insight = getCalorieInsight({
    totals: totals({ kcal: 2300, protein: 160, carbs: 210, fats: 70 }),
    goals: goals(),
    seed: 1,
  });
  assert.equal(insight.category, "over");
});

test("all macro goals met (within calories) selects 'balanced'", () => {
  const insight = getCalorieInsight({
    totals: totals({ kcal: 1900, protein: 150, carbs: 200, fats: 60 }),
    goals: goals(),
    seed: 1,
  });
  assert.equal(insight.category, "balanced");
});

test("exceeding a macro goal still counts it as met for 'balanced'", () => {
  // leftMacro is clamped at 0, so being over a macro is treated as met.
  const insight = getCalorieInsight({
    totals: totals({ kcal: 1900, protein: 200, carbs: 250, fats: 80 }),
    goals: goals(),
    seed: 2,
  });
  assert.equal(insight.category, "balanced");
});

test("unmet macros (within calories) feature the largest-percentage gap", () => {
  // Protein 50% short, carbs 25% short, fats met -> protein wins on share.
  const insight = getCalorieInsight({
    totals: totals({ kcal: 1500, protein: 75, carbs: 150, fats: 60 }),
    goals: goals(),
    seed: 1,
  });
  assert.equal(insight.category, "macro-protein");
  assert.equal(insight.featuredMacro, "protein");
});

test("largest gap is measured by share of goal, not absolute grams", () => {
  // Carbs are 60g short vs protein 30g short, but protein's share is larger
  // (30/150 = 20% vs 60/300 = 20%? choose values where share clearly differs).
  // protein: 60/150 = 40% short; carbs: 50/400 = 12.5% short -> protein wins.
  const insight = getCalorieInsight({
    totals: totals({ kcal: 1500, protein: 90, carbs: 350, fats: 60 }),
    goals: goals({ carbs: 400 }),
    seed: 1,
  });
  assert.equal(insight.category, "macro-protein");
});

test("carbs gap can win when it is the largest share", () => {
  // carbs 75% short, protein met, fats met.
  const insight = getCalorieInsight({
    totals: totals({ kcal: 1500, protein: 150, carbs: 50, fats: 60 }),
    goals: goals(),
    seed: 1,
  });
  assert.equal(insight.category, "macro-carbs");
  assert.equal(insight.featuredMacro, "carbs");
});

test("fats gap can win when it is the largest share", () => {
  const insight = getCalorieInsight({
    totals: totals({ kcal: 1500, protein: 150, carbs: 200, fats: 10 }),
    goals: goals(),
    seed: 1,
  });
  assert.equal(insight.category, "macro-fats");
  assert.equal(insight.featuredMacro, "fats");
});

test("over the calorie goal wins even while a macro is still short", () => {
  // Protein is short, but being over calories takes priority over the macro tip.
  const insight = getCalorieInsight({
    totals: totals({ kcal: 2200, protein: 50, carbs: 200, fats: 60 }),
    goals: goals(),
    seed: 1,
  });
  assert.equal(insight.category, "over");
  assert.equal(insight.featuredMacro, "protein");
});

// --- chip invariants -------------------------------------------------------

const STATES: { name: string; input: InsightInput }[] = [
  { name: "start", input: { totals: totals(), goals: goals() } },
  {
    name: "over",
    input: { totals: totals({ kcal: 2300, protein: 160, carbs: 210, fats: 70 }), goals: goals() },
  },
  {
    name: "balanced",
    input: { totals: totals({ kcal: 1900, protein: 150, carbs: 200, fats: 60 }), goals: goals() },
  },
  {
    name: "macro-protein",
    input: { totals: totals({ kcal: 1500, protein: 75, carbs: 150, fats: 60 }), goals: goals() },
  },
  {
    name: "macro-carbs",
    input: { totals: totals({ kcal: 1500, protein: 150, carbs: 50, fats: 60 }), goals: goals() },
  },
  {
    name: "macro-fats",
    input: { totals: totals({ kcal: 1500, protein: 150, carbs: 200, fats: 10 }), goals: goals() },
  },
];

test("always returns exactly two chips, for every state and seed", () => {
  for (const { input } of STATES) {
    for (const seed of SEEDS) {
      const insight = getCalorieInsight({ ...input, seed });
      assert.equal(insight.chips.length, 2);
    }
  }
});

test("the two chips are always distinct", () => {
  for (const { name, input } of STATES) {
    for (const seed of SEEDS) {
      const insight = getCalorieInsight({ ...input, seed });
      assert.notEqual(
        insight.chips[0].name,
        insight.chips[1].name,
        `chips collided for ${name} seed=${seed}`,
      );
    }
  }
});

test("chip values quantify the featured macro and are never 0g", () => {
  for (const { name, input } of STATES) {
    for (const seed of SEEDS) {
      const insight = getCalorieInsight({ ...input, seed });
      for (const chip of insight.chips) {
        assert.ok(
          chip.value > 0,
          `chip ${chip.name} had 0g of featured macro for ${name} seed=${seed}`,
        );
      }
    }
  }
});

test("featured macro matches the category for the macro states", () => {
  const expected: Record<string, Macro> = {
    "macro-protein": "protein",
    "macro-carbs": "carbs",
    "macro-fats": "fats",
  };
  for (const [category, macro] of Object.entries(expected)) {
    const state = STATES.find((s) => s.name === category)!;
    const insight = getCalorieInsight({ ...state.input, seed: 5 });
    assert.equal(insight.featuredMacro, macro);
  }
});

// --- edge cases ------------------------------------------------------------

test("zero macro goals never produce NaN/divide-by-zero", () => {
  // One macro has a real goal+gap; the others are zero. The zero-goal macros
  // must contribute a 0% share (not NaN) and the engine must route cleanly.
  const insight = getCalorieInsight({
    totals: totals({ kcal: 100, protein: 0, carbs: 0, fats: 0 }),
    goals: goals({ kcal: 2000, protein: 0, carbs: 200, fats: 0 }),
    seed: 1,
  });
  assert.equal(insight.category, "macro-carbs");
  for (const chip of insight.chips) {
    assert.ok(Number.isFinite(chip.value));
    assert.ok(!Number.isNaN(chip.value));
  }
});

test("all-zero goals with some intake routes to 'over' without NaN", () => {
  // goals.kcal 0 means any intake is over goal; must not throw or NaN.
  const insight = getCalorieInsight({
    totals: totals({ kcal: 100, protein: 5, carbs: 5, fats: 5 }),
    goals: goals({ kcal: 0, protein: 0, carbs: 0, fats: 0 }),
    seed: 1,
  });
  assert.equal(insight.category, "over");
  for (const chip of insight.chips) {
    assert.ok(Number.isFinite(chip.value) && chip.value > 0);
  }
});

// --- seed rotation ---------------------------------------------------------

test("the same day-state yields different copy and foods across seeds", () => {
  const state = STATES.find((s) => s.name === "macro-protein")!;
  const a = getCalorieInsight({ ...state.input, seed: 0 });
  const b = getCalorieInsight({ ...state.input, seed: 1 });

  const copyA = a.segments.map((s) => s.text).join("");
  const copyB = b.segments.map((s) => s.text).join("");
  assert.notEqual(copyA, copyB, "copy did not rotate with the seed");

  const foodsA = a.chips.map((c) => c.name).join(",");
  const foodsB = b.chips.map((c) => c.name).join(",");
  assert.notEqual(foodsA, foodsB, "foods did not rotate with the seed");
});

test("the same input and seed is deterministic", () => {
  const state = STATES.find((s) => s.name === "over")!;
  const a = getCalorieInsight({ ...state.input, seed: 42 });
  const b = getCalorieInsight({ ...state.input, seed: 42 });
  assert.deepEqual(a, b);
});

test("negative seeds are normalized into range (no out-of-bounds picks)", () => {
  for (const { input } of STATES) {
    for (const seed of [-1, -2, -50, -365]) {
      const insight = getCalorieInsight({ ...input, seed });
      assert.equal(insight.chips.length, 2);
      for (const chip of insight.chips) {
        assert.ok(chip.name && typeof chip.name === "string");
        assert.ok(chip.value > 0);
      }
      assert.ok(insight.segments.length > 0);
    }
  }
});

// --- dayOfYear (default seed) ---------------------------------------------

test("dayOfYear returns a 1..366 day index", () => {
  assert.equal(dayOfYear(new Date(2026, 0, 1)), 1);
  assert.equal(dayOfYear(new Date(2026, 11, 31)), 365);
  // 2024 is a leap year.
  assert.equal(dayOfYear(new Date(2024, 11, 31)), 366);
});

test("omitting the seed falls back to the day of year (still valid output)", () => {
  const insight = getCalorieInsight({
    totals: totals({ kcal: 1500, protein: 75, carbs: 150, fats: 60 }),
    goals: goals(),
  });
  assert.equal(insight.category, "macro-protein");
  assert.equal(insight.chips.length, 2);
});
