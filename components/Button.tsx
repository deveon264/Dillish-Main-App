import React from "react";
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Bouncy } from "@/components/Bouncy";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "outline" | "ghost";
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  iconRight,
  loading,
  disabled,
  style,
  testID,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const handle = () => {
    if (disabled || loading) return;
    onPress?.();
  };

  const textColor =
    variant === "primary" ? colors.onPrimaryStrong : variant === "outline" ? colors.accentDark : colors.accent;

  const Inner = (
    <View style={styles.row}>
      {icon ? <Ionicons name={icon} size={18} color={textColor} style={styles.iconLeft} /> : null}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      {iconRight ? <Ionicons name={iconRight} size={18} color={textColor} style={styles.iconRight} /> : null}
    </View>
  );

  if (variant === "primary") {
    return (
      <Bouncy
        testID={testID}
        onPress={handle}
        disabled={disabled || loading}
        style={[styles.wrap, style]}
      >
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, (disabled || loading) && { opacity: 0.5 }]}
        >
          {loading ? <ActivityIndicator color={colors.onPrimaryStrong} /> : Inner}
        </LinearGradient>
      </Bouncy>
    );
  }

  return (
    <Bouncy
      testID={testID}
      onPress={handle}
      disabled={disabled || loading}
      style={[
        styles.base,
        styles.wrap,
        variant === "outline" && styles.outline,
        variant === "ghost" && styles.ghost,
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : Inner}
    </Bouncy>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { width: "100%", borderRadius: colors.radiusLg },
  base: {
    minHeight: 54,
    borderRadius: colors.radiusLg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  outline: { borderWidth: 1, borderColor: colors.accentBorderMd, backgroundColor: "transparent" },
  ghost: { backgroundColor: "transparent", minHeight: 44 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.sansSemibold, fontSize: 16, letterSpacing: 0.2 },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});
