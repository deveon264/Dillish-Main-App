import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable as StructuralPressable, Modal, StyleProp, ViewStyle } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { Logo } from "@/components/Logo";

// A small tappable "ⓘ" icon that opens a brief popup explaining a metric.
// Self-contained (owns its open state + modal), so it can be dropped next to
// any section header: <InfoTip title="…" body="…" />.
export function InfoTip({
  title,
  body,
  size = 15,
  color,
  iconName = "information-circle-outline",
  style,
}: {
  title: string;
  body: string;
  size?: number;
  color?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`About ${title}`}
        style={style}
      >
        <Ionicons name={iconName} size={size} color={color ?? colors.mutedForeground} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <StructuralPressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <StructuralPressable style={styles.card} onPress={() => {}}>
            <View style={styles.headRow}>
              <Logo showText={false} size="sm" />
              <Text style={styles.title}>{title}</Text>
            </View>
            <Text style={styles.body}>{body}</Text>
            <Pressable
              onPress={() => setOpen(false)}
              style={({ pressed }) => [styles.close, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.closeText}>Got it</Text>
            </Pressable>
          </StructuralPressable>
        </StructuralPressable>
      </Modal>
    </>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16,17,17,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  title: { flex: 1, fontFamily: fonts.serifSemibold, fontSize: 20, color: colors.foreground },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.foreground },
  close: {
    marginTop: 18,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.track,
  },
  closeText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
});
