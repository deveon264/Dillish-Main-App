import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React, { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;
let reducedMotion = false;
let backendChecks = 0;

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
      UIManager: {
        hasViewManagerConfig: (name: string) => {
          backendChecks += 1;
          return name === "EaseView";
        },
      },
      View: host("View"),
    };
  }
  if (request === "react-native-ease") return { EaseView: host("EaseView") };
  if (request === "react-native-reanimated") {
    return {
      __esModule: true,
      default: { View: host("AnimatedView") },
      FadeIn: builder(),
      FadeOut: builder(),
      LinearTransition: builder(),
      ReduceMotion: { System: "system" },
      useReducedMotion: () => reducedMotion,
    };
  }
  return originalLoad.apply(this, [request, parent, isMain]);
};

after(() => {
  Module._load = originalLoad;
});

test("linked native builds prefer Ease and disable it cleanly for reduced motion", async () => {
  const { ScreenEntrance, easeBackendAvailable } = await import("@/components/Motion");
  assert.equal(easeBackendAvailable, true);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      createElement(ScreenEntrance, { testID: "ease", nativeID: "forwarded" }, "Content"),
    );
  });
  let ease = renderer.root.findByType("EaseView" as any);
  assert.equal(backendChecks, 1);
  assert.equal(ease.props.nativeID, "forwarded");
  assert.deepEqual(ease.props.initialAnimate, { opacity: 0 });
  assert.deepEqual(ease.props.animate, { opacity: 1 });
  assert.deepEqual(ease.props.transition, {
    type: "timing",
    duration: 220,
    easing: "easeOut",
  });

  reducedMotion = true;
  await act(async () => {
    renderer.update(createElement(ScreenEntrance, { testID: "ease" }, "Content"));
  });
  ease = renderer.root.findByType("EaseView" as any);
  assert.deepEqual(ease.props.initialAnimate, { opacity: 1 });
  assert.deepEqual(ease.props.transition, { type: "none" });
  assert.equal(backendChecks, 1);
  await act(async () => renderer.unmount());
});
