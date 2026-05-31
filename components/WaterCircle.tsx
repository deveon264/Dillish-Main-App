import React, { useEffect, useRef } from "react";
import { View, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";

export function WaterCircle({ size, progress }: { size: number; progress: number }) {
  const clamped = Math.max(0, Math.min(1, progress));
  const surfaceTop = size * (1 - clamped);
  const band = size * 0.18;
  const blob = size * 1.8;

  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const showWater = clamped > 0.001;

  useEffect(() => {
    if (!showWater) return;
    const make = (v: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: false })
      );
    const a1 = make(rot1, 7000);
    const a2 = make(rot2, 9500);
    a1.start();
    a2.start();
    return () => {
      a1.stop();
      a2.stop();
    };
  }, [rot1, rot2, showWater]);

  const spin1 = rot1.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const spin2 = rot2.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: "rgba(247,235,232,0.05)",
        borderWidth: 1,
        borderColor: colors.cardBorder,
      }}
    >
      <Ionicons
        name="water"
        size={size * 0.15}
        color="rgba(247,235,232,0.8)"
        style={{ position: "absolute", top: size * 0.16, left: 0, right: 0, textAlign: "center", zIndex: 4 }}
      />

      {showWater && (
        <>
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: surfaceTop + band * 0.45,
              bottom: 0,
              backgroundColor: colors.primary,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: Math.max(0, surfaceTop - band),
              height: band * 2.4,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={{
                position: "absolute",
                width: blob,
                height: blob,
                left: size / 2 - blob / 2,
                top: band,
                borderRadius: blob * 0.42,
                backgroundColor: colors.accent,
                opacity: 0.55,
                transform: [{ rotate: spin2 }],
              }}
            />
            <Animated.View
              style={{
                position: "absolute",
                width: blob,
                height: blob,
                left: size / 2 - blob / 2,
                top: band + size * 0.02,
                borderRadius: blob * 0.42,
                backgroundColor: colors.primary,
                transform: [{ rotate: spin1 }],
              }}
            />
          </View>
        </>
      )}
    </View>
  );
}
