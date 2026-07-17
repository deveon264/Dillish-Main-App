import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, ViewStyle, StyleProp } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { ScreenEntrance } from "@/components/Motion";
import { BackgroundDecor } from "@/components/BackgroundDecor";

export function GradientBackground({
  children,
  style,
  // Screens that embed a scrolling BackgroundDecor (useScrollDecor) pass
  // false so the texture isn't doubled by this fixed copy.
  showDecor = true,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  showDecor?: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={colors.bgGradient}
      locations={[0, 0.6, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.fill, style]}
    >
      {showDecor ? <BackgroundDecor /> : null}
      <ScreenEntrance style={styles.motion}>{children}</ScreenEntrance>
      {insets.top > 0 ? (
        <LinearGradient
          pointerEvents="none"
          colors={[colors.bgGradient[0], `${colors.bgGradient[0]}00`]}
          style={[styles.statusBarFade, { height: insets.top + 16 }]}
        />
      ) : null}
    </LinearGradient>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  fill: { flex: 1 },
  motion: { flex: 1 },
  // Scrolled content slides under the translucent status bar; this fade keeps
  // it from colliding with the clock. Sits above content, never catches taps.
  statusBarFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
