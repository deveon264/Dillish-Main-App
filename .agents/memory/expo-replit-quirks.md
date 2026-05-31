---
name: Expo on Replit quirks
description: Non-obvious gotchas for Expo Router apps running on Replit (web + native), AsyncStorage/SecureStore, AI integrations, API routes, testing.
---

# Expo + Replit quirks

## SecureStore is a no-op stub on web
`expo-secure-store`'s web module exports `{}` in this SDK, so `getItemAsync/setItemAsync` throw and silently fail.
**Why:** "stay logged in" / any persisted session breaks on web if SecureStore is the only store.
**How to apply:** Use a platform adapter — `AsyncStorage` (localStorage-backed) on `Platform.OS === "web"`, `SecureStore` on native. See `contexts/AuthContext.tsx` session helpers.

## Expo Router API routes need server output
API routes (`app/api/*+api.ts`) only run when `app.json` `web.output` is `"server"` (not `"single"`).
On **web** the client should call the API with `window.location.origin` (relative base). On **native** there is no origin, so a relative `/api/...` fetch fails — you must supply an absolute URL via an env var (we use `EXPO_PUBLIC_DOMAIN` set in the workflow command to `$REPLIT_DEV_DOMAIN`).

## Replit AI Integrations (OpenAI) — env + model rules
Blueprint `javascript_openai_ai_integrations` sets `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` (no user key; billed to credits). Instantiate `new OpenAI({ apiKey, baseURL })` with both.
gpt-5 family: NO `temperature`, and use `max_completion_tokens` (not `max_tokens`). Vision works via chat completions `image_url` data URLs.

## Testing API routes from the agent shell
`curl $REPLIT_DEV_DOMAIN/...` fails with exit 7 / HTTP 000 — outbound to the public domain is blocked from the sandbox shell.
**How to apply:** Hit the dev server directly at `http://localhost:5000/...` instead.

## Benign workflow noise
"React Native DevTools ... libglib-2.0.so.0: cannot open shared object file" is an environment lib gap, not an app error — ignore it.
