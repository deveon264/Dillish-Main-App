import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
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
import type { DurationPreference } from "@/lib/profile";
import { haptics } from "@/lib/haptics";

const DAYS = [2, 3, 4, 5, 6];

const DURATIONS: { id: DurationPreference; label: string; desc: string }[] = [
  { id: "10_15", label: "10-15 min", desc: "Short and sweet" },
  { id: "20_30", label: "20-30 min", desc: "A focused session" },
  { id: "30_45", label: "30-45 min", desc: "Time to go deeper" },
  { id: "45_plus", label: "45+ min", desc: "The full experience" },
];

export default function ScheduleStep() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { total, withMode } = useOnboardingMode();
  const { answers: profile, save: updateProfile, ready } = useOnboardingAnswers();
  const [days, setDays] = useState<number | null>(profile.daysPerWeek);
  const [duration, setDuration] = useState<DurationPreference | null>(profile.durationPreference);

  const next = async () => {
    if (!days || !duration) return;
    haptics.selection();
    await updateProfile({ daysPerWeek: days, durationPreference: duration });
    router.push(withMode("/onboarding/body-focus") as any);
  };

  return (
    <GradientBackground>
      <OnboardDecor />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader step={5} total={total} />
        <Reveal index={0}>
        <Text style={styles.title}>How often do you want to train?</Text>
        <Text style={styles.subtitle}>A rhythm you can keep beats a perfect week you can't.</Text>
        </Reveal>

        <View style={styles.dayRow}>
          {DAYS.map((d, i) => {
            const on = days === d;
            return (
              <Bouncy
                key={d}
                style={[styles.dayChip, on && styles.dayChipOn]}
                onPress={() => {
                  if (on) return;
                  haptics.selection();
                  setDays(d);
                }}
              >
                <Text style={[styles.dayNum, on && styles.dayNumOn]}>{d}</Text>
                <Text style={[styles.dayUnit, on && styles.dayUnitOn]}>days</Text>
              </Bouncy>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>PREFERRED WORKOUT LENGTH</Text>
        <View style={styles.list}>
          {DURATIONS.map((o, i) => {
            const on = duration === o.id;
            return (
              <Bouncy
                key={o.id}
                style={[styles.item, on && styles.itemOn]}
                onPress={() => {
                  if (on) return;
                  haptics.selection();
                  setDuration(o.id);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemLabel}>{o.label}</Text>
                  <Text style={styles.itemDesc}>{o.desc}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
              </Bouncy>
            );
          })}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Continue" iconRight="arrow-forward" onPress={next} disabled={!days || !duration || !ready} />
      </View>
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  title: { fontFamily: fonts.serif, fontSize: 36, color: colors.foreground, lineHeight: 40 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 10, marginBottom: 24, lineHeight: 22 },
  dayRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  dayChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusSm,
  },
  dayChipOn: { borderColor: colors.accent, backgroundColor: colors.cardElevated },
  dayNum: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
  dayNumOn: { color: colors.accent },
  dayUnit: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 2 },
  dayUnitOn: { color: colors.accent },
  sectionLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.mutedForeground,
    marginBottom: 12,
  },
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
  itemLabel: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  itemDesc: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
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
