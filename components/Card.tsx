import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";

export function Card({
  children,
  style,
  elevated,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.card, elevated && styles.elevated, style]}>{children}</View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    padding: 18,
  },
  elevated: { backgroundColor: colors.cardElevated },
});
