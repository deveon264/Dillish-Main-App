import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React, { createElement, forwardRef } from "react";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act } from "react-test-renderer";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;
const platform = { OS: "ios" };
const insets = { top: 0, bottom: 34 };
const colors = new Proxy({ gradient: ["#111", "#222"] } as Record<string, unknown>, {
  get: (target, key: string) => target[key] ?? "#000",
});

const host = (name: string) => (props: any) => createElement(name, props, props.children);
const passthrough = ({ children }: any) => createElement(React.Fragment, null, children);
const ScreenInput = forwardRef<any, any>((props, ref) =>
  createElement("ScreenInput", { ...props, forwardedRef: ref }),
);

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "react-native") {
    return {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      TextInput: "TextInput",
      Keyboard: { dismiss() {} },
      Platform: platform,
      StyleSheet: { create: (value: unknown) => value },
    };
  }
  if (request === "react-native-keyboard-controller") {
    return {
      KeyboardAwareScrollView: host("KeyboardAwareScrollView"),
      KeyboardStickyView: host("KeyboardStickyView"),
    };
  }
  if (request === "expo-router") return { useRouter: () => ({ push() {} }) };
  if (request === "@/components/GradientBackground") {
    return { GradientBackground: host("GradientBackground") };
  }
  if (request === "@/components/Button") return { Button: host("ScreenButton") };
  if (request === "@/components/Input") return { Input: ScreenInput };
  if (request === "@/components/KeyboardFormToolbar") {
    return { KeyboardFormToolbar: host("KeyboardFormToolbar") };
  }
  if (request === "@/components/StepHeader") return { StepHeader: host("StepHeader") };
  if (request === "@/components/onboarding/OnboardKit") {
    return { Reveal: passthrough, Bouncy: host("ScreenBouncy"), OnboardDecor: () => null };
  }
  if (request === "@/hooks/useOnboardingAnswers") {
    return {
      useOnboardingAnswers: () => ({
        answers: {
          age: null,
          weight: null,
          weightUnit: "kg",
          goalWeight: null,
          height: null,
          heightUnit: "cm",
          activityLevel: "sedentary",
          gender: "other",
          startWeight: null,
        },
        save: async () => {},
        ready: true,
      }),
    };
  }
  if (request === "@/hooks/useInsets") return { useInsets: () => insets };
  if (request === "@/hooks/useColors") {
    return {
      useColors: () => colors,
      useThemedStyles: (factory: (value: unknown) => unknown) => factory(colors),
    };
  }
  if (request === "@/constants/colors") return {};
  if (request === "@/constants/fonts") {
    return { fonts: new Proxy({}, { get: () => "System" }) };
  }
  if (request === "@/lib/haptics") {
    return { haptics: { selection() {}, success() {}, warning() {} } };
  }

  return originalLoad.apply(this, [request, parent, isMain]);
};

after(() => {
  Module._load = originalLoad;
});

async function renderProfile(ProfileStep: React.ComponentType) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(createElement(ProfileStep));
  });
  return renderer;
}

// The Continue footer is a plain fixed View at the screen bottom: the keyboard
// covers it while typing (it must NOT ride up over the focused field), so the
// scroll's bottomOffset only clears the keyboard + iOS toolbar and never
// includes the footer height. The measured footer still drives the scroll
// content's bottom padding so content clears it when the keyboard is closed.
test("onboarding profile keeps the Continue footer anchored (not keyboard-sticky)", async () => {
  const { default: ProfileStep } = await import("../app/onboarding/profile");

  const findFooter = (renderer: TestRenderer.ReactTestRenderer) =>
    renderer.root.findAll(
      (node) => node.type === ("View" as any) && typeof node.props.onLayout === "function"
    )[0];

  platform.OS = "ios";
  const ios = await renderProfile(ProfileStep);

  // The sticky wrapper is gone entirely; the footer is a plain measured View.
  assert.equal(ios.root.findAllByType("KeyboardStickyView" as any).length, 0);
  let aware = ios.root.findByType("KeyboardAwareScrollView" as any);
  // No custom toolbar anymore (system return keys handle navigation), so the
  // focused field only keeps the small gap above the keyboard.
  assert.equal(aware.props.bottomOffset, 12);

  await act(async () => {
    findFooter(ios).props.onLayout({ nativeEvent: { layout: { height: 120 } } });
  });

  aware = ios.root.findByType("KeyboardAwareScrollView" as any);
  // Footer height feeds the resting content padding only, never the offset.
  assert.equal(aware.props.bottomOffset, 12);
  assert.equal(aware.props.contentContainerStyle[1].paddingBottom, 136);

  await act(async () => ios.unmount());

  platform.OS = "android";
  const android = await renderProfile(ProfileStep);
  assert.equal(android.root.findAllByType("KeyboardStickyView" as any).length, 0);

  await act(async () => {
    findFooter(android).props.onLayout({ nativeEvent: { layout: { height: 100 } } });
  });

  aware = android.root.findByType("KeyboardAwareScrollView" as any);
  assert.equal(aware.props.bottomOffset, 12);
  assert.equal(aware.props.contentContainerStyle[1].paddingBottom, 116);

  await act(async () => android.unmount());
});
