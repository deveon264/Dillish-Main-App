import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

export function Logo({
  size = "md",
  showText = true,
  tagline,
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  tagline?: string;
}) {
  const mark = size === "lg" ? 54 : size === "sm" ? 40 : 52;
  const icon = size === "lg" ? 29 : size === "sm" ? 21 : 28;
  const fontSize = size === "lg" ? 46 : size === "sm" ? 20 : 24;
  const taglineSize = size === "lg" ? 11 : size === "sm" ? 9 : 10;
  const gap = 6;
  const textTop = size === "lg" ? -9 : size === "sm" ? 5 : 7;
  const pillTop = size === "lg" ? -22 : size === "sm" ? -11 : -16;

  return (
    <View>
      <View style={styles.row}>
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.mark, { width: mark, height: mark, borderRadius: mark / 3 }]}
        >
          <Ionicons name="flower-outline" size={icon} color={colors.onPrimary} />
        </LinearGradient>
        {showText ? (
          <Text
            style={[
              styles.text,
              {
                fontSize,
                lineHeight: fontSize,
                marginLeft: gap,
                marginTop: textTop,
              },
            ]}
          >
            Florish
          </Text>
        ) : null}
      </View>
      {showText && tagline ? (
        <View
          style={[
            styles.pill,
            { marginLeft: mark + gap, marginTop: pillTop },
          ]}
        >
          <Text style={[styles.tagline, { fontSize: taglineSize }]}>
            {tagline.toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  mark: { alignItems: "center", justifyContent: "center" },
  text: {
    fontFamily: fonts.serifSemibold,
    color: colors.foreground,
    letterSpacing: 0.5,
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.accentTint,
    borderWidth: 1,
    borderColor: colors.accentBorderMd,
  },
  tagline: {
    fontFamily: fonts.sansSemibold,
    color: colors.accent,
    letterSpacing: 1.5,
  },
});
