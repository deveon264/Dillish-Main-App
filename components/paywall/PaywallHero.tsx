import React from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import { useInsets } from "@/hooks/useInsets";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

const HERO = require("@/assets/images/photos/paywall-hero.png");

type Props = {
  onClose: () => void;
  onSkip: () => void;
  onWatchPreview: () => void;
};

// The top of the paywall: a full-bleed composite (woman + workout phone) with
// all copy rendered as native text on the clean left third. Height flexes with
// its own content but never falls below ~42% of the screen, so the artwork
// keeps room to breathe on tall phones while the copy never clips on short ones.
export function PaywallHero({ onClose, onSkip, onWatchPreview }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();
  const { width, height } = useWindowDimensions();

  const minHeight = Math.round(height * 0.42);
  // Serif headline scales gently with width so it fills small screens without
  // wrapping awkwardly or overwhelming large ones. Sized so "on your terms."
  // stays on a single line within the copy column.
  const titleSize = Math.max(28, Math.min(40, Math.round(width * 0.098)));
  const copyMaxWidth = Math.min(width * 0.72, 300);

  return (
    <View style={[styles.hero, { minHeight, paddingTop: insets.top + 8 }]}>
      <Image
        source={HERO}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="top"
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
      {/* Soft cream fade so the hero dissolves into the feature card below. */}
      <LinearGradient
        pointerEvents="none"
        colors={colors.heroFade}
        style={styles.bottomFade}
      />

      <View style={styles.controls}>
        <Pressable
          style={styles.close}
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={22} color={colors.foreground} />
        </Pressable>
        <Pressable onPress={onSkip} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip">
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <View style={[styles.copy, { maxWidth: copyMaxWidth }]}>
        <Text style={styles.eyebrow}>DILLISH</Text>
        <Text style={[styles.title, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.06) }]}>
          Strength{"\n"}&{" "}
          <Text style={styles.titleAccent}>confidence</Text>
          {"\n"}on your terms.
        </Text>

        <Text style={styles.sub}>
          Unlimited workouts.{"\n"}Expert guidance.{"\n"}Real results.
        </Text>

        <View style={styles.social}>
          <View style={styles.stars}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons key={i} name="star" size={13} color={colors.primary} style={styles.star} />
            ))}
          </View>
          <Text style={styles.members}>50K+ members</Text>
        </View>

        <Pressable
          style={styles.preview}
          onPress={onWatchPreview}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Watch preview"
        >
          <View style={styles.previewIcon}>
            <Ionicons name="play" size={15} color={colors.onPrimaryStrong} style={styles.playGlyph} />
          </View>
          <Text style={styles.previewText}>Watch Preview</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    hero: {
      width: "100%",
      backgroundColor: colors.background,
      overflow: "hidden",
      paddingHorizontal: 24,
      paddingBottom: 30,
    },
    bottomFade: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 96,
    },
    controls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    close: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.foreground,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 3,
    },
    skip: {
      fontFamily: fonts.sansSemibold,
      fontSize: 15,
      color: colors.primary,
    },
    copy: {
      marginTop: 18,
    },
    eyebrow: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      letterSpacing: 3,
      color: colors.accent,
      marginBottom: 8,
    },
    title: {
      fontFamily: fonts.serifSemibold,
      color: colors.foreground,
    },
    titleAccent: {
      fontFamily: fonts.serifItalic,
      color: colors.primary,
    },
    sub: {
      fontFamily: fonts.sans,
      fontSize: 15,
      lineHeight: 22,
      color: colors.muted,
      marginTop: 14,
    },
    social: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 14,
    },
    stars: { flexDirection: "row" },
    star: { marginRight: 2 },
    members: {
      fontFamily: fonts.sansSemibold,
      fontSize: 13,
      color: colors.foreground,
      marginLeft: 8,
    },
    preview: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 16,
    },
    previewIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 4,
    },
    // The glyph reads visually centered when nudged a hair right.
    playGlyph: { marginLeft: 2 },
    previewText: {
      fontFamily: fonts.sansSemibold,
      fontSize: 15,
      color: colors.foreground,
      marginLeft: 12,
    },
  });
