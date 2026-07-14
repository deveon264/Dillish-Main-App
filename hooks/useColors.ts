import { colors, type AppColors } from "@/constants/colors";

export function useColors(): AppColors {
  return colors;
}

// Companion to the `createStyles = (colors: AppColors) => StyleSheet.create(...)`
// pattern used across screens: resolves a style factory against the app palette,
// creating each sheet once and reusing it for the app's lifetime.
const styleCache = new WeakMap<(c: AppColors) => unknown, unknown>();

export function useThemedStyles<T>(factory: (c: AppColors) => T): T {
  let styles = styleCache.get(factory) as T | undefined;
  if (!styles) {
    styles = factory(colors);
    styleCache.set(factory, styles as unknown);
  }
  return styles;
}
