import { useEffect, useRef } from "react";

// Native dependencies the fullscreen-orientation logic needs, injected so the
// hook imports ONLY `react` and stays testable under the node:test + tsx suite
// (react-native / expo-screen-orientation cannot be imported there). The thin
// `useFullscreenOrientation` wrapper supplies the real implementations.
export type FullscreenOrientationDeps = {
  // Platform.OS — when "web" the hook is inert (browser fullscreen, no
  // orientation API).
  platformOS: string;
  // Re-lock the app to PORTRAIT_UP.
  lockPortrait: () => void;
  // Release the orientation lock so the OS can rotate to landscape.
  unlock: () => void;
  // Subscribe to AppState "change" events; returns a remover.
  addAppStateListener: (
    handler: (state: string) => void
  ) => { remove: () => void };
};

export type FullscreenOrientationHandlers = {
  onFullscreenEnter?: () => void;
  onFullscreenExit?: () => void;
};

// The app ships locked to portrait (app.json `orientation: "portrait"`). Native
// video fullscreen is the one place a member should be able to rotate to
// landscape, so this hook unlocks orientation while the native fullscreen view
// is open and re-locks to portrait the moment it closes.
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
export function useFullscreenOrientationCore(
  deps: FullscreenOrientationDeps
): FullscreenOrientationHandlers {
  const { platformOS, lockPortrait, unlock, addAppStateListener } = deps;
  const inFullscreen = useRef(false);

  useEffect(() => {
    if (platformOS === "web") return;

    const sub = addAppStateListener((state) => {
      if (state === "active" && !inFullscreen.current) lockPortrait();
    });

    return () => {
      sub.remove();
      // Safety net: restore portrait if the screen unmounts while still in
      // fullscreen (e.g. the member navigates back without exiting first).
      lockPortrait();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (platformOS === "web") {
    return { onFullscreenEnter: undefined, onFullscreenExit: undefined };
  }

  return {
    onFullscreenEnter: () => {
      inFullscreen.current = true;
      unlock();
    },
    onFullscreenExit: () => {
      inFullscreen.current = false;
      lockPortrait();
    },
  };
}
