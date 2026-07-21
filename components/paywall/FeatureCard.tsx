import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FeatureItem } from "@/components/paywall/FeatureItem";
import type { AppColors } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useColors";

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; lines: [string, string?] }[] = [
  { icon: "barbell-outline", lines: ["50+", "Workouts"] },
  { icon: "restaurant-outline", lines: ["AI Food", "Tracker"] },
  { icon: "water-outline", lines: ["Hydration", "Goals"] },
  { icon: "bar-chart-outline", lines: ["Progress", "Analytics"] },
];

// White floating card that overlaps the bottom of the hero — four evenly spaced
// features with faint dividers between them.
export function FeatureCard() {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      {FEATURES.map((f, i) => (
        <React.Fragment key={f.lines.join(" ")}>
          {i > 0 ? <View style={styles.divider} /> : null}
          <FeatureItem icon={f.icon} lines={f.lines} />
        </React.Fragment>
      ))}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginHorizontal: 16,
      shadowColor: colors.foreground,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 6,
    },
    divider: {
      width: 1,
      alignSelf: "stretch",
      marginVertical: 4,
      backgroundColor: colors.cardBorder,
    },
  });
