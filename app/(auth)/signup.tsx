import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Keyboard, TextInput as NativeTextInput, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Input } from "@/components/Input";
import { KeyboardFormToolbar } from "@/components/KeyboardFormToolbar";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useOnboardingDraft } from "@/contexts/OnboardingDraftContext";
import { useInsets } from "@/hooks/useInsets";
import { useScale } from "@/hooks/useScale";
import { isAdminEmail } from "@/constants/admin";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

function strength(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"];

export default function Signup() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { ms } = useScale();
  const { signup, completeOnboarding } = useAuth();
  const { updateProfile, ready } = useData();
  const { draft, clearDraft } = useOnboardingDraft();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passcode, setPasscode] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const flushedRef = useRef(false);
  const emailRef = useRef<NativeTextInput>(null);
  const passwordRef = useRef<NativeTextInput>(null);
  const passcodeRef = useRef<NativeTextInput>(null);

  // The questionnaire runs before signup and buffers its answers in the
  // device-local draft. Flushing must wait for DataContext to finish loading
  // the brand-new account (`ready`), because the updateProfile closure from
  // any earlier render was bound to a null uid and would silently no-op.
  useEffect(() => {
    if (!flushing || !ready || flushedRef.current) return;
    flushedRef.current = true;
    (async () => {
      try {
        await updateProfile({
          ...draft,
          // Day 1 of the chosen program starts now that the account exists.
          programStartedAt: draft.programId ? Date.now() : null,
        });
        await completeOnboarding();
        await clearDraft();
      } finally {
        router.replace("/onboarding/paywall");
      }
    })();
  }, [flushing, ready, draft, updateProfile, completeOnboarding, clearDraft, router]);

  const score = useMemo(() => strength(password), [password]);
  // The coach email needs the server-only passcode to claim admin rights.
  const needsPasscode = useMemo(() => isAdminEmail(email.trim().toLowerCase()), [email]);

  // Shared landing logic for any successful account creation.
  const proceedAfterSignup = (stopSpinner: () => void) => {
    if (Object.keys(draft).length > 0) {
      // New flow: answers were collected pre-signup. Keep the button
      // spinning; the flush effect above navigates to the paywall once the
      // new account's data layer is ready.
      setFlushing(true);
    } else {
      // Reached signup without the questionnaire (e.g. from the login
      // screen's link): run onboarding post-signup as before.
      stopSpinner();
      router.replace("/onboarding/goal");
    }
  };

  const onSubmit = async () => {
    setError(null);
    if (!agree) {
      haptics.warning();
      setError("Please accept the terms to continue");
      return;
    }
    setLoading(true);
    const res = await signup(name, email, password, needsPasscode ? passcode : undefined);
    if (res.ok) {
      proceedAfterSignup(() => setLoading(false));
    } else {
      setLoading(false);
      haptics.warning();
      setError(res.error ?? "Unable to create account");
    }
  };

  // DEV ONLY: lets reviewers explore the app without entering credentials
  // while it's under development. Provisions a real throwaway account so
  // every feature works end-to-end. Remove this handler, the guestLoading
  // state, the button below, and the guestBtn/guestText styles before release.
  const continueAsGuest = async () => {
    setError(null);
    setGuestLoading(true);
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const guestPassword = `Guest-${Math.random().toString(36).slice(2, 12)}9!`;
    const res = await signup("Guest", `guest-${suffix}@guest.florish.app`, guestPassword);
    if (res.ok) {
      proceedAfterSignup(() => setGuestLoading(false));
    } else {
      setGuestLoading(false);
      haptics.warning();
      setError(res.error ?? "Could not start a guest session");
    }
  };

  return (
    <GradientBackground>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={96}
        showsVerticalScrollIndicator={false}
      >
          <Pressable style={styles.back} onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>

          <View style={styles.header}>
            <Logo size="lg" showText={false} />
            <Text style={[styles.title, { fontSize: ms(40) }]}>Create account</Text>
            <Text style={[styles.subtitle, { fontSize: ms(15) }]}>Begin your wellness journey today</Text>
          </View>

          <View style={styles.form}>
            <Input
              icon="person-outline"
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            <Input
              ref={emailRef}
              icon="mail-outline"
              placeholder="Email address"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Input
              ref={passwordRef}
              icon="lock-closed-outline"
              placeholder="Password"
              password
              value={password}
              onChangeText={setPassword}
              returnKeyType={needsPasscode ? "next" : "done"}
              onSubmitEditing={() => needsPasscode ? passcodeRef.current?.focus() : Keyboard.dismiss()}
            />

            {needsPasscode ? (
              <View style={styles.passcodeBlock}>
                <Input
                  ref={passcodeRef}
                  icon="key-outline"
                  placeholder="Admin passcode"
                  password
                  value={passcode}
                  onChangeText={setPasscode}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
                <Text style={styles.passcodeHint}>
                  This email is reserved for the admin. Enter the admin passcode to verify.
                </Text>
              </View>
            ) : null}

            {password.length > 0 ? (
              <View style={styles.strength}>
                <View style={styles.strengthBars}>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        { backgroundColor: i < score ? colors.accent : colors.track },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.strengthLabel}>{STRENGTH_LABEL[score]}</Text>
              </View>
            ) : null}

            <Pressable
              style={styles.terms}
              onPress={() => {
                haptics.selection();
                setAgree((value) => !value);
              }}
            >
              <View style={[styles.checkbox, agree && styles.checkboxOn]}>
                {agree ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.termsLink}>Terms</Text> and{" "}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </Pressable>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.primary} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button label="Create Account" onPress={onSubmit} loading={loading} style={{ marginTop: 6 }} />

            {/* DEV ONLY: remove before release (see continueAsGuest above). */}
            <Pressable
              style={styles.guestBtn}
              onPress={continueAsGuest}
              disabled={guestLoading || loading || flushing}
              hitSlop={6}
            >
              {guestLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.guestText}>Just exploring? Continue as guest</Text>
              )}
            </Pressable>
          </View>

          <Pressable style={styles.footer} onPress={() => router.replace("/(auth)/login")}>
            <Text style={[styles.footerText, { fontSize: ms(14) }]} numberOfLines={1}>
              Already have an account? <Text style={styles.footerLink}>Sign in</Text>
            </Text>
          </Pressable>
      </KeyboardAwareScrollView>
      <KeyboardFormToolbar />
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  back: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  header: { marginTop: 8, marginBottom: 28, alignItems: "center" },
  title: { fontFamily: fonts.serif, fontSize: 40, color: colors.foreground, marginTop: 18, textAlign: "center" },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 6, textAlign: "center" },
  form: { marginTop: 4 },
  passcodeBlock: { marginBottom: 8, gap: 6 },
  passcodeHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, lineHeight: 16, paddingHorizontal: 2 },
  strength: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14, marginTop: -4 },
  strengthBars: { flexDirection: "row", gap: 6, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted, width: 50 },
  terms: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  termsText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, flex: 1 },
  termsLink: { fontFamily: fonts.sansSemibold, color: colors.accent },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accentTintMd,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground, flex: 1 },
  guestBtn: { alignItems: "center", justifyContent: "center", paddingVertical: 14, minHeight: 44 },
  guestText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.accentDark },
  footer: { alignItems: "center", marginTop: "auto", paddingTop: 24 },
  footerText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  footerLink: { fontFamily: fonts.sansSemibold, color: colors.accent },
});
