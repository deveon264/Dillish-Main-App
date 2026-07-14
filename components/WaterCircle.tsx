import React, { useEffect } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";

export function WaterCircle({ size, progress }: { size: number; progress: number }) {
  const colors = useColors();
  const clamped = Math.max(0, Math.min(1, progress));
  const band = size * 0.18;
  const blob = size * 1.8;

  const fill = useSharedValue(0);
  const showWater = clamped > 0.001;

  useEffect(() => {
    fill.value = withTiming(clamped, { duration: 280, reduceMotion: ReduceMotion.System });
  }, [clamped, fill]);

  const solidStyle = useAnimatedStyle(() => {
    const surfaceTop = size * (1 - fill.value);
    return { top: surfaceTop + band * 0.45 };
  });

  const waveStyle = useAnimatedStyle(() => {
    const surfaceTop = size * (1 - fill.value);
    return { top: Math.max(0, surfaceTop - band) };
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: colors.accentTintFaint,
        borderWidth: 1,
        borderColor: colors.cardBorder,
      }}
    >
      <Ionicons
        name="water"
        size={size * 0.15}
        color="rgba(16,17,17,0.6)"
        style={{ position: "absolute", top: size * 0.16, left: 0, right: 0, textAlign: "center", zIndex: 4 }}
      />

      {showWater && (
        <>
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: colors.primary,
              },
              solidStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                right: 0,
                height: band * 2.4,
                overflow: "hidden",
              },
              waveStyle,
            ]}
          >
            <Animated.View
              style={[
                {
                  position: "absolute",
                  width: blob,
                  height: blob,
                  left: size / 2 - blob / 2,
                  top: band,
                  borderRadius: blob * 0.42,
                  backgroundColor: colors.accentSoft,
                  opacity: 0.55,
                },
              ]}
            />
            <Animated.View
              style={[
                {
                  position: "absolute",
                  width: blob,
                  height: blob,
                  left: size / 2 - blob / 2,
                  top: band + size * 0.02,
                  borderRadius: blob * 0.42,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}
