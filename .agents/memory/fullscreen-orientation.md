---
name: Fullscreen video orientation
description: How the portrait-locked app lets native video fullscreen rotate to landscape, and the edge cases that must stay covered.
---

The app is locked to portrait by `app.json` `orientation: "portrait"` ONLY. There
is no runtime startup orientation lock anywhere; nothing calls
`ScreenOrientation.lock*` on app launch. The single place orientation is touched
is native video fullscreen, centralized in `hooks/useFullscreenOrientation.ts`
and wired onto the `<VideoView>` in `app/exercise/[id].tsx` and
`app/workout/[id].tsx`.

The hook: unlock on `onFullscreenEnter`, re-lock `PORTRAIT_UP` on
`onFullscreenExit`, plus two safety nets that the raw enter/exit pair misses on
device:
- unmount cleanup re-locks portrait (back-navigation mid-fullscreen, where the
  exit handler may never fire).
- an `AppState` listener re-locks portrait on resume to `active` unless still in
  fullscreen (backgrounding in landscape where the OS dismisses fullscreen
  behind the scenes). It guards on an `inFullscreen` ref so it never fights a
  live landscape player.

**Why:** these screens are the only landscape surface in an otherwise
portrait-only app, so any path that leaves orientation unlocked strands the rest
of the UI sideways.

**How to apply:** add new fullscreen video surfaces by calling
`useFullscreenOrientation()` and spreading its `onFullscreenEnter`/
`onFullscreenExit` onto the VideoView; do not re-implement the lock/unlock
inline. On web the hook returns undefined handlers (browser fullscreen, no
orientation API). iOS caveat: `unlockAsync()` is constrained by the orientations
declared in Info.plist; with `orientation: "portrait"` the OS only declares
portrait, so iOS landscape relies on the native AVPlayerViewController fullscreen
rather than the JS unlock. Verified by code review only (no physical device in
this environment).
