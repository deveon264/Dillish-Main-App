import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";

// Shared polish kit for the onboarding flow. Screen-level motion is owned by
// GradientBackground; these helpers only preserve layout and static decor.

// Re-exported so onboarding screens keep their existing import path; the
// component itself moved to components/Bouncy for app-wide use.
export { Bouncy } from "@/components/Bouncy";

export function Reveal({
  style,
  children,
}: {
  index?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View style={style}>
      {children}
    </View>
  );
}

const SPARKLE_PATH = "M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z";

function Sparkle({
  size,
  top,
  left,
  right,
  phase,
}: {
  size: number;
  top: number;
  left?: number;
  right?: number;
  phase: number;
}) {
  const colors = useColors();

  return (
    <View style={{ position: "absolute", top, left, right, opacity: 0.55 }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={SPARKLE_PATH} fill={colors.accentSoft} />
      </Svg>
    </View>
  );
}

// Soft blush blobs and drifting sparkles behind the content. Purely
// decorative: absolutely positioned and untouchable.
export function OnboardDecor() {
  const colors = useColors();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[colors.accentTintMd, "transparent"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          position: "absolute",
          top: -70,
          right: -80,
          width: 260,
          height: 260,
          borderRadius: 130,
        }}
      />
      <LinearGradient
        colors={[colors.accentTintFaint, "transparent"]}
        start={{ x: 0.8, y: 0.1 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: "absolute",
          bottom: 60,
          left: -110,
          width: 300,
          height: 300,
          borderRadius: 150,
        }}
      />
      <Sparkle size={16} top={110} right={34} phase={0} />
      <Sparkle size={11} top={170} right={78} phase={1} />
      <Sparkle size={13} top={330} left={20} phase={2} />
    </View>
  );
}
