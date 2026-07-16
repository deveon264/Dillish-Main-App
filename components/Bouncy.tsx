import React, { forwardRef, useState } from "react";
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
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const targetScale = Math.min(1, Math.max(0.9, pressedScale));
  // Reanimated's animated components drop Pressable's callback-style prop at
  // runtime, taking the whole resolved style (card chrome, flexDirection) with
  // it. Resolve the callback here and always hand the native side a plain array.
  const resolvedStyle = typeof style === "function" ? style({ pressed }) : style;

  return (
    <AnimatedPressable
      ref={ref}
      style={[resolvedStyle, animated]}
      disabled={disabled}
      {...rest}
      onPressIn={(event) => {
        setPressed(true);
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
        setPressed(false);
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
