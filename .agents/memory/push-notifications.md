---
name: Push notifications (Expo)
description: How moderation push works and the web/device quirks of expo-notifications in this app
---

# Push notifications

Members get an Expo push when an admin warns or blocks them; tapping it opens the
community feed. Tokens live in a `push_tokens` table (token is the PK, no FK).

## Durable lessons / quirks

- **Web is a no-op, by design.** `lib/pushClient.ts` is gated native-only. On web,
  importing `expo-notifications` logs a harmless warning ("Listening to push token
  changes is not yet fully supported on web. Adding a listener will have no
  effect."). Do NOT try to "fix" that warning - web has no push and the module
  degrades gracefully.

- **`getExpoPushTokenAsync` needs an EAS projectId.** `app.json` has no EAS
  projectId, so on a real device the call can throw. The client catches it, so a
  missing projectId just means no token is registered (never a crash). If real
  device push is needed, add the EAS projectId to `app.json`.

- **Shared-device re-registration re-points the token.** Because token is the PK,
  `savePushToken` upserts on conflict and overwrites `user_id`. Logging in as a
  different member on the same device moves the token to the new member, so the
  previous member stops receiving that device's pushes. Tested.

- **Moderation push is best-effort and never throws.** `sendModerationPush`
  (`lib/push.ts`) swallows all errors so a push failure can never make the
  warn/block moderation action itself fail. Expo tickets reporting
  `DeviceNotRegistered` prune that token from the table.

## Why
**Why:** moderation correctness must not depend on a flaky external push service,
and the app must build/run on web where native push APIs do not exist.
