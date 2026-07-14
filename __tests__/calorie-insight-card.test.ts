import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

// Tell React this is a valid environment for act() so the render is flushed
// synchronously and no "not configured to support act(...)" warnings are logged.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import {
  CalorieInsightBody,
  insightMacroColor,
  type InsightBodyComponents,
} from "@/components/trackers/CalorieInsightCard";
import { getCalorieInsight, type InsightInput } from "@/lib/calorieInsights";
import { colors } from "@/constants/colors";

// Lightweight stand-ins for the real react-native host elements. Each renders a
// plain host string with a `data-role` so the test can locate it, mirroring
// exactly the structure CaloriesTracker wires up (Text > Strong, ChipsRow >
// Chip > [ChipIcon, ChipName, ChipValue]). This lets the real CalorieInsightBody
// wiring be mounted and asserted without a native renderer.
const STUB: InsightBodyComponents = {
  Text: ({ children }) => createElement("div", { "data-role": "text" }, children),
  Strong: ({ children }) => createElement("span", { "data-role": "strong" }, children),
  ChipsCaption: ({ children }) => createElement("div", { "data-role": "chips-caption" }, children),
  ChipsRow: ({ children }) => createElement("div", { "data-role": "chips" }, children),
  Chip: ({ onPress, children }) => createElement("div", { "data-role": "chip", onPress }, children),
  ChipIcon: ({ name, color }) =>
    createElement("span", { "data-role": "chip-icon", "data-name": name, "data-color": color }),
  ChipName: ({ children }) => createElement("span", { "data-role": "chip-name" }, children),
  ChipValue: ({ color, children }) =>
    createElement("span", { "data-role": "chip-value", "data-color": color }, children),
};

// Flatten all text under a node (recursing into nested Strong/Fragment children).
function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  if (typeof (node as any) === "number") return String(node);
  return (node.children ?? []).map((c) => textOf(c as any)).join("");
}

function mount(input: InsightInput) {
  const insight = getCalorieInsight(input);
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(CalorieInsightBody, { insight, components: STUB }),
    );
  });
  const root = renderer.root;
  const byRole = (role: string) =>
    root.findAll((n) => (n.props as any)?.["data-role"] === role);
  return { insight, root, byRole };
}

// A balanced goal set; per-state totals below steer which template fires.
const GOALS = { kcal: 2000, protein: 150, carbs: 200, fats: 67 };
// Fixed seed so the engine's copy/food rotation is deterministic across runs.
const SEED = 0;

const DAY_STATES: { name: string; totals: InsightInput["totals"]; macro: "protein" | "carbs" | "fats" }[] = [
  { name: "start", totals: { kcal: 0, protein: 0, carbs: 0, fats: 0 }, macro: "protein" },
  { name: "over", totals: { kcal: 2300, protein: 150, carbs: 200, fats: 67 }, macro: "protein" },
  { name: "balanced", totals: { kcal: 2000, protein: 150, carbs: 200, fats: 67 }, macro: "protein" },
  { name: "macro-protein", totals: { kcal: 1000, protein: 0, carbs: 200, fats: 67 }, macro: "protein" },
  { name: "macro-carbs", totals: { kcal: 1000, protein: 150, carbs: 0, fats: 67 }, macro: "carbs" },
  { name: "macro-fats", totals: { kcal: 1000, protein: 150, carbs: 200, fats: 0 }, macro: "fats" },
];

for (const state of DAY_STATES) {
  test(`renders the tip copy and both food chips for the ${state.name} day-state`, () => {
    const { insight, byRole } = mount({ totals: state.totals, goals: GOALS, seed: SEED });

    // Sanity: the engine actually produced the day-state we are exercising.
    assert.equal(insight.featuredMacro, state.macro);

    // The full tip sentence renders, in order, exactly as the engine wrote it.
    const tip = byRole("text");
    assert.equal(tip.length, 1);
    const expectedTip = insight.segments.map((s) => s.text).join("");
    assert.equal(textOf(tip[0]), expectedTip);
    assert.ok(expectedTip.length > 0);

    // Emphasized runs render as distinct Strong nodes, one per strong segment,
    // with the exact emphasized text (and never the plain text).
    const strongSegments = insight.segments.filter((s) => s.strong);
    const strongNodes = byRole("strong");
    assert.equal(strongNodes.length, strongSegments.length);
    assert.deepEqual(
      strongNodes.map((n) => textOf(n)).sort(),
      strongSegments.map((s) => s.text).sort(),
    );

    // The chips caption renders exactly what the engine produced, framing the
    // food ideas (and is never empty).
    const caption = byRole("chips-caption");
    assert.equal(caption.length, 1);
    assert.equal(textOf(caption[0]), insight.chipsCaption);
    assert.ok(insight.chipsCaption.length > 0);

    // Both food chips appear, with the engine's names and "+Ng" grams.
    const chips = byRole("chip");
    assert.equal(chips.length, 2);
    assert.equal(insight.chips.length, 2);
    const names = byRole("chip-name").map((n) => textOf(n));
    assert.deepEqual(names, insight.chips.map((c) => c.name));
    const values = byRole("chip-value").map((n) => textOf(n));
    assert.deepEqual(values, insight.chips.map((c) => `+${c.value}g`));

    // Chips (icon + grams) are colored to the featured macro.
    const expectedColor = insightMacroColor(insight.featuredMacro);
    for (const icon of byRole("chip-icon")) {
      assert.equal((icon.props as any)["data-color"], expectedColor);
    }
    for (const val of byRole("chip-value")) {
      assert.equal((val.props as any)["data-color"], expectedColor);
    }
    // Icon names come straight from the chosen foods.
    assert.deepEqual(
      byRole("chip-icon").map((n) => (n.props as any)["data-name"]),
      insight.chips.map((c) => c.icon),
    );
  });
}

// Tapping a chip must call back with that exact food chip, so the host can open
// its detail popup for the right food.
test("invokes onChipPress with the tapped food chip", () => {
  const insight = getCalorieInsight({
    totals: { kcal: 1000, protein: 150, carbs: 0, fats: 67 },
    goals: GOALS,
    seed: SEED,
  });
  const calls: (typeof insight.chips)[number][] = [];
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(CalorieInsightBody, { insight, components: STUB, onChipPress: (c) => calls.push(c) }),
    );
  });
  const chips = renderer.root.findAll((n) => (n.props as any)?.["data-role"] === "chip");
  assert.equal(chips.length, 2);
  act(() => {
    (chips[1].props as any).onPress();
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], insight.chips[1]);
});

// The featured-macro color mapping is the exact wiring a render mistake would
// silently break, so pin each macro to its brand color explicitly.
test("maps each featured macro to its distinct brand color", () => {
  assert.equal(insightMacroColor("protein"), colors.protein);
  assert.equal(insightMacroColor("carbs"), colors.carbs);
  assert.equal(insightMacroColor("fats"), colors.fats);
});
