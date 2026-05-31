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

## Animations: prefer pure-View Animated transforms over SVG wrapped in Animated.View
Wrapping `react-native-svg` (`<Svg>`/`<Path>`) inside an `Animated.View` crashed the screen at render on web (caught by ErrorBoundary; minified to `{}` so no usable message). Static SVG (e.g. `WaterDroplet`) is fine — the breakage is the Animated.View + SVG combo.
**Why:** continuous water/wave animations are easy to reach for with animated SVG paths, but that combo is fragile in this RN 0.85 / react-native-web stack.
**How to apply:** Build animated effects from plain `View`s with `Animated` transforms (e.g. the flowing-water look in `components/WaterCircle.tsx` uses two rotating rounded-squircle Views clipped to a circle, `useNativeDriver:false`). Reserve SVG for static shapes.

## react-native-svg is crash-prone here even when static — prefer pure Views for charts
A `react-native-svg` bar chart (`<Svg>` with `<Defs>/<LinearGradient>/<Rect>/<Line>`, including returning `null` among Svg children) crashed the screen at render on web (ErrorBoundary, minified `{}` error). Rebuilding the same chart with pure `View`s + `expo-linear-gradient` bars + a dashed-border View for the goal line rendered cleanly.
**Why:** SVG on this RN 0.85 / react-native-web stack is fragile beyond just the Animated.View combo; debugging is painful because the error minifies to `{}`.
**How to apply:** For charts/decorative shapes, reach for layout primitives first — flex `View` bars, `expo-linear-gradient` for fills, `borderStyle:"dashed"` for dashed lines (see `components/BarChart.tsx`). Only use SVG if there is no View-based alternative, and test the render immediately.

## Date.toLocaleTimeString with extra Intl options crashes under SSR
`new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })` crashed the screen at render (same ErrorBoundary + minified `{}` signature). The plainer `{ hour: "2-digit", minute: "2-digit" }` worked, but adding `hour:"numeric"`/`hour12` broke it.
**Why:** web target server-renders (`web.output: "server"`, Node render.js) and that Node has limited ICU, so richer `Intl`/`toLocale*` option combos throw during SSR. The `{}` minified error makes it look like the SVG crashes — check recent date/Intl formatting too.
**How to apply:** Don't rely on `Intl`/`toLocale*` option combos for user-facing formatting on this stack (also better for native/Hermes). Hand-roll formatters (see `fmtTime`/12h AM-PM in `app/(tabs)/water.tsx`).

## Benign workflow noise
"React Native DevTools ... libglib-2.0.so.0: cannot open shared object file" is an environment lib gap, not an app error — ignore it.
