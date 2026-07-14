import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { StepHeader } from "@/components/StepHeader";
import { Reveal, Bouncy, OnboardDecor } from "@/components/onboarding/OnboardKit";
import { WaterDroplet } from "@/components/WaterDroplet";
import { useOnboardingAnswers } from "@/hooks/useOnboardingAnswers";
import { useInsets } from "@/hooks/useInsets";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

const PRESETS = [2000, 2500, 3000];
const MIN = 1000;
const MAX = 5000;
const STEP = 250;

export default function WaterStep() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { answers: profile, save: updateProfile, ready } = useOnboardingAnswers();
  const [goal, setGoal] = useState(profile.waterGoalMl || 2500);
  const [saving, setSaving] = useState(false);

  // Onboarding completes on the plan-ready screen, so a user who quits here
  // resumes onboarding instead of landing on Home without a program.
  const finish = async () => {
    haptics.selection();
    setSaving(true);
    try {
      await updateProfile({ waterGoalMl: goal });
      router.push("/onboarding/plan-ready");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GradientBackground>
      <OnboardDecor />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader step={10} total={10} />
        <Reveal index={0}>
          <Text style={styles.title}>Daily hydration</Text>
          <Text style={styles.subtitle}>Set a water goal that feels right. You can always adjust it later.</Text>
        </Reveal>

        <Reveal index={1}>
          <View style={styles.dropWrap}>
            <WaterDroplet size={170} progress={(goal - MIN) / (MAX - MIN)} />
            <View style={styles.dropCenter} pointerEvents="none">
              <Text style={styles.dropValue}>{(goal / 1000).toFixed(goal % 1000 === 0 ? 0 : 1)}</Text>
              <Text style={styles.dropUnit}>liters</Text>
            </View>
          </View>
        </Reveal>

        <View style={styles.stepper}>
          <Bouncy
            style={styles.stepBtn}
            onPress={() => setGoal((g) => Math.max(MIN, g - STEP))}
            hitSlop={8}
          >
            <Ionicons name="remove" size={22} color={colors.foreground} />
          </Bouncy>
          <Text style={styles.stepValue}>{goal} ml</Text>
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
            const on = goal === p;
            return (
              <Bouncy
                key={p}
                style={[styles.preset, on && styles.presetOn]}
                onPress={() => {
                  if (on) return;
                  haptics.selection();
                  setGoal(p);
                }}
              >
                <Text style={[styles.presetVal, on && styles.presetValOn]}>{(p / 1000).toFixed(1)}L</Text>
                <Text style={[styles.presetLabel, on && styles.presetLabelOn]}>
                  {p === 2000 ? "Light" : p === 2500 ? "Balanced" : "Active"}
                </Text>
              </Bouncy>
            );
          })}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Continue" iconRight="arrow-forward" onPress={finish} loading={saving} disabled={!ready} />
      </View>
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  title: { fontFamily: fonts.serif, fontSize: 36, color: colors.foreground, lineHeight: 40 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 10, lineHeight: 22 },
  dropWrap: { alignItems: "center", justifyContent: "center", marginTop: 30, marginBottom: 10 },
  dropCenter: { position: "absolute", alignItems: "center" },
  dropValue: { fontFamily: fonts.serifSemibold, fontSize: 40, color: colors.foreground },
  dropUnit: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground, opacity: 0.8, marginTop: -4 },
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
  stepValue: { fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.foreground, width: 100, textAlign: "center" },
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
  presetVal: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground },
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
