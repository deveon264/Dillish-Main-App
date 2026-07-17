import React, { useCallback, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, Ellipse, Circle, Pattern, Rect } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

// Ambient texture for the cream canvas: a staggered tile of tiny rose petals
// and ink dots, like patterned paper. Sits behind all content and never
// catches touches.
//
// Without `height` it pins to the window (for non-scrolling screens, via
// GradientBackground). With `height` it is meant to be embedded as the first
// child of a scroll container's content, sized to the full content height, so
// the pattern scrolls 1:1 with the page like print on paper — use
// useScrollDecor() for that.
// Generous overshoot for the embedded variant: swallows the platform
// difference in how absolute children treat the scroll content's padding,
// keeps the texture under the horizontal padding gutters, and covers the
// stretch area above the content during pull-to-refresh. Overshoot is
// invisible (clipped by the scroll viewport) and the pattern is seamless.
const BLEED_X = 40;
const BLEED_TOP = 400;

export function BackgroundDecor({ height }: { height?: number }) {
  const colors = useColors();
  const { width, height: windowHeight } = useWindowDimensions();
  const embedded = height != null;
  const patternWidth = embedded ? width + BLEED_X * 2 : width;
  const patternHeight = embedded ? height + BLEED_TOP : windowHeight;

  return (
    <View
      style={
        embedded
          ? [styles.embedded, { height: patternHeight }]
          : StyleSheet.absoluteFill
      }
      pointerEvents="none"
    >
      <Svg width={patternWidth} height={patternHeight}>
        <Defs>
          <Pattern id="bgPetals" width={128} height={128} patternUnits="userSpaceOnUse">
            <Ellipse
              cx={24}
              cy={20}
              rx={4.5}
              ry={8.5}
              fill={colors.bgPetal}
              transform="rotate(-24 24 20)"
            />
            <Ellipse
              cx={92}
              cy={68}
              rx={4}
              ry={7.5}
              fill={colors.bgPetal}
              transform="rotate(32 92 68)"
            />
            <Ellipse
              cx={44}
              cy={108}
              rx={4}
              ry={7.5}
              fill={colors.bgPetal}
              transform="rotate(-58 44 108)"
            />
            <Circle cx={78} cy={18} r={1.6} fill={colors.bgPetalDot} />
            <Circle cx={16} cy={70} r={1.4} fill={colors.bgPetalDot} />
            <Circle cx={112} cy={116} r={1.5} fill={colors.bgPetalDot} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={patternWidth} height={patternHeight} fill="url(#bgPetals)" />
      </Svg>
    </View>
  );
}

// Two-line wiring for scroll screens: spread `onContentSizeChange` onto the
// ScrollView/FlatList and drop `decor` in as the first piece of its content.
export function useScrollDecor() {
  const [contentHeight, setContentHeight] = useState(0);
  const onContentSizeChange = useCallback((_w: number, h: number) => setContentHeight(h), []);
  const decor = contentHeight > 0 ? <BackgroundDecor height={contentHeight} /> : null;
  return { decor, onContentSizeChange };
}

const styles = StyleSheet.create({
  // Anchored to the content top with bleed on all sides; the measured height
  // stretches it to the bottom of the scrollable content.
  embedded: { position: "absolute", top: -BLEED_TOP, left: -BLEED_X, right: -BLEED_X },
});
