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
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

type Phase = "request" | "reset";

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useInsets();
  const { requestPasswordReset, resetPassword } = useAuth();

  const [phase, setPhase] = useState<Phase>("request");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canReset = useMemo(
    () => password.length >= 6 && confirm.length >= 6,
    [password, confirm]
  );

  const onRequest = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    const res = await requestPasswordReset(email);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Could not start password reset");
      return;
    }
    if (res.token) {
      setResetToken(res.token);
      setPhase("reset");
    } else {
      // Generic acknowledgement (e.g. no account for that email) — never reveal
      // whether the address is registered.
      setNotice("If an account exists for that email, you can set a new password here.");
    }
  };

  const onReset = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    const res = await resetPassword(resetToken, password);
    setLoading(false);
    if (res.ok) {
      router.replace("/");
    } else {
      setError(res.error ?? "Could not reset password");
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
            <Text style={styles.title}>{phase === "request" ? "Reset password" : "New password"}</Text>
            <Text style={styles.subtitle}>
              {phase === "request"
                ? "Enter your email and we'll help you get back in"
                : "Choose a new password for your account"}
            </Text>
          </View>

          <View style={styles.form}>
            {phase === "request" ? (
              <Input
                icon="mail-outline"
                placeholder="Email address"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
            ) : (
              <>
                <Input
                  icon="lock-closed-outline"
                  placeholder="New password"
                  password
                  value={password}
                  onChangeText={setPassword}
                />
                <Input
                  icon="lock-closed-outline"
                  placeholder="Confirm new password"
                  password
                  value={confirm}
                  onChangeText={setConfirm}
                />
              </>
            )}

            {notice ? (
              <View style={styles.noticeBox}>
                <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.primary} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {phase === "request" ? (
              <Button label="Continue" onPress={onRequest} loading={loading} style={{ marginTop: 6 }} />
            ) : (
              <Button
                label="Reset password"
                onPress={onReset}
                loading={loading}
                disabled={!canReset}
                style={{ marginTop: 6 }}
              />
            )}
          </View>

          <Pressable style={styles.footer} onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.footerText}>
              Remembered it? <Text style={styles.footerLink}>Back to sign in</Text>
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
  header: { marginTop: 20, marginBottom: 36 },
  title: { fontFamily: fonts.serif, fontSize: 40, color: colors.foreground, marginTop: 20 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 6 },
  form: { marginTop: 4 },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accentTintMd,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  noticeText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground, flex: 1 },
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
  footer: { alignItems: "center", marginTop: "auto", paddingTop: 28 },
  footerText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  footerLink: { fontFamily: fonts.sansSemibold, color: colors.accent },
});
