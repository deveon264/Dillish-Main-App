import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React, { createElement, useEffect, useRef } from "react";
import TestRenderer, { act } from "react-test-renderer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

let reducedMotion = false;
let backendChecks = 0;
let cancelCalls = 0;
const timingCalls: Array<{ value: number; config: Record<string, unknown> }> = [];

const host = (name: string) =>
  function Host({ children, ...props }: any) {
    return createElement(name, props, children);
  };

function builder(kind: string) {
  const create = (durationMs = 0, reducedBy: unknown = null): any => ({
    kind,
    durationMs,
    reducedBy,
    duration: (value: number) => create(value, reducedBy),
    reduceMotion: (value: unknown) => create(durationMs, value),
  });
  return create();
}

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "react-native") {
    return {
      Platform: { OS: "ios" },
      UIManager: {
        hasViewManagerConfig: () => {
          backendChecks += 1;
          throw new Error("native registry unavailable");
        },
      },
      View: host("View"),
      Text: host("Text"),
    };
  }
  if (request === "react-native-ease") {
    return { EaseView: host("EaseView") };
  }
  if (request === "react-native-reanimated") {
    return {
      __esModule: true,
      default: {
        View: host("AnimatedView"),
        createAnimatedComponent: (component: unknown) => component,
      },
      FadeIn: builder("FadeIn"),
      FadeOut: builder("FadeOut"),
      LinearTransition: builder("LinearTransition"),
      ReduceMotion: { System: "system" },
      Easing: { cubic: "cubic", out: (value: unknown) => value },
      cancelAnimation: () => {
        cancelCalls += 1;
      },
      runOnJS: (fn: (...args: any[]) => unknown) => fn,
      useReducedMotion: () => reducedMotion,
      useSharedValue: (value: number) => {
        const ref = useRef({ value });
        return ref.current;
      },
      withTiming: (value: number, config: Record<string, unknown>) => {
        timingCalls.push({ value, config });
        return value;
      },
      useAnimatedReaction: (prepare: () => number, react: (value: number) => void) => {
        useEffect(() => {
          react(prepare());
        });
      },
    };
  }
  return originalLoad.apply(this, [request, parent, isMain]);
};

after(() => {
  Module._load = originalLoad;
});

beforeEach(() => {
  reducedMotion = false;
  cancelCalls = 0;
  timingCalls.length = 0;
});

test("Expo Go safely falls back to Reanimated and caches the failed Ease lookup", async () => {
  const { MotionListItem, ScreenEntrance, easeBackendAvailable } = await import("@/components/Motion");
  assert.equal(easeBackendAvailable, false);

  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      createElement(
        ScreenEntrance,
        { testID: "screen", nativeID: "motion-screen", style: { flex: 1 } },
        createElement(MotionListItem, { testID: "item" }, "Content"),
      ),
    );
  });

  assert.equal(backendChecks, 1);
  assert.equal(renderer.root.findAllByType("EaseView" as any).length, 0);
  const views = renderer.root.findAllByType("AnimatedView" as any);
  const screen = views.find((node) => node.props.testID === "screen")!;
  const item = views.find((node) => node.props.testID === "item")!;
  assert.equal(screen.props.nativeID, "motion-screen");
  assert.equal(screen.props.entering.kind, "FadeIn");
  assert.equal(screen.props.entering.durationMs, 220);
  assert.equal(screen.props.entering.reducedBy, "system");
  assert.equal(item.props.entering.durationMs, 180);
  assert.equal(item.props.exiting.durationMs, 160);
  assert.equal(item.props.layout.durationMs, 220);
  await act(async () => renderer.unmount());
});

test("reduced motion renders screen and collection wrappers without transitions", async () => {
  reducedMotion = true;
  const { MotionListItem, ScreenEntrance } = await import("@/components/Motion");
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      createElement(ScreenEntrance, null, createElement(MotionListItem, null, "Static")),
    );
  });
  const views = renderer.root.findAllByType("AnimatedView" as any);
  assert.equal(views[0].props.entering, undefined);
  assert.equal(views[1].props.entering, undefined);
  assert.equal(views[1].props.exiting, undefined);
  assert.equal(views[1].props.layout, undefined);
  await act(async () => renderer.unmount());
});

test("AnimatedNumber uses a restrained retargetable timing and cleans up", async () => {
  const { AnimatedNumber } = await import("@/components/AnimatedNumber");
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      createElement(AnimatedNumber, {
        value: 125,
        formatter: (value: number) => `${Math.round(value)} kcal`,
        accessibilityLabel: "Calories",
      }),
    );
  });
  assert.equal(timingCalls[0].value, 125);
  assert.equal(timingCalls[0].config.duration, 260);
  assert.equal(timingCalls[0].config.reduceMotion, "system");
  assert.equal(renderer.root.findByType("Text" as any).props.accessibilityLabel, "Calories");
  assert.match(JSON.stringify(renderer.toJSON()), /125 kcal/);

  await act(async () => {
    renderer.update(
      createElement(AnimatedNumber, {
        value: 190,
        formatter: (value: number) => `${Math.round(value)} kcal`,
      }),
    );
  });
  assert.equal(timingCalls.at(-1)?.value, 190);
  await act(async () => renderer.unmount());
  assert.equal(cancelCalls, 1);
});

test("AnimatedNumber updates immediately when reduced motion is enabled", async () => {
  reducedMotion = true;
  const { AnimatedNumber } = await import("@/components/AnimatedNumber");
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(createElement(AnimatedNumber, { value: 72 }));
  });
  assert.equal(timingCalls.length, 0);
  assert.match(JSON.stringify(renderer.toJSON()), /72/);
  assert.equal(cancelCalls, 1);
  await act(async () => renderer.unmount());
  assert.equal(cancelCalls, 2);
});
