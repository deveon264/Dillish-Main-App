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
let repeatCalls = 0;
let cancelCalls = 0;

const host = (name: string) =>
  function Host({ children, ...props }: any) {
    return createElement(name, props, children);
  };

const View = host("View");
const Text = host("Text");

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "react-native") {
    return {
      View,
      Text,
      StyleSheet: {
        create: (styles: any) => styles,
        absoluteFill: { position: "absolute", inset: 0 },
      },
      useWindowDimensions: () => ({ width: 390, height: 844 }),
    };
  }
  if (request === "react-native-reanimated") {
    return {
      __esModule: true,
      default: { View: host("AnimatedView") },
      Easing: { inOut: (value: unknown) => value, quad: "quad" },
      cancelAnimation: () => { cancelCalls += 1; },
      interpolate: (_value: number, _input: number[], output: number[]) => output[0],
      useAnimatedStyle: (factory: () => unknown) => factory(),
      useReducedMotion: () => reducedMotion,
      useSharedValue: (value: number) => ({ value }),
      withRepeat: (animation: unknown) => {
        repeatCalls += 1;
        return animation;
      },
      withTiming: (value: number, config: unknown) => ({ value, config }),
    };
  }
  if (request === "expo-linear-gradient") {
    return { LinearGradient: host("LinearGradient") };
  }
  if (request === "@expo/vector-icons") {
    return { Ionicons: host("Ionicons") };
  }
  if (request === "@/hooks/useColors") {
    const colors = {
      track: "#eee",
      cardElevated: "#fff",
      accentTint: "#fee",
      accentDark: "#a25",
      foreground: "#211",
      muted: "#766",
    };
    return {
      useColors: () => colors,
      useThemedStyles: (factory: (value: any) => unknown) => factory(colors),
    };
  }
  if (request === "@/constants/fonts") return { fonts: {} };
  if (request === "@/components/Button") {
    return {
      Button: ({ label, onPress, ...props }: any) =>
        createElement("Button", { ...props, onPress }, label),
    };
  }
  return originalLoad.apply(this, [request, parent, isMain]);
};

after(() => {
  Module._load = originalLoad;
});

test("SkeletonGroup owns one shimmer loop and exposes one accessible loading announcement", async () => {
  reducedMotion = false;
  repeatCalls = 0;
  cancelCalls = 0;
  const { SkeletonBlock, SkeletonGroup } = await import("@/components/Skeleton");
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      createElement(
        SkeletonGroup,
        { label: "Loading feed", testID: "group", style: { padding: 7 } },
        createElement(SkeletonBlock, { testID: "first", nativeID: "skeleton-first", style: { height: 20 } }),
        createElement(SkeletonBlock, { testID: "second", style: { width: 120 } }),
      ),
    );
  });

  assert.equal(repeatCalls, 1, "blocks must share the group's single loop");
  assert.equal(renderer.root.findAllByType("LinearGradient" as any).length, 2);
  const group = renderer.root
    .findAllByProps({ testID: "group" })
    .find((node) => (node as any).type === "View")!;
  assert.equal(group.props.accessibilityRole, "progressbar");
  assert.equal(group.props.accessibilityLabel, "Loading feed");
  assert.deepEqual(group.props.accessibilityState, { busy: true });
  const block = renderer.root
    .findAllByProps({ testID: "first" })
    .find((node) => (node as any).type === "View")!;
  assert.equal(block.props.accessibilityElementsHidden, true);
  assert.equal(block.props.importantForAccessibility, "no-hide-descendants");
  assert.equal(block.props.nativeID, "skeleton-first");
  assert.match(JSON.stringify(block.props.style), /"height":20/);

  await act(async () => renderer.unmount());
  assert.equal(cancelCalls, 1);
});

test("SkeletonGroup is static when reduced motion is enabled", async () => {
  reducedMotion = true;
  repeatCalls = 0;
  const { SkeletonBlock, SkeletonGroup } = await import("@/components/Skeleton");
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      createElement(SkeletonGroup, null, createElement(SkeletonBlock, { testID: "static" })),
    );
  });
  assert.equal(repeatCalls, 0);
  assert.equal(renderer.root.findAllByType("LinearGradient" as any).length, 0);
  await act(async () => renderer.unmount());
});

test("EmptyState forwards its action without adding generic behavior", async () => {
  let calls = 0;
  const { EmptyState } = await import("@/components/EmptyState");
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      createElement(EmptyState, {
        icon: "leaf-outline",
        title: "Nothing here",
        description: "Choose a useful next step.",
        actionLabel: "Continue",
        onAction: () => { calls += 1; },
        compact: true,
        style: { marginTop: 9 },
      }),
    );
  });
  const button = renderer.root.findByType("Button" as any);
  await act(async () => button.props.onPress());
  assert.equal(calls, 1);
  assert.match(JSON.stringify(renderer.root.findByType("View" as any).props.style), /"marginTop":9/);
  await act(async () => renderer.unmount());
});
