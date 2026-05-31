import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";

export function ProgressBar({
  progress,
  height = 8,
  color,
  trackColor = colors.track,
  style,
}: {
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={[{ height, backgroundColor: trackColor, borderRadius: height / 2, overflow: "hidden" }, style]}>
      {color ? (
        <View style={{ width: `${clamped * 100}%`, height: "100%", backgroundColor: color, borderRadius: height / 2 }} />
      ) : (
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${clamped * 100}%`, height: "100%", borderRadius: height / 2 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({});
