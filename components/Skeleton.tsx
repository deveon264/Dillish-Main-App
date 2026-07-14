import React, { createContext, useContext, useEffect } from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

type SkeletonTone = "default" | "dark";

type SkeletonContextValue = {
  progress: SharedValue<number>;
  reducedMotion: boolean;
  tone: SkeletonTone;
};

const SkeletonContext = createContext<SkeletonContextValue | null>(null);

type SkeletonGroupProps = ViewProps & {
  label?: string;
  tone?: SkeletonTone;
};

export function SkeletonGroup({
  children,
  label = "Loading content",
  tone = "default",
  style,
  ...rest
}: SkeletonGroupProps) {
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion]);

  return (
    <SkeletonContext.Provider value={{ progress, reducedMotion, tone }}>
      <View
        {...rest}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityState={{ busy: true }}
        style={style}
      >
        {children}
      </View>
    </SkeletonContext.Provider>
  );
}

type SkeletonBlockProps = Omit<ViewProps, "children" | "style"> & {
  style?: StyleProp<ViewStyle>;
  tone?: SkeletonTone;
};

export function SkeletonBlock({ style, tone: toneOverride, ...rest }: SkeletonBlockProps) {
  const colors = useColors();
  const context = useContext(SkeletonContext);
  const { width } = useWindowDimensions();
  const tone = toneOverride ?? context?.tone ?? "default";
  const reducedMotion = context?.reducedMotion ?? true;
  const progress = context?.progress;

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: progress
          ? interpolate(progress.value, [0, 1], [-width, width])
          : -width,
      },
    ],
  }));

  const backgroundColor = tone === "dark" ? "rgba(255,255,255,0.09)" : colors.track;
  const shimmerColor = tone === "dark" ? "rgba(255,255,255,0.16)" : colors.cardElevated;

  return (
    <View
      {...rest}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { backgroundColor }, style]}
    >
      {!reducedMotion && progress ? (
        <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={["transparent", shimmerColor, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: "hidden",
    borderRadius: 12,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "65%",
    opacity: 0.55,
  },
});
