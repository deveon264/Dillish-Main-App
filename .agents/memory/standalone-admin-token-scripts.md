---
name: Standalone scripts that mint the admin token
description: Plain-node scripts reimplement lib/adminAuth admin-token minting; they must stay in lockstep with the TS signing scheme.
---

# Standalone Node scripts reimplement the admin token

Some `.mjs` scripts under `scripts/` are NOT bundled by Metro and cannot import
the TS `lib/adminAuth.ts`. They hit the running app over HTTP and need the
admin Bearer token the upload/cleanup routes verify, so each reimplements
`mintAdminToken()` in plain `node:crypto` (HMAC-SHA256, derive a signing key
from `SESSION_SECRET` over the `SIGN_INFO` string, then sign a
`{role:"admin",email,exp}` payload).

**Rule:** if you change the signing scheme in `lib/adminAuth.ts` (the
`SIGN_INFO` constant, payload shape, or how the key is derived), update EVERY
standalone script that mints the token in lockstep, or the server will reject
the token. As of writing these are `scripts/cleanup-cron.mjs` and
`scripts/seed-e2e.mjs`. Grep for `SIGN_INFO` or `mintAdminToken` to find them.

**Why:** the token is verified by recomputing the HMAC; any divergence (a new
info string, an extra payload field, a different TTL semantics) silently
produces a token that fails `verifyAdminToken`, so the script's privileged
calls 403 with no other clue.
