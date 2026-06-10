import React, { ComponentType, ReactNode } from "react";
import { colors } from "@/constants/colors";
import type { CalorieInsight, Macro } from "@/lib/calorieInsights";

// Map the featured macro to its brand color so the chips (icon + grams) match
// the macro the tip is steering toward. Protein is the default for the
// non-macro states (start / over / balanced), which all feature protein.
export function insightMacroColor(macro: Macro): string {
  return macro === "carbs"
    ? colors.carbs
    : macro === "fats"
      ? colors.fats
      : colors.protein;
}

// The host elements the insight body renders through. The app passes its
// react-native components (styled Text/View/Ionicons); tests pass lightweight
// stand-ins so the pure wiring (which segment is emphasized, which color the
// chips take, that both foods appear) can be asserted without a native renderer.
export type InsightBodyComponents = {
  // Wraps the whole tip sentence.
  Text: ComponentType<{ children?: ReactNode }>;
  // Emphasized ("strong") run inside the tip.
  Strong: ComponentType<{ children?: ReactNode }>;
  // Row that holds the two food chips.
  ChipsRow: ComponentType<{ children?: ReactNode }>;
  // A single food chip container.
  Chip: ComponentType<{ children?: ReactNode }>;
  // The chip's leading macro icon.
  ChipIcon: ComponentType<{ name: string; color: string }>;
  // The food name.
  ChipName: ComponentType<{ numberOfLines?: number; children?: ReactNode }>;
  // The grams the serving adds, colored to the featured macro.
  ChipValue: ComponentType<{ color: string; children?: ReactNode }>;
};

// Renders the dynamic part of the calorie-tracker insight card: the tip
// sentence (with its emphasized runs) and the two food-idea chips. Kept free of
// any react-native import so it can be mounted in a plain Node test renderer;
// the styling lives in the host components passed via `components`.
export function CalorieInsightBody({
  insight,
  components,
  color = insightMacroColor(insight.featuredMacro),
}: {
  insight: CalorieInsight;
  components: InsightBodyComponents;
  color?: string;
}) {
  const C = components;
  return (
    <>
      <C.Text>
        {insight.segments.map((seg, i) =>
          seg.strong ? (
            <C.Strong key={i}>{seg.text}</C.Strong>
          ) : (
            <React.Fragment key={i}>{seg.text}</React.Fragment>
          ),
        )}
      </C.Text>
      <C.ChipsRow>
        {insight.chips.map((chip, i) => (
          <C.Chip key={i}>
            <C.ChipIcon name={chip.icon} color={color} />
            <C.ChipName numberOfLines={1}>{chip.name}</C.ChipName>
            <C.ChipValue color={color}>+{chip.value}g</C.ChipValue>
          </C.Chip>
        ))}
      </C.ChipsRow>
    </>
  );
}
