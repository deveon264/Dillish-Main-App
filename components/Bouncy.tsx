import React, { forwardRef } from "react";
import { Pressable, View, type PressableProps } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

// The app's one physical-feeling pressable: a gentle spring scale-down on
// press-in and spring-back on release, so buttons push back against the
// finger instead of sitting flat. Haptics and entrance motion deliberately
// live outside this shared control.

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type BouncyProps = PressableProps & {
  pressedScale?: number;
};

export const Bouncy = forwardRef<View, BouncyProps>(function Bouncy(
  {
    pressedScale = 0.965,
    onPressIn,
    onPressOut,
    style,
    disabled,
    children,
    ...rest
  },
  ref
) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const targetScale = Math.min(1, Math.max(0.9, pressedScale));
  const combinedStyle: PressableProps["style"] =
    typeof style === "function"
      ? (state) => [style(state), animated]
      : [style, animated];

  return (
    <AnimatedPressable
      ref={ref}
      style={combinedStyle}
      disabled={disabled}
      {...rest}
      onPressIn={(event) => {
        if (disabled) return;
        scale.value = withSpring(targetScale, {
          damping: 20,
          stiffness: 320,
          overshootClamping: true,
          reduceMotion: ReduceMotion.System,
        });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (disabled) return;
        scale.value = withSpring(1, {
          damping: 18,
          stiffness: 280,
          overshootClamping: true,
          reduceMotion: ReduceMotion.System,
        });
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
});
