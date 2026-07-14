import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { StepHeader } from "@/components/StepHeader";
import { Reveal, Bouncy, OnboardDecor } from "@/components/onboarding/OnboardKit";
import { ProgressRing } from "@/components/ProgressRing";
import { useOnboardingAnswers } from "@/hooks/useOnboardingAnswers";
import { useInsets } from "@/hooks/useInsets";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

const PRESETS: { value: number; label: string }[] = [
  { value: 1500, label: "Lose" },
  { value: 2000, label: "Maintain" },
  { value: 2500, label: "Gain" },
];
const MIN = 1200;
const MAX = 3500;
const STEP = 50;

export default function CalorieStep() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { answers: profile, save: updateProfile, ready } = useOnboardingAnswers();
  const [goal, setGoal] = useState(profile.calorieGoal || 2000);
  const [saving, setSaving] = useState(false);

  const next = async () => {
    haptics.selection();
    setSaving(true);
    await updateProfile({ calorieGoal: goal });
    router.push("/onboarding/water");
  };

  return (
    <GradientBackground>
      <OnboardDecor />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader step={9} total={10} />
        <Reveal index={0}>
        <Text style={styles.title}>Daily calories</Text>
        <Text style={styles.subtitle}>Set a daily calorie goal that works for you. You can always change it later in the app.</Text>
        </Reveal>

        <View style={styles.ringWrap}>
          <ProgressRing
            size={170}
            strokeWidth={12}
            progress={(goal - MIN) / (MAX - MIN)}
            gradientId="onboardCalorieRing"
          >
            <View style={styles.ringCenter} pointerEvents="none">
              <Ionicons name="flame" size={24} color={colors.primary} />
              <Text style={styles.ringValue}>{goal.toLocaleString()}</Text>
              <Text style={styles.ringUnit}>kcal / day</Text>
            </View>
          </ProgressRing>
        </View>

        <View style={styles.stepper}>
          <Bouncy
            style={styles.stepBtn}
            onPress={() => setGoal((g) => Math.max(MIN, g - STEP))}
            hitSlop={8}
          >
            <Ionicons name="remove" size={22} color={colors.foreground} />
          </Bouncy>
          <Text style={styles.stepValue}>{goal} kcal</Text>
          <Bouncy
            style={styles.stepBtn}
            onPress={() => setGoal((g) => Math.min(MAX, g + STEP))}
            hitSlop={8}
          >
            <Ionicons name="add" size={22} color={colors.foreground} />
          </Bouncy>
        </View>

        <View style={styles.presets}>
          {PRESETS.map((p, i) => {
            const on = goal === p.value;
            return (
              <Bouncy
                key={p.value}
                style={[styles.preset, on && styles.presetOn]}
                onPress={() => {
                  if (on) return;
                  haptics.selection();
                  setGoal(p.value);
                }}
              >
                <Text style={[styles.presetVal, on && styles.presetValOn]}>{p.value.toLocaleString()}</Text>
                <Text style={[styles.presetLabel, on && styles.presetLabelOn]}>{p.label}</Text>
              </Bouncy>
            );
          })}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Continue" iconRight="arrow-forward" onPress={next} loading={saving} disabled={!ready} />
      </View>
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  title: { fontFamily: fonts.serif, fontSize: 36, color: colors.foreground, lineHeight: 40 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 10, lineHeight: 22 },
  ringWrap: { alignItems: "center", justifyContent: "center", marginTop: 30, marginBottom: 10 },
  ringCenter: { position: "absolute", alignItems: "center" },
  ringValue: { fontFamily: fonts.serifSemibold, fontSize: 38, color: colors.foreground, marginTop: 2 },
  ringUnit: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground, opacity: 0.8, marginTop: -2 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginTop: 16 },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.foreground, width: 110, textAlign: "center" },
  presets: { flexDirection: "row", gap: 12, marginTop: 30 },
  preset: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  presetOn: { borderColor: colors.accent, backgroundColor: colors.cardElevated },
  presetVal: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
  presetValOn: { color: colors.accent },
  presetLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  presetLabelOn: { color: colors.foreground },
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
