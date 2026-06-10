# On-device E2E: workout video player

These [Maestro](https://maestro.mobile.dev) flows are the device-level companion
to `__tests__/workout-video-integration.test.ts`. That node:test harness
*simulates* the expo-video player's `timeUpdate` / `statusChange` / `playToEnd`
events; the flow here runs against a real device build so those native events
are exercised for real.

## What `workout-video-advance.yaml` proves

1. A workout with a real uploaded clip plays to its end and the player advances
   to the **rest gap** and then to the **next exercise** (the native `playToEnd`
   event flowing through the `onVideoEndRef` bridge).
2. **Pause/resume** stops the video and the countdown together: the clip
   position is frozen while paused and moves again on resume.
3. Tapping an **earlier (completed) exercise** replays it.

## Why it does not run in Replit

The Replit container has no Android emulator or iOS simulator, so this flow
cannot run here. It is meant for a developer machine or mobile CI. The contract
between the flow and the app (the `testID`s it targets) IS checked in the normal
`npm test` pass by `__tests__/e2e-flows.test.ts`, so a renamed or dropped testID
fails fast without a device.

## Prerequisites

1. The Maestro CLI on `PATH` (`https://maestro.mobile.dev`).
2. A booted Android emulator, iOS simulator, or a connected device.
3. A **dev-client or release** build installed on it. `expo-video` is a native
   module, so **Expo Go will not work**:
   ```bash
   npx expo run:android   # or: npx expo run:ios
   ```
   (An EAS build works too.)
4. A test account that exists on the server the build points at and has finished
   onboarding, plus a workout whose **first exercise has a short uploaded
   video** (a few seconds keeps the "play to end" step fast).

## Running

```bash
MAESTRO_EMAIL=qa@florish.fit \
MAESTRO_PASSWORD=yourpassword \
MAESTRO_WORKOUT_ID=reformer-pilates \
  npm run e2e
```

`npm run e2e` wraps `scripts/e2e-workout.sh`, which forwards those values to
`maestro test`. You can also call Maestro directly:

```bash
maestro test \
  -e MAESTRO_EMAIL=qa@florish.fit \
  -e MAESTRO_PASSWORD=yourpassword \
  .maestro/workout-video-advance.yaml
```

## Running automatically in CI

`.github/workflows/mobile-e2e.yml` runs this flow on a real Android emulator so
the native `expo-video` module is exercised before each release (the Replit
container cannot, since it has no emulator). The job:

1. Installs deps, prebuilds the native `android/` project, and builds a debug APK
   (`expo-video` is native, so Expo Go cannot run the flow).
2. Boots a hardware-accelerated Android emulator, installs the APK, and runs
   `scripts/e2e-workout.sh` (the same wrapper `npm run e2e` uses).

It triggers on `release: published` (so a red flow blocks the release when the
publish job is gated on it), on pushes to `main` that touch the app or flow, and
on demand via **workflow_dispatch**.

### Required CI secrets

Set these as repository (or environment) secrets so the flow signs in to a real
QA account:

- `MAESTRO_EMAIL` - the QA test account email.
- `MAESTRO_PASSWORD` - that account's password.
- `MAESTRO_WORKOUT_ID` - a workout whose first exercise has a short uploaded clip.

If a secret is unset the flow falls back to the defaults baked into
`workout-video-advance.yaml`, but CI should always supply a dedicated QA account.

### Blocking a release

Because the job runs on `release: published`, require it as a status check (branch
protection) or make your publish/EAS-submit job depend on it (`needs: e2e`) so a
failing flow stops the release.

## Layout

- `workout-video-advance.yaml` - the runnable flow.
- `subflows/login.yaml` - reusable sign-in step (skipped when already signed in).
- `config.yaml` - Maestro project config (treats top-level files as suites).
- `../.github/workflows/mobile-e2e.yml` - the mobile CI job that runs this flow.
