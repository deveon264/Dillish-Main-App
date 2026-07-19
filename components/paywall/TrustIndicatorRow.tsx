import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

const ITEMS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "card-outline", label: "No card needed" },
  { icon: "refresh-outline", label: "Cancel anytime" },
  { icon: "shield-checkmark-outline", label: "Manage in-app" },
];

// Reassurance row beneath the pricing cards. Wraps on very small screens so no
// item is ever squeezed below a legible size.
export function TrustIndicatorRow() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      {ITEMS.map((item) => (
        <View key={item.label} style={styles.item}>
          <Ionicons name={item.icon} size={14} color={colors.accent} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      columnGap: 13,
      rowGap: 10,
    },
    item: { flexDirection: "row", alignItems: "center", gap: 5 },
    label: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },
  });
