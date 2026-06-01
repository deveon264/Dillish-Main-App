---
name: Visual QA of auth-gated screens
description: How to screenshot logged-in Expo screens for visual verification when the screenshot browser has no session.
---

The screenshot tool's browser is ephemeral and carries no AsyncStorage
session token, so every auth-gated screen redirects to /welcome. To get a
visual pass on logged-in screens:

1. Temporarily auto-sign-in a mock onboarded member in `contexts/AuthContext.tsx`
   (set `user` with `onboardingComplete: true` and skip token restore behind a
   `DEV_PREVIEW` flag).
2. Seed representative data in `contexts/DataContext.tsx` for that mock uid
   (weight logs trending down, a few recent workout completions for streak +
   burned, water/calorie logs, two progress photos with remote URLs).
3. Restart the workflow, screenshot via real URL paths:
   tabs are `/` (home), `/workouts`, `/calories`, `/progress`, `/profile`,
   `/water`; player is `/workout/<id>` (ids live in `constants/workouts.ts`,
   e.g. `reformer-pilates` — not numeric); `/exercises` for the video list.
4. **Fully revert** both context edits and restart before finishing.

**Why:** auth gate + no-token browser makes logged-in screens otherwise
invisible to screenshots.

**How to apply:** any "verify the UI of a signed-in screen" task in this repo.

Limitation: views driven by in-component tab state are NOT URL-addressable
(e.g. the Progress "Photos"/"BMI" tabs, the workout rest-countdown screen).
Verify those by code-reading their styles instead — they reuse the standard
over-image scrim (`rgba(16,17,17,0.85)` gradient + white text).
