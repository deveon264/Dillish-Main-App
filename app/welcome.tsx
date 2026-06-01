import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ImageBackground, Pressable, Animated } from "react-native";
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

function TrustItem({
  icon,
  label,
  delay,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  delay: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.18, duration: 850, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 850, useNativeDriver: true }),
        ]),
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [scale, delay]);

  return (
    <View style={styles.trustItem}>
      <View style={styles.trustIcon}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name={icon} size={18} color={colors.accent} />
        </Animated.View>
      </View>
      <Text style={styles.trustLabel}>{label}</Text>
    </View>
  );
}

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
        colors={["rgba(242,243,239,0.5)", "rgba(242,243,239,0.82)", "#F2F3EF"]}
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
            A beautiful space for women to feel stronger, calmer and more confident.
          </Text>

          <View style={styles.trustRow}>
            {TRUST.map((t, i) => (
              <TrustItem key={t.label} icon={t.icon} label={t.label} delay={i * 350} />
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
    fontSize: 44,
    lineHeight: 48,
    color: colors.foreground,
  },
  titleItalic: { fontFamily: fonts.serifItalic, color: colors.accent },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
    marginTop: 8,
    maxWidth: 320,
  },
  trustRow: { flexDirection: "row", marginTop: 18, justifyContent: "space-between" },
  trustItem: { flex: 1, alignItems: "center", flexDirection: "column", gap: 8 },
  trustIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  trustLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted, textAlign: "center" },
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
    backgroundColor: colors.accentTintFaint,
    borderWidth: 1,
    borderColor: colors.accentBorderSoft,
  },
  signinText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  signinLink: { fontFamily: fonts.sansSemibold, color: colors.accent },
});
