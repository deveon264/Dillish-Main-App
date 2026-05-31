import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { colors } from "@/constants/colors";

export function Card({
  children,
  style,
  elevated,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}) {
  return (
    <View style={[styles.card, elevated && styles.elevated, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 18,
  },
  elevated: { backgroundColor: colors.cardElevated },
});
