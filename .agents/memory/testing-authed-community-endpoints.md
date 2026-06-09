---
name: Testing authed community endpoints out-of-app
description: How to hit session-protected +api.ts routes (esp. community posts) with curl, and why a valid-looking create returns "Could not create post".
---

To exercise session-protected `app/api/*+api.ts` routes from a shell (curl), you
must mint a Bearer token the server's `requireSession`/`verifySessionToken` will
accept. The signing key is NOT a raw HMAC over `SESSION_SECRET`.

**Token signing (must replicate exactly):** derive a dedicated key, then sign.
1. `importKey("raw", SESSION_SECRET, HMAC SHA-256, ["sign"])` -> base key.
2. `sign("HMAC", base, SIGN_INFO)` where `SIGN_INFO = "florish-admin-session-v1"` -> derived bytes.
3. `importKey("raw", derived, HMAC SHA-256, ["sign"])` -> signing key.
4. Token = `b64url(JSON.stringify({sub,email,role,exp})) + "." + b64url(hmac(payload))`.
   `role` is `"member"` or `"admin"`; `exp` is ms epoch in the future. Use Node `webcrypto`.

**Gotcha that wastes time:** creating a community post with a synthetic `sub`
returns `{"error":"Could not create post"}` even though auth passes and the INSERT
runs. Cause: `POST_SELECT` in `lib/communityStore.ts` does
`JOIN users u ON u.id = p.author_id`, so `getPost` (called right after insert)
returns null when the author has no `users` row, and `createPost` returns null.

**Why:** the JOIN, not a real bug. GET/list works (reads existing rows from real
users), so the failure looks isolated to writes and misleads you toward the write
path.

**How to apply:** when testing create/edit, set the token `sub` to a REAL id from
the `users` table (query it first), not an invented one. Use a second real user
(or the admin) to test author-only 403s. The localhost dev server answers on
`http://localhost:5000`; the public `$REPLIT_DEV_DOMAIN` returns curl code 000
(mTLS proxy), so test against localhost.
