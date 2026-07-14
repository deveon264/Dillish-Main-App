import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React, { createElement, createRef, forwardRef } from "react";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act } from "react-test-renderer";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

const springCalls: Array<{ value: number; config: Record<string, unknown> }> = [];

const HostPressable = forwardRef<any, any>(function HostPressable({ children, ...props }, ref) {
  return createElement("Pressable", { ...props, ref }, children);
});

const fade = {
  duration() {
    return fade;
  },
  delay() {
    return fade;
  },
};

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "react-native") {
    return { Pressable: HostPressable, View: "View" };
  }
  if (request === "react-native-reanimated") {
    return {
      __esModule: true,
      default: { createAnimatedComponent: (component: unknown) => component },
      FadeInDown: fade,
      ReduceMotion: { System: "system" },
      useSharedValue: (value: number) => ({ value }),
      useAnimatedStyle: (factory: () => unknown) => factory(),
      withSpring: (value: number, config: Record<string, unknown>) => {
        springCalls.push({ value, config });
        return value;
      },
    };
  }
  return originalLoad.apply(this, [request, parent, isMain]);
};

after(() => {
  Module._load = originalLoad;
});

beforeEach(() => {
  springCalls.length = 0;
});

async function renderBouncy(props: Record<string, unknown> = {}) {
  const { Bouncy } = await import("@/components/Bouncy");
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(createElement(Bouncy, props, "Tap"));
  });
  return renderer;
}

test("springs down and back with reduced-motion-aware, clamped configs", async () => {
  const renderer = await renderBouncy();
  const pressable = renderer.root.findByType("Pressable" as any);

  await act(async () => pressable.props.onPressIn({ nativeEvent: {} }));
  await act(async () => pressable.props.onPressOut({ nativeEvent: {} }));

  assert.deepEqual(springCalls.map(({ value }) => value), [0.965, 1]);
  assert.equal(springCalls[0].config.overshootClamping, true);
  assert.equal(springCalls[0].config.reduceMotion, "system");
  assert.equal(springCalls[1].config.reduceMotion, "system");
});

test("composes press callbacks and supports callback styles", async () => {
  const events: string[] = [];
  const renderer = await renderBouncy({
    pressedScale: 0.985,
    onPressIn: () => events.push("in"),
    onPressOut: () => events.push("out"),
    style: ({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.8 : 1 }),
  });
  const pressable = renderer.root.findByType("Pressable" as any);

  assert.deepEqual(pressable.props.style({ pressed: true })[0], { opacity: 0.8 });
  await act(async () => pressable.props.onPressIn({ nativeEvent: {} }));
  await act(async () => pressable.props.onPressOut({ nativeEvent: {} }));

  assert.deepEqual(events, ["in", "out"]);
  assert.deepEqual(springCalls.map(({ value }) => value), [0.985, 1]);
});

test("forwards refs and standard Pressable props without animating disabled controls", async () => {
  const ref = createRef<any>();
  const onPress = () => {};
  const { Bouncy } = await import("@/components/Bouncy");
  let renderer!: TestRenderer.ReactTestRenderer;
  const node = { kind: "pressable" };
  await act(async () => {
    renderer = TestRenderer.create(
      createElement(Bouncy, { ref, disabled: true, accessibilityLabel: "Example", onPress }, "Tap"),
      { createNodeMock: () => node }
    );
  });
  const pressable = renderer.root.findByType("Pressable" as any);

  assert.equal(ref.current, node);
  assert.equal(pressable.props.accessibilityLabel, "Example");
  assert.equal(pressable.props.onPress, onPress);
  await act(async () => pressable.props.onPressIn({ nativeEvent: {} }));
  await act(async () => pressable.props.onPressOut({ nativeEvent: {} }));
  assert.equal(springCalls.length, 0);
});
