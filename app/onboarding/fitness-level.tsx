import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { StepHeader } from "@/components/StepHeader";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { useOnboardingMode } from "@/hooks/useOnboardingMode";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";
import type { FitnessLevel } from "@/lib/profile";

const LEVELS: { id: FitnessLevel; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "beginner", label: "Beginner", desc: "I'm starting or getting back into it", icon: "leaf-outline" },
  { id: "intermediate", label: "Intermediate", desc: "I train sometimes", icon: "walk-outline" },
  { id: "advanced", label: "Advanced", desc: "I want a challenge", icon: "flame-outline" },
];

export default function FitnessLevelStep() {
  const router = useRouter();
  const insets = useInsets();
  const { total, withMode } = useOnboardingMode();
  const { profile, updateProfile, ready } = useData();
  const [selected, setSelected] = useState<FitnessLevel | null>(profile.fitnessLevel);

  const next = async () => {
    if (!selected) return;
    await updateProfile({ fitnessLevel: selected });
    router.push(withMode("/onboarding/equipment") as any);
  };

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader step={3} total={total} />
        <Text style={styles.title}>What's your fitness level?</Text>
        <Text style={styles.subtitle}>Be honest, we'll meet you exactly where you are.</Text>

        <View style={styles.list}>
          {LEVELS.map((l) => {
            const on = selected === l.id;
            return (
              <Pressable key={l.id} style={[styles.item, on && styles.itemOn]} onPress={() => setSelected(l.id)}>
                <View style={[styles.itemIcon, on && styles.itemIconOn]}>
                  <Ionicons name={l.icon} size={22} color={on ? colors.onPrimary : colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemLabel}>{l.label}</Text>
                  <Text style={styles.itemDesc}>{l.desc}</Text>
                </View>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Ionicons name="checkmark" size={15} color={colors.onPrimary} /> : null}
                </View>
              </Pressable>
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

const styles = StyleSheet.create({
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
