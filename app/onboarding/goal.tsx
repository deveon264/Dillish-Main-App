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
import { GOALS } from "@/constants/goals";
import { haptics } from "@/lib/haptics";

export default function GoalStep() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { personalize, total, withMode } = useOnboardingMode();
  const { answers: profile, save: updateProfile, ready } = useOnboardingAnswers();
  const [selected, setSelected] = useState<string[]>(profile.goals);

  const toggle = (id: string) => {
    haptics.selection();
    setSelected((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  const next = async () => {
    // Dropping a goal also drops it as the main focus, so the next screen
    // never preselects something that is no longer chosen.
    const patch: Parameters<typeof updateProfile>[0] = { goals: selected };
    if (profile.primaryGoal && !selected.includes(profile.primaryGoal)) patch.primaryGoal = null;
    haptics.selection();
    await updateProfile(patch);
    router.push(withMode("/onboarding/main-focus") as any);
  };

  return (
    <GradientBackground>
      <OnboardDecor />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1's back always works: to Home in personalize mode (history
            pop), and explicitly to the welcome screen in the signup flow. */}
        <StepHeader
          step={1}
          total={total}
          onBack={personalize ? undefined : () => router.replace("/welcome")}
        />
        <Reveal index={0}>
          <Text style={styles.title}>What brings you here?</Text>
          <Text style={styles.subtitle}>Choose all that resonate. We'll shape your experience around them.</Text>
        </Reveal>

        <View style={styles.list}>
          {GOALS.map((g, i) => {
            const on = selected.includes(g.id);
            return (
              <Bouncy key={g.id} style={[styles.item, on && styles.itemOn]} onPress={() => toggle(g.id)}>
                <View style={[styles.itemIcon, on && styles.itemIconOn]}>
                  <Ionicons name={g.icon} size={22} color={on ? colors.onPrimary : colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemLabel}>{g.label}</Text>
                  <Text style={styles.itemDesc}>{g.desc}</Text>
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
        <Button label="Continue" iconRight="arrow-forward" onPress={next} disabled={selected.length === 0 || !ready} />
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
