import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { useInsets } from "@/hooks/useInsets";
import { useScale } from "@/hooks/useScale";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";
import { ScreenEntrance } from "@/components/Motion";

const heroSource = require("@/assets/images/photos/welcomehero.webp");

// Tiny blurred LQIP of the hero (32px JPEG, ~0.7KB). Shown the instant the
// screen mounts so a cache miss reveals a soft brand-toned version of the photo
// instead of the plain cream background, fading to the full image.
const HERO_PLACEHOLDER =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCAA5ACADASIAAhEBAxEB/8QAGgABAAMAAwAAAAAAAAAAAAAABAIDBQABBv/EAC0QAAIBAwEHAgUFAAAAAAAAAAECAwAEERIFEyEiMUFhMpEGFFFSgXGx0eHw/8QAGAEBAQEBAQAAAAAAAAAAAAAAAQIAAwT/xAAcEQACAgIDAAAAAAAAAAAAAAAAAQIhETEDElH/2gAMAwEAAhEDEQA/AGor+DVwV/tHvU4irEDByavcrCFLq2gniwGQvk+PNcMHoyGEODluc/TsK4+B15vA6U2eHEee1XfJpEQJCBzLnHDgapRDsHsbdBZu+nm1kZ9qPtq/m2dawm3iWWWaURhWBPDBLHA68BSbCWUx7j5aTSWLGQjAH+xUPiCzF9PY20D6JYn3xwPSunTqP5PD606QbZDZk6z7NdF6RSaRxzhTxA/GcVtzLiUY+9f2Nea2bqt5ZrY4lEZxvkGFYfzWpcbUkckpFGBngSTmiDwrK5Y3RUdtwwQGFnDTKCd0g1E+1Da62hcwOlvavFNcYM9xJhcDsF+gFQjA3ZdWCt349f1pC3KCLnjRW7MKFL0pJLSDnZBWJIhdFU6sFXqfeurfZ+gTxRzkLHMV657CkC55hh8DxViFEuJ3jwrF/UAMkYrKynOTVmTHNy4q4yjdYoUNIPpNQBKKQ5/qlh+pz1NZsfrpa9KYmZ//2Q==";

const TRUST = [
  { icon: "sparkles-outline" as const, label: "AI Tracking" },
  { icon: "barbell-outline" as const, label: "Guided Workouts" },
  { icon: "heart-outline" as const, label: "Made for you" },
];

function TrustItem({
  icon,
  label,
  iconBox,
  iconSize,
  labelSize,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  iconBox: number;
  iconSize: number;
  labelSize: number;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.trustItem}>
      <View
        style={[
          styles.trustIcon,
          { width: iconBox, height: iconBox, borderRadius: iconBox / 2.8 },
        ]}
      >
        <View>
          <Ionicons name={icon} size={iconSize} color={colors.accent} />
        </View>
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
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
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
        source={heroSource}
        style={styles.heroImg}
        contentFit="cover"
        placeholder={{ uri: HERO_PLACEHOLDER }}
        placeholderContentFit="cover"
        priority="high"
        cachePolicy="memory-disk"
        transition={200}
      />
      <LinearGradient
        colors={colors.welcomeScrim}
        locations={[0, 0.5, 0.92]}
        style={StyleSheet.absoluteFill}
      />
      <ScreenEntrance
        style={[
          styles.content,
          dynamic.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={styles.top}>
          <Logo size="lg" tagline="by ajay" />
        </View>

        <View style={styles.center}>
          <Text style={[styles.title, dynamic.title]}>
            Bloom into{"\n"}your <Text style={styles.titleItalic}>best self</Text>
          </Text>
          <Text style={[styles.subtitle, dynamic.subtitle]}>
            A beautiful space for anyone to feel stronger, calmer and more confident.
          </Text>

          <View style={[styles.trustRow, dynamic.trustRow]}>
            {TRUST.map((t) => (
              <TrustItem
                key={t.label}
                icon={t.icon}
                label={t.label}
                iconBox={ms(34)}
                iconSize={ms(18)}
                labelSize={ms(12)}
              />
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label="Begin Your Journey"
            iconRight="arrow-forward"
            onPress={() => {
              haptics.selection();
              router.push("/onboarding/goal");
            }}
          />
          <Pressable style={styles.signin} onPress={() => router.push("/(auth)/login")}>
            <Text style={[styles.signinText, dynamic.signinText]} numberOfLines={1}>
              Already have an account? <Text style={styles.signinLink}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </ScreenEntrance>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
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
