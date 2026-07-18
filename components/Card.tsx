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
    // Ambient lift so white cards read clearly against the cream canvas.
    shadowColor: colors.foreground,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  elevated: { backgroundColor: colors.cardElevated },
});
