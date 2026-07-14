import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import type { AppColors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";
import { useColors, useThemedStyles } from "@/hooks/useColors";

type EmptyStateProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  style,
}: EmptyStateProps) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.root, compact && styles.compact, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={compact ? 24 : 30} color={colors.accentDark} />
      </View>
      <Text style={[styles.title, compact && styles.compactTitle]}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Button
        label={actionLabel}
        variant="outline"
        onPress={onAction}
        style={[styles.action, compact && styles.compactAction]}
      />
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 38,
  },
  compact: {
    paddingVertical: 24,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.serifSemibold,
    fontSize: 21,
    color: colors.foreground,
    textAlign: "center",
  },
  compactTitle: {
    fontSize: 19,
  },
  description: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 320,
  },
  action: {
    width: 220,
    marginTop: 18,
  },
  compactAction: {
    width: 190,
    marginTop: 14,
  },
});
