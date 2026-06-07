#!/bin/bash
set -e

# Runs automatically after a task is merged. Keep it idempotent and
# non-interactive (stdin is closed). Installs any new/changed dependencies
# so the merged code runs. This project uses npm (package-lock.json) and has
# no database migrations (Postgres is accessed directly), so install is enough.
npm install --no-audit --no-fund

# Expo Router (app.json web.output: "server") caches its API-route manifest in
# .expo/web/cache. When a merge adds a new `app/api/*+api.ts` route, that route
# 404s until the manifest is regenerated — and `expo start --clear` only clears
# Metro's transform cache, NOT this manifest. Wiping it here (post-merge runs
# right before the app workflow is restarted) makes the restarted dev server
# rebuild the manifest so newly merged API routes register reliably. Safe to run
# every time; the cache is regenerated on next start.
rm -rf .expo/web/cache .expo/static-tmp node_modules/.cache 2>/dev/null || true
