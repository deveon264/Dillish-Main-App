#!/usr/bin/env bash
set -euo pipefail

# Runs the on-device workout-video E2E flow with Maestro.
#
# Prerequisites (these CANNOT run in the Replit container, which has no
# emulator/simulator -- run this from a machine that does, or in mobile CI):
#   1. The Maestro CLI on PATH        -> https://maestro.mobile.dev
#   2. A booted Android emulator, iOS simulator, or a USB device.
#   3. A DEV-CLIENT or RELEASE build of the app installed on it. expo-video is
#      a native module, so Expo Go will NOT work:
#         npx expo run:android        # or: npx expo run:ios
#      (or install an EAS build).
#   4. A test account that exists on the server the build points at and has
#      finished onboarding, plus a workout whose first exercise has a short
#      uploaded video.
#
# Usage:
#   MAESTRO_EMAIL=qa@florish.fit MAESTRO_PASSWORD=secret \
#     scripts/e2e-workout.sh [extra maestro args...]

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLOW="$ROOT/.maestro/workout-video-advance.yaml"

if ! command -v maestro >/dev/null 2>&1; then
  echo "error: the 'maestro' CLI is not installed or not on PATH." >&2
  echo "       install it from https://maestro.mobile.dev and retry." >&2
  exit 127
fi

EXTRA_ARGS=()
[ -n "${MAESTRO_EMAIL:-}" ] && EXTRA_ARGS+=("-e" "MAESTRO_EMAIL=${MAESTRO_EMAIL}")
[ -n "${MAESTRO_PASSWORD:-}" ] && EXTRA_ARGS+=("-e" "MAESTRO_PASSWORD=${MAESTRO_PASSWORD}")
[ -n "${MAESTRO_WORKOUT_ID:-}" ] && EXTRA_ARGS+=("-e" "MAESTRO_WORKOUT_ID=${MAESTRO_WORKOUT_ID}")

echo "Running workout-video E2E flow against the connected device..."
exec maestro test "${EXTRA_ARGS[@]}" "$@" "$FLOW"
