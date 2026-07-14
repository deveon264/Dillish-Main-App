import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React, { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;
let easeLoads = 0;

const host = (name: string) =>
  function Host({ children, ...props }: any) {
    return createElement(name, props, children);
  };

const builder = () => {
  const create = (): any => ({
    duration: () => create(),
    reduceMotion: () => create(),
  });
  return create();
};

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "react-native") {
    return {
      Platform: { OS: "ios" },
      UIManager: { hasViewManagerConfig: () => true },
      View: host("View"),
    };
  }
  if (request === "react-native-ease") {
    easeLoads += 1;
    throw new Error("native module failed to load");
  }
  if (request === "react-native-reanimated") {
    return {
      __esModule: true,
      default: { View: host("AnimatedView") },
      FadeIn: builder(),
      FadeOut: builder(),
      LinearTransition: builder(),
      ReduceMotion: { System: "system" },
      useReducedMotion: () => false,
    };
  }
  return originalLoad.apply(this, [request, parent, isMain]);
};

after(() => {
  Module._load = originalLoad;
});

test("a registered but unloadable Ease backend is cached as unavailable and falls back safely", async () => {
  const { ScreenEntrance, easeBackendAvailable } = await import("@/components/Motion");
  assert.equal(easeBackendAvailable, true);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      createElement("View", null,
        createElement(ScreenEntrance, { testID: "one" }, "One"),
        createElement(ScreenEntrance, { testID: "two" }, "Two"),
      ),
    );
  });
  assert.equal(easeLoads, 1);
  assert.equal(renderer.root.findAllByType("AnimatedView" as any).length, 2);
  await act(async () => renderer.unmount());
});
