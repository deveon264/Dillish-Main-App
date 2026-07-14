import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Keyboard,
  Platform,
  TextInput as NativeTextInput,
  type LayoutChangeEvent,
} from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { KeyboardFormToolbar } from "@/components/KeyboardFormToolbar";
import { StepHeader } from "@/components/StepHeader";
import { Reveal, Bouncy, OnboardDecor } from "@/components/onboarding/OnboardKit";
import { useOnboardingAnswers } from "@/hooks/useOnboardingAnswers";
import { useInsets } from "@/hooks/useInsets";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

const ACTIVITY = [
  { id: "sedentary", label: "Sedentary" },
  { id: "light", label: "Lightly Active" },
  { id: "moderate", label: "Moderately Active" },
  { id: "active", label: "Very Active" },
];

const GENDER = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "other", label: "Other" },
] as const;

const IOS_KEYBOARD_TOOLBAR_CLEARANCE = 44;
const FOCUSED_FIELD_GAP = 12;
const FOOTER_CONTENT_GAP = 16;
const FOOTER_FALLBACK_HEIGHT = 82;

function Toggle({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.toggle}>
      {options.map((o, i) => (
        <Bouncy
          key={o}
          style={[styles.toggleBtn, value === o && styles.toggleBtnOn]}
          onPress={() => {
            if (value === o) return;
            haptics.selection();
            onChange(o);
          }}
        >
          <Text style={[styles.toggleText, value === o && styles.toggleTextOn]}>{o}</Text>
        </Bouncy>
      ))}
    </View>
  );
}

export default function ProfileStep() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { answers: profile, save: updateProfile, ready } = useOnboardingAnswers();
  const [footerHeight, setFooterHeight] = useState(insets.bottom + FOOTER_FALLBACK_HEIGHT);

  const [age, setAge] = useState(profile.age ? String(profile.age) : "");
  const [weight, setWeight] = useState(profile.weight ? String(profile.weight) : "");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">(profile.weightUnit);
  const [goalWeight, setGoalWeight] = useState(profile.goalWeight ? String(profile.goalWeight) : "");
  const [height, setHeight] = useState(profile.height ? String(profile.height) : "");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">(profile.heightUnit);
  const [activity, setActivity] = useState(profile.activityLevel);
  const [gender, setGender] = useState<"male" | "female" | "other">(profile.gender);
  const weightRef = useRef<NativeTextInput>(null);
  const goalWeightRef = useRef<NativeTextInput>(null);
  const heightRef = useRef<NativeTextInput>(null);
  const toolbarClearance = Platform.OS === "ios" ? IOS_KEYBOARD_TOOLBAR_CLEARANCE : 0;
  const keyboardBottomOffset = footerHeight + toolbarClearance + FOCUSED_FIELD_GAP;
  const openedFooterOffset = toolbarClearance === 0 ? 0 : -toolbarClearance;

  const valid = age.trim() !== "" && weight.trim() !== "" && height.trim() !== "";

  const measureFooter = (event: LayoutChangeEvent) => {
    const measuredHeight = event.nativeEvent.layout.height;
    setFooterHeight((currentHeight) => currentHeight === measuredHeight ? currentHeight : measuredHeight);
  };

  const next = async () => {
    haptics.selection();
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
      gender,
    });
    router.push("/onboarding/calorie");
  };

  return (
    <GradientBackground>
      <OnboardDecor />
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 8, paddingBottom: footerHeight + FOOTER_CONTENT_GAP },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={keyboardBottomOffset}
      >
          <StepHeader step={8} total={10} />
          <Reveal index={0}>
            <Text style={styles.title}>About you</Text>
            <Text style={styles.subtitle}>This helps us personalize your goals and tracking.</Text>
          </Reveal>

          <View style={{ marginTop: 24 }}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.chips}>
              {GENDER.map((g, i) => {
                const on = gender === g.id;
                return (
                  <Bouncy
                    key={g.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => {
                      if (on) return;
                      haptics.selection();
                      setGender(g.id);
                    }}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{g.label}</Text>
                  </Bouncy>
                );
              })}
            </View>

            <Input
              label="Age"
              icon="calendar-outline"
              placeholder="28"
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
              dismissKeyboardAccessory={false}
              returnKeyType="next"
              onSubmitEditing={() => weightRef.current?.focus()}
            />

            <Text style={styles.fieldLabel}>Current Weight</Text>
            <View style={styles.rowField}>
              <Input
                ref={weightRef}
                placeholder="65"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
                style={{ marginBottom: 0 }}
                dismissKeyboardAccessory={false}
                returnKeyType="next"
                onSubmitEditing={() => goalWeightRef.current?.focus()}
              />
            </View>
            <Toggle options={["kg", "lbs"]} value={weightUnit} onChange={(v) => setWeightUnit(v as "kg" | "lbs")} />

            <Text style={styles.fieldLabel}>Goal Weight (optional)</Text>
            <Input
              ref={goalWeightRef}
              placeholder="60"
              keyboardType="decimal-pad"
              value={goalWeight}
              onChangeText={setGoalWeight}
              dismissKeyboardAccessory={false}
              returnKeyType="next"
              onSubmitEditing={() => heightRef.current?.focus()}
            />

            <Text style={styles.fieldLabel}>Height</Text>
            <Input
              ref={heightRef}
              placeholder={heightUnit === "cm" ? "168" : "5.6"}
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
              style={{ marginBottom: 0 }}
              dismissKeyboardAccessory={false}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            <Toggle options={["cm", "ft"]} value={heightUnit} onChange={(v) => setHeightUnit(v as "cm" | "ft")} />

            <Text style={styles.fieldLabel}>Activity Level</Text>
            <View style={styles.chips}>
              {ACTIVITY.map((a, i) => {
                const on = activity === a.id;
                return (
                  <Bouncy
                    key={a.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => {
                      if (on) return;
                      haptics.selection();
                      setActivity(a.id);
                    }}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{a.label}</Text>
                  </Bouncy>
                );
              })}
            </View>
          </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView
        style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
        offset={{ closed: 0, opened: openedFooterOffset }}
        onLayout={measureFooter}
      >
        <Button label="Continue" iconRight="arrow-forward" onPress={next} disabled={!valid || !ready} />
      </KeyboardStickyView>
      <KeyboardFormToolbar />
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
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
    backgroundColor: colors.card,
  },
});
