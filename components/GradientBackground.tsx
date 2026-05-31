import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, ViewStyle, StyleProp } from "react-native";
import { colors } from "@/constants/colors";

export function GradientBackground({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={colors.bgGradient}
      locations={[0, 0.6, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.fill, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
