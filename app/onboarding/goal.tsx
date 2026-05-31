import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { StepHeader } from "@/components/StepHeader";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const GOALS = [
  { id: "lose-weight", label: "Lose Weight", desc: "Shed gently, feel light", icon: "trending-down-outline" as const },
  { id: "tone", label: "Tone & Sculpt", desc: "Define and strengthen", icon: "body-outline" as const },
  { id: "strength", label: "Build Strength", desc: "Grow power and stamina", icon: "barbell-outline" as const },
  { id: "flexibility", label: "Improve Flexibility", desc: "Move with ease", icon: "accessibility-outline" as const },
  { id: "wellness", label: "Mindful Wellness", desc: "Balance body and mind", icon: "leaf-outline" as const },
  { id: "energy", label: "Boost Energy", desc: "Feel vibrant daily", icon: "flash-outline" as const },
];

export default function GoalStep() {
  const router = useRouter();
  const insets = useInsets();
  const { profile, updateProfile, ready } = useData();
  const [selected, setSelected] = useState<string[]>(profile.goals);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  const next = async () => {
    await updateProfile({ goals: selected });
    router.push("/onboarding/profile");
  };

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader step={1} total={3} canBack={false} />
        <Text style={styles.title}>What brings you here?</Text>
        <Text style={styles.subtitle}>Choose all that resonate. We'll shape your experience around them.</Text>

        <View style={styles.list}>
          {GOALS.map((g) => {
            const on = selected.includes(g.id);
            return (
              <Pressable key={g.id} style={[styles.item, on && styles.itemOn]} onPress={() => toggle(g.id)}>
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
              </Pressable>
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
    backgroundColor: "rgba(242,212,204,0.10)",
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
    backgroundColor: "rgba(30,22,20,0.85)",
  },
});
