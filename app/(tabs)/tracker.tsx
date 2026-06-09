import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { HelpButton } from "@/components/HelpButton";
import { PageHeader } from "@/components/PageHeader";
import { CaloriesTracker } from "@/components/trackers/CaloriesTracker";
import { WaterTracker } from "@/components/trackers/WaterTracker";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

type TrackerMode = "calories" | "water";

// Per-mode header content. Keeping the original Calorie/Water eyebrows and help
// copy preserves each tracker's look exactly; the segmented toggle below the
// header is what lets a member switch between them inside the one tab.
const HEAD: Record<TrackerMode, { eyebrow: string; title: string; accent: string }> = {
  calories: { eyebrow: "AI POWERED", title: "Calorie", accent: "Tracker" },
  water: { eyebrow: "WELLNESS", title: "Stay", accent: "Hydrated" },
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
};

const SEGMENTS: { key: TrackerMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "calories", label: "Calories", icon: "flame-outline" },
  { key: "water", label: "Water", icon: "water-outline" },
];

// Single bottom-bar tab that hosts both the Calorie and Water trackers. The
// active tracker keeps its full original screen (GradientBackground + ScrollView
// + content); this screen only supplies the shared header + the toggle that
// chooses which one renders. An optional `?mode=` param lets other screens deep
// link straight to a specific tracker (e.g. the home dashboard's quick actions).
export default function Tracker() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<TrackerMode>(params.mode === "water" ? "water" : "calories");

  useEffect(() => {
    if (params.mode === "water" || params.mode === "calories") setMode(params.mode);
  }, [params.mode]);

  const select = (next: TrackerMode) => {
    if (next === mode) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
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
          const inner = (
            <View style={styles.segInner}>
              <Ionicons name={s.icon} size={16} color={active ? colors.onPrimaryStrong : colors.muted} />
              <Text style={[styles.segLabel, { color: active ? colors.onPrimaryStrong : colors.muted }]}>
                {s.label}
              </Text>
            </View>
          );
          return (
            <Pressable key={s.key} style={styles.segItem} onPress={() => select(s.key)}>
              {active ? (
                <LinearGradient
                  colors={colors.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.segActive}
                >
                  {inner}
                </LinearGradient>
              ) : (
                inner
              )}
            </Pressable>
          );
        })}
      </View>
    </>
  );

  return mode === "calories" ? <CaloriesTracker header={header} /> : <WaterTracker header={header} />;
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    gap: 6,
    marginTop: 18,
    backgroundColor: colors.accentTintFaint,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    padding: 5,
  },
  segItem: { flex: 1, borderRadius: colors.radiusSm, overflow: "hidden" },
  segActive: { borderRadius: colors.radiusSm },
  segInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
  },
  segLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, letterSpacing: 0.2 },
});
