import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ProgressBar } from "@/components/ProgressBar";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

export function StepHeader({ step, total, canBack = true }: { step: number; total: number; canBack?: boolean }) {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {canBack ? (
          <Pressable style={styles.back} onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <Text style={styles.label}>
          Step {step} of {total}
        </Text>
        <View style={styles.back} />
      </View>
      <ProgressBar progress={step / total} height={6} style={{ marginTop: 14 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted, letterSpacing: 0.5 },
});
