import type { Ionicons } from "@expo/vector-icons";
import type { GoalId } from "@/lib/profile";

// Shared goal catalog for the goal and main-focus onboarding screens. Ids are
// the long-standing stored values; see GOAL_IDS in lib/profile.ts.
export type GoalOption = {
  id: GoalId;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const GOALS: GoalOption[] = [
  { id: "lose-weight", label: "Lose Weight", desc: "Shed gently, feel light", icon: "trending-down-outline" },
  { id: "tone", label: "Tone & Sculpt", desc: "Define and strengthen", icon: "body-outline" },
  { id: "strength", label: "Build Strength", desc: "Grow power and stamina", icon: "barbell-outline" },
  { id: "flexibility", label: "Improve Flexibility", desc: "Move with ease", icon: "accessibility-outline" },
  { id: "wellness", label: "Mindful Wellness", desc: "Balance body and mind", icon: "leaf-outline" },
  { id: "energy", label: "Boost Energy", desc: "Feel vibrant daily", icon: "flash-outline" },
];

export const goalLabel = (id: string): string => GOALS.find((g) => g.id === id)?.label ?? id;
