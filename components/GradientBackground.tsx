import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, ViewStyle, StyleProp } from "react-native";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { ScreenEntrance } from "@/components/Motion";

export function GradientBackground({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <LinearGradient
      colors={colors.bgGradient}
      locations={[0, 0.6, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.fill, style]}
    >
      <ScreenEntrance style={styles.motion}>{children}</ScreenEntrance>
    </LinearGradient>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  fill: { flex: 1 },
  motion: { flex: 1 },
});
