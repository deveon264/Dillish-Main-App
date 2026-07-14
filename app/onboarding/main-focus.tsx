import React, { useMemo, useState } from "react";
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

// Single-select among the goals chosen on the previous screen. The pick
// becomes primaryGoal (drives the recommended program); the rest act as
// secondary goals in ranking.
export default function MainFocusStep() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { total, withMode } = useOnboardingMode();
  const { answers: profile, save: updateProfile, ready } = useOnboardingAnswers();

  const options = useMemo(() => GOALS.filter((g) => profile.goals.includes(g.id)), [profile.goals]);
  const [selected, setSelected] = useState<string | null>(
    profile.primaryGoal && profile.goals.includes(profile.primaryGoal)
      ? profile.primaryGoal
      : options.length === 1
        ? options[0].id
        : null
  );

  const next = async () => {
    if (!selected) return;
    haptics.selection();
    await updateProfile({ primaryGoal: selected });
    router.push(withMode("/onboarding/fitness-level") as any);
  };

  return (
    <GradientBackground>
      <OnboardDecor />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader step={2} total={total} />
        <Reveal index={0}>
        <Text style={styles.title}>What's your main focus?</Text>
        <Text style={styles.subtitle}>We'll use this to shape your first plan.</Text>
        </Reveal>

        <View style={styles.list}>
          {options.map((g, i) => {
            const on = selected === g.id;
            return (
              <Bouncy
                key={g.id}
                style={[styles.item, on && styles.itemOn]}
                onPress={() => {
                  if (on) return;
                  haptics.selection();
                  setSelected(g.id);
                }}
              >
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
        <Button label="Continue" iconRight="arrow-forward" onPress={next} disabled={!selected || !ready} />
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
