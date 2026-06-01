---
name: Server-verified identity & admin model
description: How login/identity works after the mock-login removal — session tokens, the admin-claim gate, and the admin-email coupling constraint.
---

Identity is server-side (Postgres `users` row; coach = `is_admin`). Login/signup issue
one HMAC-signed session token (signed with `SESSION_SECRET`); the client stores it and
sends it as `Bearer` on `/api/me` and admin routes.

**The admin's session token IS the admin token.** It carries `role:"admin"` + the admin
email, so the existing `verifyAdminToken` (used by upload/delete routes) and
`scripts/cleanup-cron.mjs` accept it unchanged. There is no separate passcode-minted admin
token anymore — `adminUnlocked`/`adminToken` on the client derive purely from `isAdmin`.
**Why:** lets the coach manage media immediately on login with no passcode prompt, while
forged/spoofed tokens still grant nothing (signature is verified server-side).

**Claiming admin requires the passcode at signup only.** Signing up with the admin email
needs `ADMIN_PASSCODE` (`verifyPasscode`) to set `is_admin`; otherwise a member could grab
admin by using that email. `is_admin` is never mutable via `/api/me`.

**Admin email is locked both directions.** `/api/me` PATCH blocks a non-admin from setting
their email to the coach email AND blocks the admin from changing away from it.
**Why:** `verifyAdminToken` authorizes on `isAdminEmail(token.email)`. If the admin moved off
the coach email, their next login would mint a `role:"admin"` token whose email fails
`isAdminEmail`, silently breaking all admin uploads. Keep the coach identity pinned to the
constant email.

Legacy on-device accounts (`florish:users` in AsyncStorage) are migrated to the server
transparently on first successful-credentials login — except the admin email, which always
goes through the passcode signup path.
