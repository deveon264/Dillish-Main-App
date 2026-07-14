import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Keyboard, TextInput as NativeTextInput } from "react-native";
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
import { useInsets } from "@/hooks/useInsets";
import { useScale } from "@/hooks/useScale";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

export default function Login() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { ms } = useScale();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<NativeTextInput>(null);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      router.replace("/");
    } else {
      haptics.warning();
      setError(res.error ?? "Unable to sign in");
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
            <Text style={[styles.title, { fontSize: ms(40) }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { fontSize: ms(15) }]}>Sign in to continue your journey</Text>
          </View>

          <View style={styles.form}>
            <Input
              testID="login-email"
              icon="mail-outline"
              placeholder="Email address"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Input
              ref={passwordRef}
              testID="login-password"
              icon="lock-closed-outline"
              placeholder="Password"
              password
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <Pressable
              style={styles.forgot}
              onPress={() => router.push("/(auth)/forgot-password")}
              hitSlop={8}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.primary} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button testID="login-submit" label="Sign In" onPress={onSubmit} loading={loading} style={{ marginTop: 6 }} />
          </View>

          <Pressable style={styles.footer} onPress={() => router.replace("/(auth)/signup")}>
            <Text style={[styles.footerText, { fontSize: ms(14) }]} numberOfLines={1}>
              New to Florish? <Text style={styles.footerLink}>Create an account</Text>
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
  header: { marginTop: 20, marginBottom: 36, alignItems: "center" },
  title: { fontFamily: fonts.serif, fontSize: 40, color: colors.foreground, marginTop: 20, textAlign: "center" },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 6, textAlign: "center" },
  form: { marginTop: 4 },
  forgot: { alignSelf: "flex-end", marginTop: -4, marginBottom: 8, paddingVertical: 4 },
  forgotText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent },
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
