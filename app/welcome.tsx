import React from "react";
import { View, Text, StyleSheet, ImageBackground, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { useInsets } from "@/hooks/useInsets";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const TRUST = [
  { icon: "sparkles-outline" as const, label: "AI Tracking" },
  { icon: "barbell-outline" as const, label: "Guided Workouts" },
  { icon: "heart-outline" as const, label: "Made for you" },
];

export default function Welcome() {
  const router = useRouter();
  const insets = useInsets();

  return (
    <ImageBackground
      source={require("@/assets/images/photos/welcomehero.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(44,36,34,0.35)", "rgba(44,36,34,0.7)", "#2C2422"]}
        locations={[0, 0.5, 0.92]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.top}>
          <Logo size="lg" tagline="by dillish" />
        </View>

        <View style={styles.center}>
          <Text style={styles.title}>
            Bloom into{"\n"}your <Text style={styles.titleItalic}>best self</Text>
          </Text>
          <Text style={styles.subtitle}>
            Personalized workouts, gentle guidance, nutrition & water tracking. Wellness crafted for women who strive, all in one beautiful space.
          </Text>

          <View style={styles.trustRow}>
            {TRUST.map((t) => (
              <View key={t.label} style={styles.trustItem}>
                <View style={styles.trustIcon}>
                  <Ionicons name={t.icon} size={18} color={colors.accent} />
                </View>
                <Text style={styles.trustLabel}>{t.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Button label="Begin Your Journey" iconRight="arrow-forward" onPress={() => router.push("/(auth)/signup")} />
          <Pressable style={styles.signin} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.signinText}>
              Already have an account? <Text style={styles.signinLink}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  top: { alignItems: "flex-start" },
  center: { flex: 1, justifyContent: "flex-end", paddingBottom: 28 },
  title: {
    fontFamily: fonts.serif,
    fontSize: 52,
    lineHeight: 54,
    color: colors.foreground,
  },
  titleItalic: { fontFamily: fonts.serifItalic, color: colors.accent },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
    marginTop: 18,
    maxWidth: 320,
  },
  trustRow: { flexDirection: "row", marginTop: 28, gap: 22 },
  trustItem: { alignItems: "center", flexDirection: "row", gap: 8 },
  trustIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(247,235,232,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  trustLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },
  actions: { gap: 8 },
  signin: {
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "rgba(247,235,232,0.08)",
    borderWidth: 1,
    borderColor: "rgba(247,235,232,0.16)",
  },
  signinText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  signinLink: { fontFamily: fonts.sansSemibold, color: colors.accent },
});
