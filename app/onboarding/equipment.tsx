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
import type { EquipmentId } from "@/lib/profile";
import { haptics } from "@/lib/haptics";

const OPTIONS: { id: EquipmentId; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "none", label: "No equipment", desc: "Just me and my bodyweight", icon: "body-outline" },
  { id: "dumbbells", label: "Dumbbells", desc: "A pair or two at home", icon: "barbell-outline" },
  { id: "resistance_bands", label: "Resistance bands", desc: "Loops or long bands", icon: "infinite-outline" },
  { id: "yoga_mat", label: "Yoga mat", desc: "For floor and mat work", icon: "layers-outline" },
  { id: "pilates_equipment", label: "Pilates equipment", desc: "Reformer, ring, or ball", icon: "ellipse-outline" },
  { id: "gym_equipment", label: "Gym equipment", desc: "I have gym access", icon: "fitness-outline" },
];

// Multi-select. "No equipment" is a real answer (stored as ["none"]) and is
// mutually exclusive with the gear options.
export default function EquipmentStep() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { total, withMode } = useOnboardingMode();
  const { answers: profile, save: updateProfile, ready } = useOnboardingAnswers();
  const [selected, setSelected] = useState<EquipmentId[]>(profile.equipment);

  const toggle = (id: EquipmentId) => {
    haptics.selection();
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((e) => e !== id);
      if (id === "none") return ["none"];
      return [...prev.filter((e) => e !== "none"), id];
    });
  };

  const next = async () => {
    haptics.selection();
    await updateProfile({ equipment: selected });
    router.push(withMode("/onboarding/schedule") as any);
  };

  return (
    <GradientBackground>
      <OnboardDecor />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader step={4} total={total} />
        <Reveal index={0}>
        <Text style={styles.title}>What equipment do you have?</Text>
        <Text style={styles.subtitle}>Select everything available to you. We'll only suggest workouts you can actually do.</Text>
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
