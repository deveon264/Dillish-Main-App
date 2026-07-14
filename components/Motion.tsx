import React from "react";
import {
  Platform,
  UIManager,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import type { EaseViewProps } from "react-native-ease";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";

export const MOTION_DURATION = {
  fast: 160,
  enter: 180,
  standard: 220,
  counter: 260,
  slow: 280,
} as const;

type UIManagerWithEaseLookup = typeof UIManager & {
  hasViewManagerConfig?: (name: string) => boolean;
  getViewManagerConfig?: (name: string) => unknown;
};

// Expo Go does not ship react-native-ease's generated native view. Resolve the
// backend once, without ever trying to render the unavailable host component.
function detectEaseBackend() {
  try {
    if ((Platform as typeof Platform | undefined)?.OS === "web") return true;
    const manager = UIManager as UIManagerWithEaseLookup;
    if (typeof manager.hasViewManagerConfig === "function") {
      return manager.hasViewManagerConfig("EaseView");
    }
    if (typeof manager.getViewManagerConfig === "function") {
      return Boolean(manager.getViewManagerConfig("EaseView"));
    }
  } catch {
    // A custom client with incomplete registration should behave like Expo Go.
  }
  return false;
}

export const easeBackendAvailable = detectEaseBackend();

let cachedEaseView: React.ComponentType<EaseViewProps> | null | undefined;

function loadEaseView() {
  if (!easeBackendAvailable) return null;
  if (cachedEaseView !== undefined) return cachedEaseView;
  try {
    cachedEaseView = require("react-native-ease").EaseView;
  } catch {
    cachedEaseView = null;
  }
  return cachedEaseView;
}

const screenEntering = FadeIn.duration(MOTION_DURATION.standard).reduceMotion(
  ReduceMotion.System,
);
const itemEntering = FadeIn.duration(MOTION_DURATION.enter).reduceMotion(
  ReduceMotion.System,
);
const itemExiting = FadeOut.duration(MOTION_DURATION.fast).reduceMotion(
  ReduceMotion.System,
);
const itemLayout = LinearTransition.duration(MOTION_DURATION.standard).reduceMotion(
  ReduceMotion.System,
);

export function ScreenEntrance({ children, style, ...props }: ViewProps) {
  const reducedMotion = useReducedMotion();
  const EaseView = loadEaseView();

  if (EaseView) {
    return (
      <EaseView
        {...props}
        style={style}
        initialAnimate={{ opacity: reducedMotion ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={
          reducedMotion
            ? { type: "none" }
            : { type: "timing", duration: MOTION_DURATION.standard, easing: "easeOut" }
        }
      >
        {children}
      </EaseView>
    );
  }

  return (
    <Animated.View {...props} entering={reducedMotion ? undefined : screenEntering} style={style}>
      {children}
    </Animated.View>
  );
}

export function MotionListItem({ children, style, ...props }: ViewProps) {
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View
      {...props}
      entering={reducedMotion ? undefined : itemEntering}
      exiting={reducedMotion ? undefined : itemExiting}
      layout={reducedMotion ? undefined : itemLayout}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// Kept as a non-staggered compatibility wrapper for any older call sites.
export function Cascade({
  children,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <MotionListItem style={style}>{children}</MotionListItem>;
}
