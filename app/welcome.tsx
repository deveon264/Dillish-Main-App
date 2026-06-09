import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Image, Pressable, Animated, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { useInsets } from "@/hooks/useInsets";
import { useScale } from "@/hooks/useScale";
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
  iconBox,
  iconSize,
  labelSize,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  delay: number;
  iconBox: number;
  iconSize: number;
  labelSize: number;
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
      <View
        style={[
          styles.trustIcon,
          { width: iconBox, height: iconBox, borderRadius: iconBox / 2.8 },
        ]}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name={icon} size={iconSize} color={colors.accent} />
        </Animated.View>
      </View>
      <Text style={[styles.trustLabel, { fontSize: labelSize }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// On web, a flex-only height chain can collapse when the app is embedded in an
// iframe (Replit web simulator, Canvas view), leaving the hero image at its
// intrinsic size. Pin the background to the viewport height so it always covers.
const webFill = Platform.OS === "web" ? ({ minHeight: "100vh" } as object) : null;

export default function Welcome() {
  const router = useRouter();
  const insets = useInsets();
  const { ms } = useScale();

  const dynamic = useMemo(
    () => ({
      content: { paddingHorizontal: ms(24) },
      title: { fontSize: ms(44), lineHeight: ms(48) },
      subtitle: { fontSize: ms(16), lineHeight: ms(24), maxWidth: ms(320), marginTop: ms(8) },
      trustRow: { marginTop: ms(18) },
      signinText: { fontSize: ms(14) },
    }),
    [ms],
  );

  return (
    <View style={[styles.bg, webFill]}>
      <Image
        source={require("@/assets/images/photos/welcomehero.webp")}
        style={styles.heroImg}
        resizeMode="cover"
      />
      <LinearGradient
        colors={colors.welcomeScrim}
        locations={[0, 0.5, 0.92]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.content,
          dynamic.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={styles.top}>
          <Logo size="lg" tagline="by dillish" />
        </View>

        <View style={styles.center}>
          <Text style={[styles.title, dynamic.title]}>
            Bloom into{"\n"}your <Text style={styles.titleItalic}>best self</Text>
          </Text>
          <Text style={[styles.subtitle, dynamic.subtitle]}>
            A beautiful space for women to feel stronger, calmer and more confident.
          </Text>

          <View style={[styles.trustRow, dynamic.trustRow]}>
            {TRUST.map((t, i) => (
              <TrustItem
                key={t.label}
                icon={t.icon}
                label={t.label}
                delay={i * 350}
                iconBox={ms(34)}
                iconSize={ms(18)}
                labelSize={ms(12)}
              />
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Button label="Begin Your Journey" iconRight="arrow-forward" onPress={() => router.push("/(auth)/signup")} />
          <Pressable style={styles.signin} onPress={() => router.push("/(auth)/login")}>
            <Text style={[styles.signinText, dynamic.signinText]} numberOfLines={1}>
              Already have an account? <Text style={styles.signinLink}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.background },
  heroImg: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
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
