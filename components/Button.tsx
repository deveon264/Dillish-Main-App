import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
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
  const handle = () => {
    if (disabled || loading) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress?.();
  };

  const textColor =
    variant === "primary" ? colors.onPrimary : variant === "outline" ? colors.foreground : colors.accent;

  const Inner = (
    <View style={styles.row}>
      {icon ? <Ionicons name={icon} size={18} color={textColor} style={styles.iconLeft} /> : null}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      {iconRight ? <Ionicons name={iconRight} size={18} color={textColor} style={styles.iconRight} /> : null}
    </View>
  );

  if (variant === "primary") {
    return (
      <Pressable
        testID={testID}
        onPress={handle}
        disabled={disabled || loading}
        style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }, styles.wrap, style]}
      >
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, (disabled || loading) && { opacity: 0.5 }]}
        >
          {loading ? <ActivityIndicator color={colors.onPrimary} /> : Inner}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={handle}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles.wrap,
        variant === "outline" && styles.outline,
        variant === "ghost" && styles.ghost,
        { opacity: pressed ? 0.85 : disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : Inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", borderRadius: colors.radiusLg },
  base: {
    minHeight: 54,
    borderRadius: colors.radiusLg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  outline: { borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: "transparent" },
  ghost: { backgroundColor: "transparent", minHeight: 44 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.sansSemibold, fontSize: 16, letterSpacing: 0.2 },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});
