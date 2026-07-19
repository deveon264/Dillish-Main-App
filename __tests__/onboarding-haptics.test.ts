import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React, { createElement } from "react";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

const events: string[] = [];
const colors = new Proxy(
  {
    gradient: ["#111", "#222"],
    welcomeScrim: ["transparent", "transparent", "#fff"],
    radius: 12,
    radiusLg: 18,
  } as Record<string, unknown>,
  { get: (target, key: string) => target[key] ?? "#000" },
);

const fade = {
  duration() {
    return fade;
  },
  delay() {
    return fade;
  },
  springify() {
    return fade;
  },
};

const animation = { start() {}, stop() {} };

const ScreenButton = (props: any) => createElement("ScreenButton", props, props.children);
const ScreenBouncy = (props: any) => createElement("ScreenBouncy", props, props.children);
const passthrough = ({ children }: any) => createElement(React.Fragment, null, children);
const host = (name: string) => (props: any) => createElement(name, props, props.children);

let router = {
  push: (path: string) => events.push(`push:${path}`),
  replace: (path: string) => events.push(`replace:${path}`),
  back: () => events.push("back"),
};

let answers: Record<string, any> = {};
let save: (patch: Record<string, unknown>) => Promise<void> = async () => {
  events.push("save");
};
let mode = { personalize: false, total: 10, withMode: (path: string) => path };
let auth = {
  user: { id: "member-1" },
  completeOnboarding: async () => {
    events.push("complete");
  },
};
let subscription = {
  subscribe: (_plan: string, _opts: unknown) => {
    events.push("subscribe");
    return Promise.resolve({ ok: true });
  },
};

const haptics = {
  selection: () => events.push("selection"),
  success: () => events.push("success"),
  warning: () => events.push("warning"),
};

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "react-native") {
    return {
      View: "View",
      Text: "Text",
      ScrollView: "ScrollView",
      Pressable: "Pressable",
      Switch: "Switch",
      Modal: "Modal",
      ActivityIndicator: "ActivityIndicator",
      KeyboardAvoidingView: "KeyboardAvoidingView",
      Platform: { OS: "ios" },
      useWindowDimensions: () => ({ width: 390, height: 844 }),
      StyleSheet: { create: (value: unknown) => value, absoluteFill: {}, absoluteFillObject: {} },
      Animated: {
        View: "AnimatedView",
        Value: class Value {
          constructor(public value: number) {}
        },
        sequence: () => animation,
        delay: () => animation,
        loop: () => animation,
        timing: () => animation,
      },
    };
  }
  if (request === "react-native-reanimated") {
    return {
      __esModule: true,
      default: { View: "ReanimatedView" },
      FadeInDown: fade,
      ZoomIn: fade,
    };
  }
  if (request === "expo-router") return { useRouter: () => router };
  if (request === "expo-image") return { Image: "Image" };
  if (request === "expo-linear-gradient") return { LinearGradient: "LinearGradient" };
  if (request === "@expo/vector-icons") return { Ionicons: host("Ionicons") };
  if (request.endsWith(".webp") || request.endsWith(".png")) return 1;

  if (request === "@/components/Button") return { Button: ScreenButton };
  if (request === "@/components/Bouncy") return { Bouncy: ScreenBouncy };
  if (request === "@/components/Motion") return { ScreenEntrance: passthrough };
  if (request === "@/components/GradientBackground") return { GradientBackground: host("GradientBackground") };
  if (request === "@/components/Logo") return { Logo: host("Logo") };
  if (request === "@/components/StepHeader") return { StepHeader: host("StepHeader") };
  if (request === "@/components/onboarding/OnboardKit") {
    return { Reveal: passthrough, Bouncy: ScreenBouncy, OnboardDecor: () => null };
  }
  if (request === "@/components/PageHeader") {
    return { createPageHeaderStyles: () => ({ title: {}, titleAccent: {} }) };
  }
  // The redesigned paywall composes these; only the hero (Skip/close) and the
  // CTA button are exercised here, so the rest are stubbed to keep their native
  // deps (expo-video, reanimated hooks) out of the test.
  if (request === "@/components/paywall/FeatureCard") return { FeatureCard: () => null };
  if (request === "@/components/paywall/PricingPlanCard") return { PricingPlanCard: () => null };
  if (request === "@/components/paywall/TrustIndicatorRow") return { TrustIndicatorRow: () => null };
  if (request === "@/components/paywall/PreviewModal") return { PreviewModal: () => null };

  if (request === "@/hooks/useInsets") return { useInsets: () => ({ top: 0, bottom: 0 }) };
  if (request === "@/hooks/useScale") return { useScale: () => ({ ms: (value: number) => value }) };
  if (request === "@/hooks/useColors") {
    return { useColors: () => colors, useThemedStyles: (factory: (value: unknown) => unknown) => factory(colors) };
  }
  if (request === "@/hooks/useOnboardingAnswers") {
    return { useOnboardingAnswers: () => ({ answers, save, ready: true }) };
  }
  if (request === "@/hooks/useOnboardingMode") return { useOnboardingMode: () => mode };
  if (request === "@/contexts/AuthContext") return { useAuth: () => auth };
  if (request === "@/contexts/SubscriptionContext") return { useSubscription: () => subscription };

  if (request === "@/constants/colors") return {};
  if (request === "@/constants/fonts") {
    return { fonts: new Proxy({}, { get: () => "System" }) };
  }
  if (request === "@/constants/programs") return { PROGRAMS: [] };
  if (request === "@/constants/goals") return { goalLabel: (value: string) => value };
  if (request === "@/lib/recommendation") {
    return { getRecommendedProgram: () => ({ id: "program-1", title: "Starter", description: "A steady plan" }) };
  }
  if (request === "@/lib/subscription") {
    const plan = (name: string) => ({
      name,
      fullLabel: `${name} plan`,
      amountLabel: "£0",
      periodLabel: "/month",
      best: name === "Yearly",
    });
    return {
      PLANS: { yearly: plan("Yearly"), monthly: plan("Monthly"), weekly: plan("Weekly") },
      TRIAL_DAYS: 7,
    };
  }
  if (request === "@/lib/haptics") return { haptics };

  return originalLoad.apply(this, [request, parent, isMain]);
};

after(() => {
  Module._load = originalLoad;
});

beforeEach(() => {
  events.length = 0;
  router = {
    push: (path: string) => events.push(`push:${path}`),
    replace: (path: string) => events.push(`replace:${path}`),
    back: () => events.push("back"),
  };
  answers = {
    goals: ["strength"],
    primaryGoal: "strength",
    fitnessLevel: "beginner",
    daysPerWeek: 3,
    durationPreference: "20_30",
    bodyFocus: ["full_body"],
    equipment: ["none"],
    limitations: [],
    calorieGoal: 2000,
    waterGoalMl: 2500,
    startWeight: null,
  };
  save = async () => {
    events.push("save");
  };
  mode = { personalize: false, total: 10, withMode: (path: string) => path };
  auth = {
    user: { id: "member-1" },
    completeOnboarding: async () => {
      events.push("complete");
    },
  };
  subscription = {
    subscribe: () => {
      events.push("subscribe");
      return Promise.resolve({ ok: true });
    },
  };
});

async function render(Component: React.ComponentType) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(createElement(Component));
  });
  return renderer;
}

function button(renderer: TestRenderer.ReactTestRenderer, label: string): ReactTestInstance {
  return renderer.root
    .findAllByType("ScreenButton" as any)
    .find((node) => node.props.label === label)!;
}

function bouncyWithText(renderer: TestRenderer.ReactTestRenderer, text: string): ReactTestInstance {
  return renderer.root.findAllByType("ScreenBouncy" as any).find((node) =>
    node.findAllByType("Text" as any).some((child) => child.children.join("").includes(text)),
  )!;
}

test("welcome journey CTA selects before navigation while Sign In stays silent", async () => {
  const { default: Welcome } = await import("../app/welcome");
  const renderer = await render(Welcome);

  await act(async () => button(renderer, "Begin Your Journey").props.onPress());
  assert.deepEqual(events, ["selection", "push:/onboarding/goal"]);

  events.length = 0;
  await act(async () => bouncyWithText(renderer, "Already have an account?").props.onPress());
  assert.deepEqual(events, ["push:/(auth)/login"]);
});

test("ordinary Continue selects before saving and disabled/loading Button gates the action", async () => {
  const { default: Limitations } = await import("../app/onboarding/limitations");
  const renderer = await render(Limitations);

  await act(async () => button(renderer, "Continue").props.onPress());
  assert.deepEqual(events, ["selection", "save", "push:/onboarding/profile"]);

  const { Button } = await import("../components/Button");
  let handled = 0;
  for (const props of [{ disabled: true }, { loading: true }]) {
    let gated!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      gated = TestRenderer.create(createElement(Button, { label: "Continue", onPress: () => handled++, ...props }));
    });
    await act(async () => gated.root.findByType("ScreenBouncy" as any).props.onPress());
  }
  assert.equal(handled, 0);
});

test("Build My Plan succeeds only after its save and emits no success on failure", async () => {
  mode = { personalize: true, total: 7, withMode: (path: string) => `${path}?mode=personalize` };
  save = async () => {
    events.push("save:start");
    await Promise.resolve();
    events.push("save:end");
  };
  const { default: Limitations } = await import("../app/onboarding/limitations");
  const renderer = await render(Limitations);

  await act(async () => button(renderer, "Build My Plan").props.onPress());
  assert.deepEqual(events, ["save:start", "save:end", "success", "replace:/(tabs)"]);

  events.length = 0;
  save = async () => {
    events.push("save:failed");
    throw new Error("save failed");
  };
  const failedRenderer = await render(Limitations);
  let failure: unknown;
  await act(async () => {
    try {
      await button(failedRenderer, "Build My Plan").props.onPress();
    } catch (error) {
      failure = error;
    }
  });
  assert.ok(failure instanceof Error);
  assert.deepEqual(events, ["save:failed"]);
});

test("Start My Journey succeeds after plan persistence and onboarding completion", async () => {
  const { default: PlanReady } = await import("../app/onboarding/plan-ready");
  const renderer = await render(PlanReady);

  await act(async () => button(renderer, "Start My Journey").props.onPress());
  assert.deepEqual(events, ["save", "complete", "success", "push:/onboarding/paywall"]);

  events.length = 0;
  save = async () => {
    events.push("save:failed");
    throw new Error("save failed");
  };
  const failedRenderer = await render(PlanReady);
  let failure: unknown;
  await act(async () => {
    try {
      await button(failedRenderer, "Start My Journey").props.onPress();
    } catch (error) {
      failure = error;
    }
  });
  assert.ok(failure instanceof Error);
  assert.deepEqual(events, ["save:failed"]);
});

test("paywall primary success preserves optimistic ordering while Skip and Back stay silent", async () => {
  const { default: Paywall } = await import("../app/onboarding/paywall");
  const renderer = await render(Paywall);

  await act(async () => button(renderer, "Start 7-Day Free Trial").props.onPress());
  assert.deepEqual(events, ["subscribe", "success", "replace:/onboarding/thank-you"]);

  events.length = 0;
  await act(async () => bouncyWithText(renderer, "Skip").props.onPress());
  const close = renderer.root.findAllByType("ScreenBouncy" as any).find((node) =>
    node.findAllByType("Ionicons" as any).some((icon) => icon.props.name === "close"),
  )!;
  await act(async () => close.props.onPress());
  assert.deepEqual(events, ["replace:/onboarding/thank-you", "back"]);
});
