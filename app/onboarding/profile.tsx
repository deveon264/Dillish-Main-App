import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { StepHeader } from "@/components/StepHeader";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const ACTIVITY = [
  { id: "sedentary", label: "Sedentary" },
  { id: "light", label: "Lightly Active" },
  { id: "moderate", label: "Moderately Active" },
  { id: "active", label: "Very Active" },
];

function Toggle({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.toggle}>
      {options.map((o) => (
        <Pressable key={o} style={[styles.toggleBtn, value === o && styles.toggleBtnOn]} onPress={() => onChange(o)}>
          <Text style={[styles.toggleText, value === o && styles.toggleTextOn]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ProfileStep() {
  const router = useRouter();
  const insets = useInsets();
  const { profile, updateProfile, ready } = useData();

  const [age, setAge] = useState(profile.age ? String(profile.age) : "");
  const [weight, setWeight] = useState(profile.weight ? String(profile.weight) : "");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">(profile.weightUnit);
  const [goalWeight, setGoalWeight] = useState(profile.goalWeight ? String(profile.goalWeight) : "");
  const [height, setHeight] = useState(profile.height ? String(profile.height) : "");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">(profile.heightUnit);
  const [activity, setActivity] = useState(profile.activityLevel);

  const valid = age.trim() !== "" && weight.trim() !== "" && height.trim() !== "";

  const next = async () => {
    const w = parseFloat(weight) || null;
    await updateProfile({
      age: parseInt(age, 10) || null,
      weight: w,
      startWeight: profile.startWeight ?? w,
      weightUnit,
      goalWeight: parseFloat(goalWeight) || null,
      height: parseFloat(height) || null,
      heightUnit,
      activityLevel: activity,
    });
    router.push("/onboarding/water");
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <StepHeader step={2} total={3} />
          <Text style={styles.title}>About you</Text>
          <Text style={styles.subtitle}>This helps us personalize your goals and tracking.</Text>

          <View style={{ marginTop: 24 }}>
            <Input label="Age" icon="calendar-outline" placeholder="28" keyboardType="number-pad" value={age} onChangeText={setAge} />

            <Text style={styles.fieldLabel}>Current Weight</Text>
            <View style={styles.rowField}>
              <Input placeholder="65" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} style={{ marginBottom: 0 }} />
            </View>
            <Toggle options={["kg", "lbs"]} value={weightUnit} onChange={(v) => setWeightUnit(v as "kg" | "lbs")} />

            <Text style={styles.fieldLabel}>Goal Weight (optional)</Text>
            <Input placeholder="60" keyboardType="decimal-pad" value={goalWeight} onChangeText={setGoalWeight} />

            <Text style={styles.fieldLabel}>Height</Text>
            <Input placeholder={heightUnit === "cm" ? "168" : "5.6"} keyboardType="decimal-pad" value={height} onChangeText={setHeight} style={{ marginBottom: 0 }} />
            <Toggle options={["cm", "ft"]} value={heightUnit} onChange={(v) => setHeightUnit(v as "cm" | "ft")} />

            <Text style={styles.fieldLabel}>Activity Level</Text>
            <View style={styles.chips}>
              {ACTIVITY.map((a) => {
                const on = activity === a.id;
                return (
                  <Pressable key={a.id} style={[styles.chip, on && styles.chipOn]} onPress={() => setActivity(a.id)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{a.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Continue" iconRight="arrow-forward" onPress={next} disabled={!valid || !ready} />
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  title: { fontFamily: fonts.serif, fontSize: 36, color: colors.foreground, lineHeight: 40 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 10, lineHeight: 22 },
  fieldLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted, marginBottom: 8, marginTop: 8 },
  rowField: { },
  toggle: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 6 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
  },
  toggleBtnOn: { backgroundColor: colors.cardElevated, borderColor: colors.accent },
  toggleText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted },
  toggleTextOn: { color: colors.foreground },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.cardElevated, borderColor: colors.accent },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted },
  chipTextOn: { color: colors.foreground },
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
