import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React, { createElement, createRef, forwardRef } from "react";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act } from "react-test-renderer";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

const HostTextInput = forwardRef<any, any>(function HostTextInput(props, ref) {
  return createElement("TextInput", { ...props, ref }, props.children);
});
const host = (name: string) => ({ children, ...props }: any) => createElement(name, props, children);
const colors = new Proxy(
  { accent: "#c05", card: "#fff", mutedForeground: "#777", accentTint: "#fee", cardBorder: "#ddd", radius: 14 },
  { get: (target, key: string) => (target as any)[key] ?? "#000" },
);

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "react-native") {
    return {
      View: host("View"),
      Text: host("Text"),
      TextInput: HostTextInput,
      InputAccessoryView: host("InputAccessoryView"),
      Keyboard: { dismiss() {} },
      Platform: { OS: "ios" },
      StyleSheet: { create: (value: unknown) => value },
    };
  }
  if (request === "@/components/Bouncy") return { Bouncy: host("Bouncy") };
  if (request === "@expo/vector-icons") return { Ionicons: host("Ionicons"), glyphMap: {} };
  if (request === "@/hooks/useColors") {
    return {
      useColors: () => colors,
      useThemedStyles: (factory: (value: unknown) => unknown) => factory(colors),
    };
  }
  if (request === "@/constants/colors") return {};
  if (request === "@/constants/fonts") return { fonts: new Proxy({}, { get: () => "System" }) };
  if (request === "@/lib/haptics") return { haptics: { selection() {} } };
  return originalLoad.apply(this, [request, parent, isMain]);
};

after(() => {
  Module._load = originalLoad;
});

test("Input forwards its native ref, standard props, and composes focus callbacks", async () => {
  const { Input } = await import("@/components/Input");
  const ref = createRef<any>();
  const nativeNode = { kind: "text-input" };
  const events: string[] = [];
  let renderer!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = TestRenderer.create(
      createElement(Input, {
        ref,
        accessibilityLabel: "Profile age",
        onFocus: () => events.push("focus"),
        onBlur: () => events.push("blur"),
      }),
      { createNodeMock: (element) => element.type === "TextInput" ? nativeNode : null },
    );
  });

  const input = renderer.root.findByType("TextInput" as any);
  assert.equal(ref.current, nativeNode);
  assert.equal(input.props.accessibilityLabel, "Profile age");

  await act(async () => input.props.onFocus({ nativeEvent: {} }));
  await act(async () => input.props.onBlur({ nativeEvent: {} }));
  assert.deepEqual(events, ["focus", "blur"]);
});

test("numeric Done accessory is retained and can be suppressed for controller toolbars", async () => {
  const { Input } = await import("@/components/Input");
  const submit = () => {};
  let withAccessory!: TestRenderer.ReactTestRenderer;
  let withoutAccessory!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    withAccessory = TestRenderer.create(createElement(Input, { keyboardType: "number-pad" }));
    withoutAccessory = TestRenderer.create(
      createElement(Input, {
        keyboardType: "decimal-pad",
        dismissKeyboardAccessory: false,
        returnKeyType: "next",
        onSubmitEditing: submit,
      }),
    );
  });

  assert.equal(withAccessory.root.findAllByType("InputAccessoryView" as any).length, 1);
  assert.match(withAccessory.root.findByType("TextInput" as any).props.inputAccessoryViewID, /^input-done-accessory-/);
  assert.equal(withoutAccessory.root.findAllByType("InputAccessoryView" as any).length, 0);
  assert.equal(withoutAccessory.root.findByType("TextInput" as any).props.inputAccessoryViewID, undefined);
  assert.equal(withoutAccessory.root.findByType("TextInput" as any).props.returnKeyType, "next");
  assert.equal(withoutAccessory.root.findByType("TextInput" as any).props.onSubmitEditing, submit);
});
