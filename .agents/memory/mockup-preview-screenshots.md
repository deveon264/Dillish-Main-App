---
name: Mockup preview screenshots
description: Why mockup-sandbox preview screenshots sometimes come back blank, and how to force a real capture.
---

# Mockup-sandbox preview screenshots can come back blank

When verifying a `mockup-sandbox` component via `screenshot(type=external_url)` on a
`/__mockup/preview/<group>/<Component>` route, the capture can return a fully blank
(white) page even though the route returns 200 and the module compiles cleanly.

**Why:** the preview renderer loads each component through an async dynamic
`import()` in a `useEffect`, so the first paint is empty. The screenshot service can
capture that empty state, and a failed early capture can then be served back from
cache on retry — so naive retries keep returning the same blank image.

**How to apply:** append a unique query param (e.g. `?v=2`, `?v=3`) to the preview
URL to bust the cache and give the dynamic import time to resolve. The preview path
resolver keys off `window.location.pathname` only, so query params do not affect
which component renders — they are safe to add purely as a cache-buster.
Before concluding a component is broken, confirm the compiled module (curl the
`/__mockup/src/.../Component.tsx` URL) has no transform error; a clean compile +
blank screenshot almost always means a capture-timing artifact, not a real bug.
