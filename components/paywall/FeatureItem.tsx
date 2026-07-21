import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

export type FeatureItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  // Rendered as up to two centered lines.
  lines: [string, string?];
};

// One column of the paywall's feature card: a pale-pink icon chip above a
// short, centered label.
export function FeatureItem({ icon, lines }: FeatureItemProps) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.item}>
      <View style={styles.chip}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <Text style={styles.label}>
        {lines[0]}
        {lines[1] ? "\n" + lines[1] : ""}
      </Text>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    item: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 4,
    },
    chip: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: colors.accentTint,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    label: {
      fontFamily: fonts.sansSemibold,
      fontSize: 12,
      lineHeight: 15,
      color: colors.foreground,
      textAlign: "center",
    },
  });
