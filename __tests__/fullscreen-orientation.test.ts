import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

// Tell React this is a valid environment for act() so effects flush
// synchronously and no "not configured to support act(...)" warnings are logged.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act } from "react-test-renderer";

import {
  useFullscreenOrientationCore,
  type FullscreenOrientationDeps,
  type FullscreenOrientationHandlers,
} from "@/hooks/useFullscreenOrientationCore";

// Builds a fake set of native deps that records every lock/unlock call (in
// order) and captures the AppState handler so a test can drive resume/background
// transitions. This is the seam the real hook injects react-native AppState and
// expo-screen-orientation through.
function makeDeps(platformOS: string) {
  const calls: string[] = [];
  let appStateHandler: ((state: string) => void) | null = null;
  let listenerCount = 0;
  let removed = false;

  const deps: FullscreenOrientationDeps = {
    platformOS,
    lockPortrait: () => calls.push("lock"),
    unlock: () => calls.push("unlock"),
    addAppStateListener: (handler) => {
      appStateHandler = handler;
      listenerCount += 1;
      return {
        remove: () => {
          removed = true;
        },
      };
    },
  };

  return {
    deps,
    calls,
    // Simulate the OS firing an AppState "change" with the given state.
    emitAppState(state: string) {
      if (!appStateHandler) {
        throw new Error("no AppState listener was registered");
      }
      act(() => appStateHandler!(state));
    },
    hasListener: () => listenerCount > 0,
    wasRemoved: () => removed,
  };
}

// Renders the hook (a function component returning null) and exposes its latest
// return value plus an unmount() to trigger the cleanup path through act().
function renderHook(deps: FullscreenOrientationDeps) {
  const result: { current: FullscreenOrientationHandlers } = {
    current: {} as FullscreenOrientationHandlers,
  };

  function Harness() {
    result.current = useFullscreenOrientationCore(deps);
    return null;
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Harness));
  });

  return {
    result,
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

// =========================================================================
// Enter: releases the portrait lock so the player can rotate to landscape.
// =========================================================================

test("unlocks orientation when entering fullscreen", () => {
  const env = makeDeps("ios");
  const { result } = renderHook(env.deps);

  act(() => result.current.onFullscreenEnter!());

  assert.deepEqual(env.calls, ["unlock"]);
});

// =========================================================================
// Exit: re-locks portrait so the rest of the (portrait-only) app is restored.
// =========================================================================

test("re-locks portrait when exiting fullscreen", () => {
  const env = makeDeps("ios");
  const { result } = renderHook(env.deps);

  act(() => result.current.onFullscreenEnter!());
  act(() => result.current.onFullscreenExit!());

  assert.deepEqual(env.calls, ["unlock", "lock"]);
});

// =========================================================================
// Unmount safety net: navigating back mid-fullscreen (exit handler never fires)
// still restores portrait and removes the AppState listener.
// =========================================================================

test("re-locks portrait on unmount when still in fullscreen", () => {
  const env = makeDeps("ios");
  const { result, unmount } = renderHook(env.deps);

  act(() => result.current.onFullscreenEnter!());
  unmount();

  assert.deepEqual(env.calls, ["unlock", "lock"]);
  assert.equal(env.wasRemoved(), true);
});

// =========================================================================
// Resume safety net: backgrounding in landscape can drop fullscreen behind the
// scenes, so resuming to "active" while NOT in fullscreen re-locks portrait.
// =========================================================================

test("re-locks portrait on resume to active when not in fullscreen", () => {
  const env = makeDeps("ios");
  renderHook(env.deps);

  env.emitAppState("active");

  assert.deepEqual(env.calls, ["lock"]);
});

test("does not re-lock on resume to active while still in fullscreen", () => {
  const env = makeDeps("ios");
  const { result } = renderHook(env.deps);

  act(() => result.current.onFullscreenEnter!());
  // The player is genuinely in landscape fullscreen; resuming must NOT fight it.
  env.emitAppState("active");

  assert.deepEqual(env.calls, ["unlock"]);
});

test("re-locks again on a later resume once fullscreen has been exited", () => {
  const env = makeDeps("ios");
  const { result } = renderHook(env.deps);

  act(() => result.current.onFullscreenEnter!());
  act(() => result.current.onFullscreenExit!());
  env.emitAppState("active");

  assert.deepEqual(env.calls, ["unlock", "lock", "lock"]);
});

test("ignores non-active AppState transitions (background / inactive)", () => {
  const env = makeDeps("ios");
  renderHook(env.deps);

  env.emitAppState("background");
  env.emitAppState("inactive");

  assert.deepEqual(env.calls, []);
});

// =========================================================================
// Web: no orientation API, so the handlers are undefined and nothing is wired.
// =========================================================================

test("returns undefined handlers and never touches orientation on web", () => {
  const env = makeDeps("web");
  const { result, unmount } = renderHook(env.deps);

  assert.equal(result.current.onFullscreenEnter, undefined);
  assert.equal(result.current.onFullscreenExit, undefined);
  // No AppState listener is registered on web...
  assert.equal(env.hasListener(), false);

  unmount();
  // ...and no lock/unlock ever happens (even through the cleanup path).
  assert.deepEqual(env.calls, []);
});
