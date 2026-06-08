import { useCallback } from "react";
import { useWindowDimensions } from "react-native";

// The screen type sizes were tuned for a ~400pt-wide phone. On narrower frames
// the web preview renders at a smaller logical width than the iOS device frame,
// so those fixed sizes overflow and wrap awkwardly ("Guided Workouts" and
// "Sign in" breaking to a second line, the subtitle spilling to three). Scale
// type and spacing down proportionally below the reference width, clamped so it
// never grows past the original design on wide screens nor shrinks to
// illegibility on very small ones. The result reads the same on the iOS
// preview, the web preview, and real devices of any size.
const REFERENCE_WIDTH = 400;

export function useScale() {
  const { width } = useWindowDimensions();
  const scale = Math.max(0.82, Math.min(1, width / REFERENCE_WIDTH));
  // Keep `ms` referentially stable across renders (changes only when `scale`
  // does) so callers can safely depend on it in `useMemo`/`useCallback`.
  const ms = useCallback((n: number) => Math.round(n * scale), [scale]);
  return { scale, ms };
}
