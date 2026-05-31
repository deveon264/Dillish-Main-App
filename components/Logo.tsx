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
  const fontSize = size === "lg" ? 58 : size === "sm" ? 20 : 24;
  const taglineSize = size === "lg" ? 12 : size === "sm" ? 9 : 10;

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
        <View style={styles.textCol}>
          <Text style={[styles.text, { fontSize }]}>
            Florish
          </Text>
          {tagline ? (
            <Text style={[styles.tagline, { fontSize: taglineSize }]}>
              {tagline.toUpperCase()}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  mark: { alignItems: "center", justifyContent: "center" },
  textCol: { marginLeft: 10, alignItems: "flex-start" },
  text: {
    fontFamily: fonts.serifSemibold,
    color: colors.foreground,
    letterSpacing: 0.5,
  },
  tagline: {
    fontFamily: fonts.sansSemibold,
    color: colors.primary,
    letterSpacing: 2,
    marginTop: 2,
  },
});
