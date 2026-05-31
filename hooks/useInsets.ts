import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useInsets() {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "web") {
    return {
      top: Math.max(insets.top, 18),
      bottom: Math.max(insets.bottom, 16),
      left: insets.left,
      right: insets.right,
    };
  }
  return insets;
}
