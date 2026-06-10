import { AppState, Platform } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import {
  useFullscreenOrientationCore,
  type FullscreenOrientationHandlers,
} from "./useFullscreenOrientationCore";

// Wires the real native modules (react-native AppState/Platform and
// expo-screen-orientation) into the platform-agnostic, deps-injectable core in
// `useFullscreenOrientationCore`. The behavior and edge-case handling live
// there; this file only exists to keep those native imports out of the testable
// core. On web the core returns undefined handlers (browser fullscreen, no
// orientation API).
export function useFullscreenOrientation(): FullscreenOrientationHandlers {
  return useFullscreenOrientationCore({
    platformOS: Platform.OS,
    lockPortrait: () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      ).catch(() => {});
    },
    unlock: () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    },
    addAppStateListener: (handler) =>
      AppState.addEventListener("change", handler as any),
  });
}
