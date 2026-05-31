# Project Overview

A fitness/coaching mobile + web app (Expo Router, React Native, `react-native-web`)
with a small server-side API layer (Expo Router `+api.ts` routes running in
Metro's Node runtime). Exercise videos are stored as bytes in Replit Object
Storage; Postgres holds only metadata. Coaches authenticate with a server-only
passcode that mints a short-lived HMAC admin token.

# Scheduled storage cleanup

Orphaned exercise-video objects (uploaded to storage but never linked to an
`exercises` row) are reclaimed by `POST /api/exercise-cleanup`. This runs
automatically on a schedule via `scripts/cleanup-cron.mjs`.

How it works:
- `scripts/cleanup-cron.mjs` is a standalone Node script. It mints the same
  HMAC admin Bearer token the endpoint already verifies (signed with the
  existing `SESSION_SECRET` — no extra secret needed) and calls the endpoint.
- Each run logs a one-line summary both from the script and from the server
  (`exercise-cleanup by ...: scanned=… deleted=…`), visible in the deployment
  logs so a coach can confirm it ran.
- `CLEANUP_DRY_RUN=1` previews without deleting.

To enable the recurring trigger in production:
1. Publish the web app (autoscale) as usual.
2. Create a **Scheduled Deployment** in the Publishing tool:
   - Run command: `node scripts/cleanup-cron.mjs`
   - Schedule: daily (e.g. `0 4 * * *`).
   - Set env var `CLEANUP_APP_URL` to the published app's base URL
     (e.g. `https://your-app.replit.app`). `SESSION_SECRET` is already shared.

In development the script falls back to `REPLIT_DEV_DOMAIN`, so you can test with
`node scripts/cleanup-cron.mjs` (or `CLEANUP_DRY_RUN=1 node scripts/cleanup-cron.mjs`).

# User preferences

(none recorded yet)
