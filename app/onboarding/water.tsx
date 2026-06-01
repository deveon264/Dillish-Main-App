import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { StepHeader } from "@/components/StepHeader";
import { WaterDroplet } from "@/components/WaterDroplet";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useInsets } from "@/hooks/useInsets";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const PRESETS = [2000, 2500, 3000];
const MIN = 1000;
const MAX = 5000;
const STEP = 250;

export default function WaterStep() {
  const router = useRouter();
  const insets = useInsets();
  const { profile, updateProfile, ready } = useData();
  const { completeOnboarding } = useAuth();
  const [goal, setGoal] = useState(profile.waterGoalMl || 2500);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    await updateProfile({ waterGoalMl: goal });
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader step={3} total={3} />
        <Text style={styles.title}>Daily hydration</Text>
        <Text style={styles.subtitle}>Set a water goal that feels right. You can always adjust it later.</Text>

        <View style={styles.dropWrap}>
          <WaterDroplet size={170} progress={(goal - MIN) / (MAX - MIN)} />
          <View style={styles.dropCenter} pointerEvents="none">
            <Text style={styles.dropValue}>{(goal / 1000).toFixed(goal % 1000 === 0 ? 0 : 1)}</Text>
            <Text style={styles.dropUnit}>liters</Text>
          </View>
        </View>

        <View style={styles.stepper}>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setGoal((g) => Math.max(MIN, g - STEP))}
            hitSlop={8}
          >
            <Ionicons name="remove" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={styles.stepValue}>{goal} ml</Text>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setGoal((g) => Math.min(MAX, g + STEP))}
            hitSlop={8}
          >
            <Ionicons name="add" size={22} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.presets}>
          {PRESETS.map((p) => {
            const on = goal === p;
            return (
              <Pressable key={p} style={[styles.preset, on && styles.presetOn]} onPress={() => setGoal(p)}>
                <Text style={[styles.presetVal, on && styles.presetValOn]}>{(p / 1000).toFixed(1)}L</Text>
                <Text style={[styles.presetLabel, on && styles.presetLabelOn]}>
                  {p === 2000 ? "Light" : p === 2500 ? "Balanced" : "Active"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Start My Journey" icon="sparkles-outline" onPress={finish} loading={saving} disabled={!ready} />
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
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
