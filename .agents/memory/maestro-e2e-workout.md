---
name: Maestro on-device E2E (workout video)
description: Why .maestro/ exists, why it can't run in Replit, and the testID-drift guard that does run here.
---

# Maestro on-device E2E for the workout video player

`.maestro/workout-video-advance.yaml` (+ `subflows/login.yaml`) is the device-level
companion to the simulated `__tests__/workout-video-integration.test.ts`. It opens a
workout with a real clip, lets it play to its end (asserts rest gap + next exercise),
pause/resume (clip position frozen then moving), and replay via an earlier exercise.

**It cannot run in the Replit container** (no Android emulator / iOS simulator) and
`expo-video` is native so Expo Go won't work either: needs a dev-client/EAS build on a
real device/emulator. Run via `npm run e2e` (wraps `scripts/e2e-workout.sh`).

**The part that DOES run here:** `__tests__/e2e-flows.test.ts` runs in the normal
`npm test` pass. It parses the flow YAML and asserts every `id:` selector resolves to a
`testID` in `app/`+`components/` (handles template testIDs like `exercise-card-${i}` by
literal prefix).

**Why:** a renamed/dropped testID would otherwise only fail on the next mobile-CI run,
far from the change. The guard fails fast in CI without a device.

**How to apply:** if you rename/remove a `testID` the flow targets, update both the
source and the flow YAML; the node:test will flag the mismatch. Flow selectors use
Maestro `id:` which maps to RN `testID` (and accessibilityIdentifier on iOS).
