import React, { useCallback, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

// Ambient decor for the cream canvas: a handful of oversized, low-contrast
// tonal circles overlapping down the page (the Flo-style look) — reads as
// gentle depth rather than a repeating pattern. Sits behind all content and
// never catches touches.
//
// Without `height` it pins to the window (for non-scrolling screens, via
// GradientBackground). With `height` it is meant to be embedded as the first
// child of a scroll container's content, sized to the full content height, so
// the shapes scroll 1:1 with the page — use useScrollDecor() for that.

// Generous overshoot for the embedded variant: swallows the platform
// difference in how absolute children treat the scroll content's padding,
// keeps the shapes under the horizontal padding gutters, and covers the
// stretch area above the content during pull-to-refresh. Overshoot is
// invisible (clipped by the scroll viewport).
const BLEED_X = 40;
const BLEED_TOP = 400;

// One big circle per vertical band. Layout is deterministic per band index —
// no seams, no obvious rhythm: sides alternate, radii and tones cycle at
// different periods so pairings keep shifting.
const BAND_H = 560;
const RADII = [300, 380, 260, 340];

export function BackgroundDecor({ height }: { height?: number }) {
  const colors = useColors();
  const { width, height: windowHeight } = useWindowDimensions();
  const embedded = height != null;
  const canvasWidth = embedded ? width + BLEED_X * 2 : width;
  const canvasHeight = embedded ? height + BLEED_TOP : windowHeight;

  const tones = [colors.bgOrb1, colors.bgOrb2, colors.bgOrb3];
  const bands = Math.max(1, Math.ceil(canvasHeight / BAND_H));
  const orbs = Array.from({ length: bands }, (_, i) => {
    const r = RADII[i % RADII.length];
    // Alternate the overhang side; nudge the center in/out a little per band
    // so consecutive circles overlap like the reference.
    const onRight = i % 2 === 0;
    const inset = (i % 3) * 40 - 40;
    return {
      cx: onRight ? canvasWidth + r * 0.35 - inset : -r * 0.35 + inset,
      cy: i * BAND_H + BAND_H * 0.5,
      r,
      fill: tones[i % tones.length],
    };
  });

  return (
    <View
      style={
        embedded
          ? [styles.embedded, { height: canvasHeight }]
          : StyleSheet.absoluteFill
      }
      pointerEvents="none"
    >
      <Svg width={canvasWidth} height={canvasHeight}>
        {orbs.map((o, i) => (
          <Circle key={i} cx={o.cx} cy={o.cy} r={o.r} fill={o.fill} />
        ))}
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
