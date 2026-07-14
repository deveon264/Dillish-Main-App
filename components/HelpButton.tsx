import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable as StructuralPressable, Modal, StyleProp, ViewStyle } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";

type Props = {
  title: string;
  points: string[];
  intro?: string;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function HelpButton({ title, points, intro, iconColor, style }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={[styles.btn, style]}
        hitSlop={6}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Help"
      >
        <Ionicons name="information" size={18} color={iconColor ?? colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <StructuralPressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <StructuralPressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.headRow}>
              <Logo showText={false} size="sm" />
              <Text style={styles.title}>{title}</Text>
            </View>

            {intro ? <Text style={styles.intro}>{intro}</Text> : null}

            <View style={styles.points}>
              {points.map((p, i) => (
                <View key={i} style={styles.pointRow}>
                  <View style={styles.dot} />
                  <Text style={styles.pointText}>{p}</Text>
                </View>
              ))}
            </View>

            <Button label="Got it" onPress={() => setOpen(false)} style={styles.cta} />
          </StructuralPressable>
        </StructuralPressable>
      </Modal>
    </>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16,17,17,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 22,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, fontFamily: fonts.serif, fontSize: 26, color: colors.foreground },
  intro: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 14 },
  points: { marginTop: 16, gap: 12 },
  pointRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 7 },
  pointText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.foreground },
  cta: { marginTop: 22 },
});
