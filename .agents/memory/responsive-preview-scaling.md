---
name: Responsive preview scaling
description: Why fixed RN font sizes wrap on the web preview but not iOS, and the hook that fixes it.
---

The Replit web preview frame renders the app at a smaller logical width than the
iOS device frame, so screens using fixed `fontSize`/spacing (welcome, login,
signup) overflow and wrap awkwardly on web ("Guided Workouts", footer "Sign in",
subtitle to 3 lines) while looking fine on iOS.

**Fix:** `hooks/useScale.ts` exposes `useScale()` returning `scale` (width/400,
clamped 0.82..1) and a stable `ms(n)` helper (memoized via useCallback on scale).
Apply `ms()` to font sizes + key spacing; add `numberOfLines={1}` to wrap-prone
single-phrase labels.

**Why:** scale clamps to 1 at wide widths so iOS/desktop are unchanged; only
narrow frames shrink. Keep `ms` referentially stable so callers' `useMemo` works.

**How to apply:** any new onboarding/marketing screen with large fixed type
should use `useScale().ms(...)` instead of raw px, and verify on the narrow web
preview, not just the wide desktop screenshot (the app_preview screenshot tool
renders desktop width, which hides the wrapping).
