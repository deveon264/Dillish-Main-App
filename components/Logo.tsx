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
  const mark = size === "lg" ? 56 : size === "sm" ? 34 : 44;
  const icon = size === "lg" ? 28 : size === "sm" ? 17 : 22;
  const fontSize = size === "lg" ? 48 : size === "sm" ? 20 : 24;
  const taglineSize = size === "lg" ? 10 : size === "sm" ? 8 : 9;
  const gap = 4;

  return (
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
        <View style={[styles.textCol, { marginLeft: gap + 6 }]}>
          <Text style={[styles.text, { fontSize, lineHeight: fontSize }]}>
            Florish
          </Text>
          {tagline ? (
            <View style={styles.pill}>
              <Text style={[styles.tagline, { fontSize: taglineSize }]}>
                {tagline.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  mark: { alignItems: "center", justifyContent: "center" },
  textCol: { alignItems: "flex-start", justifyContent: "center" },
  text: {
    fontFamily: fonts.serifSemibold,
    color: colors.foreground,
    letterSpacing: 0.5,
  },
  pill: {
    alignSelf: "flex-start",
    marginTop: 5,
    paddingHorizontal: 9,
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
