import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Reveal, OnboardDecor } from "@/components/onboarding/OnboardKit";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useOnboardingDraft } from "@/contexts/OnboardingDraftContext";
import { useInsets } from "@/hooks/useInsets";
import type { AppColors } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

// Asked right after "Continue as guest" (see continueAsGuest in
// app/(auth)/signup.tsx), where the account was provisioned with the
// placeholder name "Guest". Collects the real first name so the home greeting
// is personal, then lands wherever proceedAfterSignup would have gone.
export default function NameStep() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { user, updateUser, completeOnboarding } = useAuth();
  const { updateProfile, ready } = useData();
  const { draft, clearDraft } = useOnboardingDraft();
  const [name, setName] = useState(user?.name === "Guest" ? "" : (user?.name ?? ""));
  const [saving, setSaving] = useState(false);

  // Same landing rules as signup's flush effect: pre-signup questionnaire
  // answers (if any) are flushed to the fresh account and onboarding is done;
  // otherwise the classic onboarding starts at the goal step.
  const proceed = async () => {
    if (Object.keys(draft).length > 0) {
      await updateProfile({
        ...draft,
        programStartedAt: draft.programId ? Date.now() : null,
      });
      await completeOnboarding();
      await clearDraft();
      router.replace("/onboarding/paywall");
    } else {
      router.replace("/onboarding/goal");
    }
  };

  const onContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    haptics.selection();
    setSaving(true);
    try {
      await updateUser({ name: trimmed });
      await proceed();
    } finally {
      setSaving(false);
    }
  };

  const onSkip = async () => {
    haptics.selection();
    setSaving(true);
    try {
      await proceed();
    } finally {
      setSaving(false);
    }
  };

  return (
    <GradientBackground>
      <OnboardDecor />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Reveal index={0}>
          <Text style={styles.title}>What should we call you?</Text>
          <Text style={styles.subtitle}>
            This is how Florish will greet you. You can change it anytime in your profile.
          </Text>
        </Reveal>
        <Reveal index={1}>
          <Input
            icon="person-outline"
            placeholder="First name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="given-name"
            returnKeyType="done"
            onSubmitEditing={onContinue}
          />
        </Reveal>
      </KeyboardAwareScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          label="Continue"
          iconRight="arrow-forward"
          onPress={onContinue}
          loading={saving}
          disabled={name.trim().length === 0 || !ready || saving}
        />
        <Pressable style={styles.skip} onPress={onSkip} disabled={saving} hitSlop={8}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 24, gap: 22 },
  title: { fontFamily: fonts.serifMedium, fontSize: 30, lineHeight: 36, color: colors.foreground },
  subtitle: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21, color: colors.muted, marginTop: 8 },
  footer: { position: "absolute", left: 24, right: 24, bottom: 0, gap: 6 },
  skip: { alignItems: "center", justifyContent: "center", minHeight: 40 },
  skipText: { fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.muted },
});
