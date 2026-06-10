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

## Integration-testing code that uses expo hooks (e.g. useEventListener)

You cannot `import ... from "expo"` (or a deep `expo/src/...` / `expo/build/...`
subpath) in the tsx suite: the package entry runs native setup and throws
`ReferenceError: __DEV__ is not defined`. To integration-test a screen's
event-emitter wiring, reproduce the hook's contract locally instead of importing
it. `useEventListener` is a 4-line ref bridge (a `listenerRef` kept current every
render; one subscription whose callback calls `listenerRef.current(...)`) -- copy
it from node_modules/expo/src/hooks/useEvent.ts and pair it with a fake emitter
(`addListener(name,cb) -> {remove()}` + an `emit`). That lets you fire real
"timeUpdate"/"statusChange"/"playToEnd" events through the same path the screen
uses. See __tests__/workout-video-integration.test.ts.

**Why:** the bridge's whole point is staleness-safety (listener registered once,
always invokes the latest closure); only an event-driven harness exercises that,
not calling the handler directly.
**How to apply:** any harness that leaves a live setTimeout-driven countdown
(e.g. useWorkoutAdvanceCore in the "rest" phase with paused:false) keeps a timer
pending past the test, so the deferred setState logs an "update not wrapped in
act" warning ~1s later. Call `h.unmount()` at the END of each such test to clear
the pending timers and subscriptions.
