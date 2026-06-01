import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useInsets } from "@/hooks/useInsets";
import { isAdminEmail } from "@/constants/admin";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

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
  const router = useRouter();
  const insets = useInsets();
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passcode, setPasscode] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const score = useMemo(() => strength(password), [password]);
  // The coach email needs the server-only passcode to claim admin rights.
  const needsPasscode = useMemo(() => isAdminEmail(email.trim().toLowerCase()), [email]);

  const onSubmit = async () => {
    setError(null);
    if (!agree) {
      setError("Please accept the terms to continue");
      return;
    }
    setLoading(true);
    const res = await signup(name, email, password, needsPasscode ? passcode : undefined);
    setLoading(false);
    if (res.ok) {
      router.replace("/onboarding/goal");
    } else {
      setError(res.error ?? "Unable to create account");
    }
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={styles.back} onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>

          <View style={styles.header}>
            <Logo size="md" showText={false} />
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Begin your wellness journey today</Text>
          </View>

          <View style={styles.form}>
            <Input icon="person-outline" placeholder="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
            <Input
              icon="mail-outline"
              placeholder="Email address"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input icon="lock-closed-outline" placeholder="Password" password value={password} onChangeText={setPassword} />

            {needsPasscode ? (
              <View style={styles.passcodeBlock}>
                <Input
                  icon="key-outline"
                  placeholder="Coach passcode"
                  password
                  value={passcode}
                  onChangeText={setPasscode}
                />
                <Text style={styles.passcodeHint}>
                  This email is reserved for the coach. Enter the coach passcode to verify.
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

            <Pressable style={styles.terms} onPress={() => setAgree((a) => !a)}>
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
          </View>

          <Pressable style={styles.footer} onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.footerText}>
              Already have an account? <Text style={styles.footerLink}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  back: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  header: { marginTop: 8, marginBottom: 28 },
  title: { fontFamily: fonts.serif, fontSize: 40, color: colors.foreground, marginTop: 18 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 6 },
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
    backgroundColor: "rgba(82,91,74,0.12)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground, flex: 1 },
  footer: { alignItems: "center", marginTop: "auto", paddingTop: 24 },
  footerText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  footerLink: { fontFamily: fonts.sansSemibold, color: colors.accent },
});
