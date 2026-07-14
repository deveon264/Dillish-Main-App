import React, { useEffect } from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";

export function ProgressBar({
  progress,
  height = 8,
  color,
  trackColor,
  style,
}: {
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const clamped = Math.max(0, Math.min(1, progress));
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(clamped, { duration: 260, reduceMotion: ReduceMotion.System });
  }, [clamped, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  return (
    <View style={[{ height, backgroundColor: trackColor ?? colors.track, borderRadius: height / 2, overflow: "hidden" }, style]}>
      <Animated.View style={[{ height: "100%", borderRadius: height / 2, overflow: "hidden" }, fillStyle]}>
        {color ? (
          <View style={{ height: "100%", backgroundColor: color, borderRadius: height / 2 }} />
        ) : (
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: "100%", borderRadius: height / 2 }}
          />
        )}
      </Animated.View>
    </View>
  );
}
