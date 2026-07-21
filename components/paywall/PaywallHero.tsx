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

// The top of the paywall: the composite (woman + workout phone) shown at full
// width and its own aspect ratio, so nothing is cropped (the phone stays fully
// in frame and the woman never scales into the copy). Copy is overlaid on the
// clean left third and bottom-anchored, so it sits just above the feature card
// regardless of the device's top inset.
export function PaywallHero({ onClose, onSkip, onWatchPreview }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();
  const { width } = useWindowDimensions();

  // Serif headline scales gently with width so "on your terms." stays on one
  // line within the left copy column without overwhelming the artwork.
  const titleSize = Math.max(23, Math.min(30, Math.round(width * 0.078)));
  const copyMaxWidth = Math.min(width * 0.58, 236);
  // The image is a full-width top band at its native aspect ratio, so it is
  // never cropped horizontally (the phone always stays fully in frame). The
  // hero itself is tall enough to also clear the top safe-area inset, so the
  // copy never collides with the status bar / notch on a real device.
  const imageHeight = Math.round(width * (1151 / 1367));
  const heroHeight = insets.top + 280;

  return (
    <View style={[styles.hero, { height: heroHeight }]}>
      {/* Full composite pinned to the top at its native ratio -> phone in view. */}
      <Image
        source={HERO}
        style={[styles.image, { height: imageHeight }]}
        contentFit="cover"
        contentPosition="top"
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
      {/* Soft cream fade so the hero dissolves into the feature card below. */}
      <LinearGradient pointerEvents="none" colors={colors.heroFade} style={styles.bottomFade} />

      <View style={[styles.overlay, { paddingTop: insets.top + 2 }]}>
        <View style={styles.controls}>
          <Pressable
            style={styles.close}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={19} color={colors.foreground} />
          </Pressable>
          <Pressable
            onPress={onSkip}
            hitSlop={10}
            style={styles.skipPill}
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.spacer} />

        <View style={[styles.copy, { maxWidth: copyMaxWidth }]}>
          <Text style={[styles.title, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.04) }]}>
            Strength{"\n"}&{" "}
            <Text style={styles.titleAccent}>confidence</Text>
            {"\n"}on your terms.
          </Text>

          <Text style={styles.sub}>
            Guided workouts.{"\n"}Daily motivation.{"\n"}Real results.
          </Text>

          <Pressable
            style={styles.preview}
            onPress={onWatchPreview}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Watch preview"
          >
            <View style={styles.previewIcon}>
              <Ionicons name="play" size={14} color={colors.onPrimaryStrong} style={styles.playGlyph} />
            </View>
            <Text style={styles.previewText}>Watch Preview</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    hero: {
      width: "100%",
      backgroundColor: colors.background,
      position: "relative",
      overflow: "hidden",
    },
    // Full-width top band; explicit height (set inline) keeps the native ratio.
    image: { position: "absolute", top: 0, left: 0, right: 0, width: "100%" },
    bottomFade: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 96,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      paddingHorizontal: 20,
      paddingBottom: 14,
      flexDirection: "column",
    },
    // Small fixed gap so the copy sits high, just under the top controls.
    spacer: { height: 10 },
    controls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    close: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.foreground,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 3,
    },
    // White pill so the pink "Skip" reads clearly over the bright photo.
    skipPill: {
      paddingHorizontal: 15,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.92)",
      shadowColor: colors.foreground,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 3,
    },
    skip: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.primary,
    },
    copy: {},
    // Soft light halo keeps the letters legible where the copy crosses the
    // woman / her outfit, without recolouring the brand type.
    title: {
      fontFamily: fonts.serifSemibold,
      color: colors.foreground,
      textShadowColor: "rgba(255,255,255,0.6)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 12,
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
      textShadowColor: "rgba(255,255,255,0.5)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    preview: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
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
