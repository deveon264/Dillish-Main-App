---
name: Testing React Native hooks and effects
description: How to unit-test effect-driven RN UI logic in this repo's node:test + tsx suite
---

The test suite is `tsx --test __tests__/*.test.ts` (node:test). It has no React
Native renderer and tests are plain Node, so the full RN screens cannot be
rendered (they pull in expo-image, expo-image-picker, contexts, native modules).

To lock in effect-driven UI behavior (state machines over useState/useEffect):
- Extract the logic into a small custom hook that imports ONLY `react` (no
  expo/RN imports). Inject any native dependency as a function param (e.g. the
  avatar hook takes a `prefetch` fn; `app/(tabs)/profile.tsx` passes
  `Image.prefetch`). This keeps the hook importable under tsx and fakeable.
- Test with `react-test-renderer` (installed as a dev dep): render a harness
  function-component that calls the hook and returns null, expose its return via
  a ref-like `{ current }`, drive inputs with `renderer.update`, all inside
  `act()`.

**Why:** react-test-renderer needs no DOM (unlike react-dom) and works in Node.
**How to apply:** set `(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true`
before using `act` to silence "not configured to support act(...)" warnings; for
async state updates from a resolved promise, `await` a small flush wrapped in
`act(async () => { await Promise.resolve(); })` AFTER resolving deferreds, or the
trailing setState logs an "update not wrapped in act" warning. react-test-renderer
logs a deprecation line per render; that is harmless noise.
