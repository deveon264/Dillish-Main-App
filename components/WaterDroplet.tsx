import React from "react";
import { View } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, ClipPath, Rect, G } from "react-native-svg";
import { colors } from "@/constants/colors";

export function WaterDroplet({
  size = 180,
  progress,
}: {
  size: number;
  progress: number;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const vb = 100;
  const fillY = vb * (1 - clamped);
  const dropPath =
    "M50 6 C50 6 14 46 14 68 C14 88 30 96 50 96 C70 96 86 88 86 68 C86 46 50 6 50 6 Z";

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`}>
        <Defs>
          <LinearGradient id="dropFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accentSoft} />
            <Stop offset="1" stopColor={colors.primary} />
          </LinearGradient>
          <ClipPath id="dropClip">
            <Path d={dropPath} />
          </ClipPath>
        </Defs>
        <Path d={dropPath} fill={colors.accentTintFaint} stroke={colors.cardBorder} strokeWidth={1.5} />
        <G clipPath="url(#dropClip)">
          <Rect x={0} y={fillY} width={vb} height={vb} fill="url(#dropFill)" opacity={0.9} />
          <Rect x={0} y={fillY} width={vb} height={3} fill={colors.accentSoft} />
        </G>
      </Svg>
    </View>
  );
}
