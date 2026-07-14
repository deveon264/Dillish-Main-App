import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { HelpButton } from "@/components/HelpButton";
import { PageHeader } from "@/components/PageHeader";
import { CaloriesTracker } from "@/components/trackers/CaloriesTracker";
import { WaterTracker } from "@/components/trackers/WaterTracker";
import { ProgressTracker } from "@/components/trackers/ProgressTracker";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

type TrackerMode = "calories" | "water" | "progress";

// The Progress segment opens the full Progress screen, which keeps its own
// internal Progress/Photos sub-tabs.
const WELLNESS_HELP = {
  title: "Your Progress",
  intro: "See how far you've come and keep your goals in view.",
  points: [
    "Track your weight over time and watch the trend take shape.",
    "Explore charts that show your activity and results at a glance.",
    "Log new measurements to keep your progress up to date.",
  ],
};

// Per-segment header: eyebrow + a serif-italic accent word, chosen by the active
// tracker mode.
const HEAD: Record<TrackerMode, { eyebrow: string; title: string; accent: string }> = {
  calories: { eyebrow: "AI POWERED", title: "Calorie", accent: "Tracker" },
  water: { eyebrow: "HYDRATION", title: "Water", accent: "Tracker" },
  progress: { eyebrow: "WELLNESS", title: "Your", accent: "Progress" },
};

const HELP: Record<TrackerMode, { title: string; intro: string; points: string[] }> = {
  calories: {
    title: "Calorie Tracker",
    intro: "Log what you eat and stay on top of your daily goal.",
    points: [
      "Snap a photo, scan a barcode, or type a meal, and AI does the math.",
      "See your calories and protein, carbs, and fats against your goal.",
      "Review everything you've logged today in one place.",
    ],
  },
  water: {
    title: "Stay Hydrated",
    intro: "Keep your water intake on track every day.",
    points: [
      "Log each glass with a tap as you drink through the day.",
      "Watch your progress fill toward your daily hydration goal.",
      "Switch days to review how well you stayed hydrated before.",
    ],
  },
  progress: WELLNESS_HELP,
};

const SEGMENTS: { key: TrackerMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "calories", label: "Calories", icon: "flame-outline" },
  { key: "water", label: "Water", icon: "water-outline" },
  { key: "progress", label: "Progress", icon: "trending-up" },
];

const MODE_KEYS = SEGMENTS.map((s) => s.key);
function isTrackerMode(v: string | undefined): v is TrackerMode {
  return !!v && (MODE_KEYS as string[]).includes(v);
}

// Single bottom-bar tab that hosts the Calorie, Water, and Progress trackers.
// The active tracker keeps its full original screen
// (GradientBackground + ScrollView + content); this screen only supplies the
// shared header + the toggle that chooses which one renders. An optional
// `?mode=` param lets other screens deep link straight to a specific tracker
// (e.g. the home dashboard's quick actions).
export default function Tracker() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<TrackerMode>(isTrackerMode(params.mode) ? params.mode : "calories");

  useEffect(() => {
    if (isTrackerMode(params.mode)) setMode(params.mode);
  }, [params.mode]);

  const select = (next: TrackerMode) => {
    if (next === mode) return;
    haptics.selection();
    setMode(next);
  };

  const header = (
    <>
      <PageHeader
        eyebrow={HEAD[mode].eyebrow}
        title={HEAD[mode].title}
        accent={HEAD[mode].accent}
        action={<HelpButton {...HELP[mode]} />}
      />
      <View style={styles.segment}>
        {SEGMENTS.map((s) => {
          const active = s.key === mode;
          return (
            <Pressable
              key={s.key}
              style={[styles.segItem, active && styles.segItemActive]}
              onPress={() => select(s.key)}
            >
              <Ionicons name={s.icon} size={13} color={active ? colors.onPrimary : colors.muted} />
              <Text style={[styles.segLabel, { color: active ? colors.onPrimary : colors.muted }]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  switch (mode) {
    case "water":
      return <WaterTracker header={header} />;
    case "progress":
      return <ProgressTracker header={header} />;
    default:
      return <CaloriesTracker header={header} />;
  }
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  segment: {
    flexDirection: "row",
    gap: 4,
    marginTop: 16,
    backgroundColor: "rgba(62, 39, 51, 0.05)",
    borderRadius: 999,
    padding: 4,
  },
  segItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 999,
  },
  segItemActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  segLabel: { fontFamily: fonts.sansSemibold, fontSize: 13 },
});
