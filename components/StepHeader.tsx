import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ProgressBar } from "@/components/ProgressBar";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

// Onboarding progress header: back button, a gradient progress bar
// inline, and a compact step pill, so progress reads at a glance without a
// "Step N of M" caption row.
export function StepHeader({ step, total, canBack = true }: { step: number; total: number; canBack?: boolean }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {canBack ? (
          <Pressable style={styles.back} onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <View style={styles.barWrap}>
          <ProgressBar progress={step / total} height={6} />
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            {step}/{total}
          </Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { marginBottom: 26 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  barWrap: { flex: 1 },
  pill: {
    borderRadius: 999,
    backgroundColor: colors.accentTint,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accentDark, letterSpacing: 0.4 },
});
