import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useInsets } from "@/hooks/useInsets";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";
import { goalLabel } from "@/constants/goals";
import { getRecommendedProgram } from "@/lib/recommendation";
import { PROGRAMS } from "@/constants/programs";

const DURATION_LABELS: Record<string, string> = {
  "10_15": "10-15 min",
  "20_30": "20-30 min",
  "30_45": "30-45 min",
  "45_plus": "45+ min",
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

// Final onboarding screen: shows the plan summary, locks in the recommended
// program, and marks onboarding complete before handing over to the paywall.
export default function PlanReadyStep() {
  const router = useRouter();
  const insets = useInsets();
  const { profile, updateProfile, ready } = useData();
  const { completeOnboarding } = useAuth();
  const [saving, setSaving] = useState(false);

  const program = useMemo(() => getRecommendedProgram(profile, PROGRAMS), [profile]);

  const rows = [
    { icon: "heart-outline" as const, label: "Goal", value: profile.primaryGoal ? goalLabel(profile.primaryGoal) : "Feeling great" },
    { icon: "leaf-outline" as const, label: "Level", value: profile.fitnessLevel ? LEVEL_LABELS[profile.fitnessLevel] : "Beginner" },
    { icon: "calendar-outline" as const, label: "Schedule", value: profile.daysPerWeek ? `${profile.daysPerWeek} days/week` : "Flexible" },
    { icon: "time-outline" as const, label: "Workout length", value: profile.durationPreference ? DURATION_LABELS[profile.durationPreference] : "Flexible" },
    { icon: "flame-outline" as const, label: "Calories", value: `${profile.calorieGoal} kcal/day` },
    { icon: "water-outline" as const, label: "Water", value: `${profile.waterGoalMl} ml/day` },
    { icon: "sparkles-outline" as const, label: "Recommended plan", value: program?.title ?? "Coach's picks" },
  ];

  const start = async () => {
    setSaving(true);
    try {
      await updateProfile({
        programId: program?.id ?? null,
        programStartedAt: program ? Date.now() : null,
      });
      await completeOnboarding();
      router.push("/onboarding/paywall");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles" size={26} color={colors.accent} />
        </View>
        <Text style={styles.title}>Your plan is ready</Text>
        <Text style={styles.subtitle}>Here's the journey we shaped around your answers. You can adjust any of it later.</Text>

        <View style={styles.card}>
          {rows.map((r, i) => (
            <View key={r.label} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={styles.rowIcon}>
                <Ionicons name={r.icon} size={17} color={colors.accent} />
              </View>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {r.value}
              </Text>
            </View>
          ))}
        </View>

        {program ? <Text style={styles.programDesc}>{program.description}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Start My Journey" icon="sparkles-outline" onPress={start} loading={saving} disabled={!ready} />
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: { fontFamily: fonts.serif, fontSize: 36, color: colors.foreground, lineHeight: 40 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 10, marginBottom: 24, lineHeight: 22 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    paddingHorizontal: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.cardBorder },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  rowValue: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground, textAlign: "right" },
  programDesc: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: colors.card,
  },
});
