import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { StepHeader } from "@/components/StepHeader";
import { Reveal, Bouncy, OnboardDecor } from "@/components/onboarding/OnboardKit";
import { useOnboardingAnswers } from "@/hooks/useOnboardingAnswers";
import { useInsets } from "@/hooks/useInsets";
import { useOnboardingMode } from "@/hooks/useOnboardingMode";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import type { BodyFocusId } from "@/lib/profile";
import { haptics } from "@/lib/haptics";

const OPTIONS: { id: BodyFocusId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "full_body", label: "Full Body", icon: "body-outline" },
  { id: "core_abs", label: "Core & Abs", icon: "ellipse-outline" },
  { id: "glutes", label: "Glutes", icon: "heart-outline" },
  { id: "legs", label: "Legs", icon: "walk-outline" },
  { id: "arms", label: "Arms", icon: "barbell-outline" },
  { id: "upper_body", label: "Upper Body", icon: "chevron-up-circle-outline" },
  { id: "back_posture", label: "Back & Posture", icon: "swap-vertical-outline" },
  { id: "mobility", label: "Mobility", icon: "accessibility-outline" },
];

export default function BodyFocusStep() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { total, withMode } = useOnboardingMode();
  const { answers: profile, save: updateProfile, ready } = useOnboardingAnswers();
  const [selected, setSelected] = useState<BodyFocusId[]>(profile.bodyFocus);

  const toggle = (id: BodyFocusId) => {
    haptics.selection();
    setSelected((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const next = async () => {
    haptics.selection();
    await updateProfile({ bodyFocus: selected });
    router.push(withMode("/onboarding/limitations") as any);
  };

  return (
    <GradientBackground>
      <OnboardDecor />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader step={6} total={total} />
        <Reveal index={0}>
        <Text style={styles.title}>What areas do you want to focus on?</Text>
        <Text style={styles.subtitle}>Choose as many as you like. We'll weave them into your plan.</Text>
        </Reveal>

        <View style={styles.grid}>
          {OPTIONS.map((o, i) => {
            const on = selected.includes(o.id);
            return (
              <Bouncy key={o.id} style={[styles.cell, on && styles.cellOn]} onPress={() => toggle(o.id)}>
                <View style={[styles.cellIcon, on && styles.cellIconOn]}>
                  <Ionicons name={o.icon} size={20} color={on ? colors.onPrimary : colors.accent} />
                </View>
                <Text style={[styles.cellLabel, on && styles.cellLabelOn]} numberOfLines={1}>
                  {o.label}
                </Text>
              </Bouncy>
            );
          })}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Continue" iconRight="arrow-forward" onPress={next} disabled={selected.length === 0 || !ready} />
      </View>
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  title: { fontFamily: fonts.serif, fontSize: 36, color: colors.foreground, lineHeight: 40 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 10, marginBottom: 24, lineHeight: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: {
    width: "47.5%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cellOn: { borderColor: colors.accent, backgroundColor: colors.cardElevated },
  cellIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cellIconOn: { backgroundColor: colors.accent },
  cellLabel: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  cellLabelOn: { color: colors.accent },
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
