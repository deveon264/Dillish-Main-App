---
name: Expo Router API-route manifest cache
description: New app/api/*+api.ts routes 404 until .expo/web/cache is wiped; expo start --clear is not enough
---

# Expo Router API routes 404 after being added

This project runs Expo Router with `app.json` `web.output: "server"`, so
`app/api/*+api.ts` files become server routes in the Metro dev server.

**Symptom:** a newly added (or newly merged) API route returns **404** while
existing routes work normally. The route file is correct; it simply is not in
the dev server's route manifest.

**Root cause:** Expo Router caches its API-route manifest in
`.expo/web/cache`. Adding a route file does not invalidate that cache, so the
dev server keeps serving the old manifest and 404s the new path.

**Why `--clear` is not enough:** `expo start --clear` clears Metro's transform
cache (and /tmp metro caches), but NOT the `.expo/web/cache` route manifest.
A restart with `--clear` alone can still 404 a freshly added route.

**How to apply / fix:** delete `.expo/web/cache` (also harmless to remove
`.expo/static-tmp` and `node_modules/.cache`) and restart the `Start
application` workflow. The dev server rebuilds the manifest on next start and
the route registers (returns its real status, e.g. 405/400/401, not 404).

This is wired into `scripts/post-merge.sh` so every task merge that adds an API
route registers reliably — post-merge runs right before the workflow restart.

Quick probe from the shell: a registered POST-only route returns 405 on GET;
404 means it is still missing from the manifest.
