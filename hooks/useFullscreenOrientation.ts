import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";

// The app ships locked to portrait (app.json `orientation: "portrait"`). Native
// video fullscreen is the one place a member should be able to rotate to
// landscape, so this hook unlocks orientation while the native fullscreen view
// is open and re-locks to portrait the moment it closes. Web has no orientation
// lock and falls back to the browser's own fullscreen, so the handlers are left
// undefined there.
//
// Returns `onFullscreenEnter` / `onFullscreenExit` to wire directly onto an
// expo-video <VideoView>. Beyond the enter/exit pair it covers two edge cases
// that the raw handlers miss on device:
//
//  - Back-navigation mid-fullscreen: if the screen unmounts while still in
//    fullscreen the exit handler may not fire, so the unmount cleanup re-locks
//    portrait and the rest of the app is never left sideways.
//  - Backgrounding in landscape: if the member sends the app to the background
//    while in landscape fullscreen and the OS dismisses the fullscreen view
//    behind the scenes, the exit handler can be missed. On resume we re-lock
//    portrait unless we are still genuinely in fullscreen (so we never fight a
//    live landscape player).
export function useFullscreenOrientation() {
  const inFullscreen = useRef(false);

  const lockPortrait = () => {
    if (Platform.OS === "web") return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  };

  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !inFullscreen.current) lockPortrait();
    });

    return () => {
      sub.remove();
      // Safety net: restore portrait if the screen unmounts while still in
      // fullscreen (e.g. the member navigates back without exiting first).
      lockPortrait();
    };
  }, []);

  if (Platform.OS === "web") {
    return { onFullscreenEnter: undefined, onFullscreenExit: undefined };
  }

  return {
    onFullscreenEnter: () => {
      inFullscreen.current = true;
      ScreenOrientation.unlockAsync().catch(() => {});
    },
    onFullscreenExit: () => {
      inFullscreen.current = false;
      lockPortrait();
    },
  };
}
