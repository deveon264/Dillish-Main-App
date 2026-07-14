import React, { useEffect, useState } from "react";
import { Text, type StyleProp, type TextProps, type TextStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { MOTION_DURATION } from "@/components/Motion";

export function AnimatedNumber({
  value,
  formatter = (n) => Math.round(n).toLocaleString(),
  duration = MOTION_DURATION.counter,
  style,
  ...props
}: Omit<TextProps, "children"> & {
  value: number;
  formatter?: (value: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const animatedValue = useSharedValue(reducedMotion ? value : 0);
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const safeDuration = Math.min(
    MOTION_DURATION.slow,
    Math.max(MOTION_DURATION.fast, duration),
  );

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(animatedValue);
      animatedValue.value = value;
      setDisplay(value);
      return;
    }

    animatedValue.value = withTiming(value, {
      duration: safeDuration,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [animatedValue, reducedMotion, safeDuration, value]);

  useEffect(
    () => () => {
      cancelAnimation(animatedValue);
    },
    [animatedValue],
  );

  useAnimatedReaction(
    () => animatedValue.value,
    (current) => {
      runOnJS(setDisplay)(current);
    },
  );

  return (
    <Text {...props} style={[{ fontVariant: ["tabular-nums"] }, style]}>
      {formatter(display)}
    </Text>
  );
}

export const AnimatedText = Animated.createAnimatedComponent(Text);
