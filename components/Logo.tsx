import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

export function Logo({ size = "md", showText = true }: { size?: "sm" | "md" | "lg"; showText?: boolean }) {
  const mark = size === "lg" ? 56 : size === "sm" ? 34 : 44;
  const icon = size === "lg" ? 28 : size === "sm" ? 17 : 22;
  const fontSize = size === "lg" ? 30 : size === "sm" ? 20 : 24;

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
        <Text style={[styles.text, { fontSize }]}>
          Florish
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  mark: { alignItems: "center", justifyContent: "center" },
  text: {
    fontFamily: fonts.serifSemibold,
    color: colors.foreground,
    marginLeft: 10,
    letterSpacing: 0.5,
  },
});
