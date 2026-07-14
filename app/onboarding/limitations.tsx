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
import { getRecommendedProgram } from "@/lib/recommendation";
import { PROGRAMS } from "@/constants/programs";
import type { LimitationId } from "@/lib/profile";
import { haptics } from "@/lib/haptics";

const NONE = "none" as const;
type OptionId = LimitationId | typeof NONE;

const OPTIONS: { id: OptionId; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "knee_friendly", label: "Knee-friendly workouts", desc: "Gentle on the knees", icon: "walk-outline" },
  { id: "back_friendly", label: "Back-friendly workouts", desc: "Gentle on the back", icon: "swap-vertical-outline" },
  { id: "low_impact", label: "Low impact only", desc: "Nothing high intensity", icon: "water-outline" },
  { id: "no_jumping", label: "No jumping", desc: "Both feet stay grounded", icon: "remove-circle-outline" },
  { id: "postpartum_friendly", label: "Postpartum-friendly", desc: "Kind to a recovering core", icon: "flower-outline" },
  { id: NONE, label: "No limitations", desc: "I'm ready for anything", icon: "checkmark-circle-outline" },
];

// "No limitations" is mutually exclusive and stored as an empty array. These
// answers only filter which workouts we suggest; they are not medical advice.
export default function LimitationsStep() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { personalize, total, withMode } = useOnboardingMode();
  const { answers: profile, save: updateProfile, ready } = useOnboardingAnswers();
  const [selected, setSelected] = useState<OptionId[]>(
    profile.limitations.length > 0 ? profile.limitations : []
  );
  const [saving, setSaving] = useState(false);

  const toggle = (id: OptionId) => {
    haptics.selection();
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((l) => l !== id);
      if (id === NONE) return [NONE];
      return [...prev.filter((l) => l !== NONE), id];
    });
  };

  const next = async () => {
    const limitations = selected.filter((l): l is LimitationId => l !== NONE);
    if (personalize) {
      // Personalize shortcut for existing accounts: this is the last step, so
      // pick the program here and head straight home.
      setSaving(true);
      try {
        const program = getRecommendedProgram({ ...profile, limitations }, PROGRAMS);
        await updateProfile({
          limitations,
          programId: program?.id ?? null,
          programStartedAt: program ? Date.now() : null,
        });
        haptics.success();
        router.replace("/(tabs)");
      } finally {
        setSaving(false);
      }
      return;
    }
    haptics.selection();
    await updateProfile({ limitations });
    router.push("/onboarding/profile");
  };

  return (
    <GradientBackground>
      <OnboardDecor />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader step={7} total={total} />
        <Reveal index={0}>
        <Text style={styles.title}>Anything we should be mindful of?</Text>
        <Text style={styles.subtitle}>
          We use this only to choose kinder workouts for you. It isn't medical advice, always listen to your body.
        </Text>
        </Reveal>

        <View style={styles.list}>
          {OPTIONS.map((o, i) => {
            const on = selected.includes(o.id);
            return (
              <Bouncy key={o.id} style={[styles.item, on && styles.itemOn]} onPress={() => toggle(o.id)}>
                <View style={[styles.itemIcon, on && styles.itemIconOn]}>
                  <Ionicons name={o.icon} size={22} color={on ? colors.onPrimary : colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemLabel}>{o.label}</Text>
                  <Text style={styles.itemDesc}>{o.desc}</Text>
                </View>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Ionicons name="checkmark" size={15} color={colors.onPrimary} /> : null}
                </View>
              </Bouncy>
            );
          })}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          label={personalize ? "Build My Plan" : "Continue"}
          iconRight={personalize ? undefined : "arrow-forward"}
          icon={personalize ? "sparkles-outline" : undefined}
          onPress={next}
          loading={saving}
          disabled={selected.length === 0 || !ready}
        />
      </View>
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  title: { fontFamily: fonts.serif, fontSize: 36, color: colors.foreground, lineHeight: 40 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 10, marginBottom: 24, lineHeight: 22 },
  list: { gap: 12 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 16,
  },
  itemOn: { borderColor: colors.accent, backgroundColor: colors.cardElevated },
  itemIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  itemIconOn: { backgroundColor: colors.accent },
  itemLabel: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  itemDesc: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
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
