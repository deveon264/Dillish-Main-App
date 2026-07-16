import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React, { createElement } from "react";

// Tell React this is a valid environment for act() so state updates flush
// synchronously and no "not configured to support act(...)" warnings are logged.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

type Meal = {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  ts: number;
  photoUri?: string;
  mealType?: string;
};

const mealTs = (() => {
  const d = new Date();
  d.setHours(9, 5, 0, 0);
  return d.getTime();
})();

let calorieLogs: Meal[] = [];
let deleteCalls: string[] = [];

const host = (name: string) =>
  function Host({ children, ...props }: any) {
    return createElement(name, props, children);
  };

const RN = {
  View: host("View"),
  Text: host("Text"),
  ScrollView: host("ScrollView"),
  Pressable: ({ children, ...props }: any) =>
    createElement(
      "Pressable",
      props,
      typeof children === "function" ? children({ pressed: false }) : children
    ),
  Image: host("Image"),
  TextInput: host("TextInput"),
  ActivityIndicator: host("ActivityIndicator"),
  Modal: ({ visible, children, ...props }: any) =>
    visible ? createElement("Modal", props, children) : null,
  StyleSheet: { create: (s: any) => s, absoluteFill: { position: "absolute" } },
  Platform: { OS: "ios" },
  Animated: {
    Value: class {
      value: number;
      constructor(value: number) {
        this.value = value;
      }
    },
    loop: () => ({ start() {}, stop() {} }),
    sequence: (steps: unknown[]) => steps,
    timing: () => ({}),
  },
  Easing: { inOut: (easing: unknown) => easing, ease: "ease" },
  ActionSheetIOS: { showActionSheetWithOptions() {} },
  Alert: { alert() {} },
};

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "react-native") return RN;
  if (request === "react-native-keyboard-controller") {
    return {
      KeyboardAwareScrollView: host("KeyboardAwareScrollView"),
      KeyboardGestureArea: host("KeyboardGestureArea"),
    };
  }
  if (request === "expo-image-picker") return {};
  if (request === "expo-constants") {
    return { __esModule: true, default: { expoConfig: { hostUri: "127.0.0.1:8081" } } };
  }
  // The Recipes entry card navigates via expo-router, which pulls the whole
  // navigation stack; the meal-detail behavior under test never navigates.
  if (request === "expo-router") {
    return { useRouter: () => ({ push() {}, replace() {}, back() {} }) };
  }
  // Voice logging pulls in the recorder + file reader; neither is loadable in
  // this bare renderer and the meal-detail behavior under test never records.
  if (request === "expo-audio") {
    return {
      useAudioRecorder: () => ({
        record() {},
        stop: async () => {},
        prepareToRecordAsync: async () => {},
        uri: null,
      }),
      AudioModule: { requestRecordingPermissionsAsync: async () => ({ granted: false }) },
      RecordingPresets: { HIGH_QUALITY: {} },
      setAudioModeAsync: async () => {},
    };
  }
  if (request === "expo-file-system/legacy") return { readAsStringAsync: async () => "" };
  if (request === "expo-camera") {
    return { CameraView: host("CameraView"), useCameraPermissions: () => [{ granted: false }, () => {}] };
  }
  if (request === "@expo/vector-icons") {
    return { Ionicons: ({ children, ...props }: any) => createElement("Ionicons", props, children) };
  }
  if (request === "expo-linear-gradient") return { LinearGradient: host("LinearGradient") };
  if (request === "react-native-safe-area-context") {
    return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
  }
  if (request === "@/components/trackers/AnalyzingCard") {
    return { AnalyzingCard: host("AnalyzingCard") };
  }
  if (request === "@/components/ProgressRing") {
    return { ProgressRing: ({ children, ...props }: any) => createElement("ProgressRing", props, children) };
  }
  if (request === "@/components/AnimatedNumber") {
    return {
      AnimatedNumber: ({ value, formatter, ...props }: any) =>
        createElement("Text", props, formatter ? formatter(value) : String(value)),
      AnimatedText: host("AnimatedText"),
    };
  }
  if (request === "@/components/Bouncy") {
    return { Bouncy: RN.Pressable };
  }
  if (request === "@/components/Motion") {
    return { MotionListItem: RN.View, ScreenEntrance: RN.View };
  }
  // Meal-detail behavior is independent of native feedback. Keeping the
  // semantic adapter mocked prevents this renderer from loading either native
  // backend when it exercises the destructive meal action.
  if (request === "@/lib/haptics") {
    return {
      haptics: { selection() {}, success() {}, warning() {} },
      waterAddFeedback: () => "selection",
    };
  }
  if (request === "@/hooks/useInsets") return { useInsets: () => ({ top: 0, bottom: 0 }) };
  // The active-tab scroll/refresh hook pulls in the navigation stack (expo-router
  // / @react-navigation), which isn't loadable in this bare renderer; the meal
  // detail behavior under test doesn't need it, so stub it to an inert ref.
  if (request === "@/hooks/useActiveTabScroll") return { useActiveTabScroll: () => ({ current: null }) };
  if (request === "@/contexts/DataContext") {
    return {
      useData: () => ({
        profile: { calorieGoal: 1500 },
        calorieLogs,
        addCalorie: async () => {},
        deleteCalorie: async (id: string) => {
          deleteCalls.push(id);
        },
      }),
    };
  }
  return originalLoad.apply(this, [request, parent, isMain]);
};

after(() => {
  Module._load = originalLoad;
});

async function mount(meals: Meal[]) {
  calorieLogs = meals;
  deleteCalls = [];
  const { CaloriesTracker } = await import("@/components/trackers/CaloriesTracker");
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(createElement(CaloriesTracker));
  });
  return renderer;
}

function textOf(node: ReactTestInstance | string | number): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return (node.children ?? []).map((child) => textOf(child as any)).join("");
}

function sampleMeal(): Meal {
  return {
    id: "meal-1",
    name: "Banana yogurt bowl",
    kcal: 420,
    protein: 18,
    carbs: 62,
    fats: 9,
    ts: mealTs,
    photoUri: "file:///banana-yogurt.jpg",
    mealType: "Breakfast",
  };
}

test("tapping a logged meal opens a view-only detail modal", async () => {
  const meal = sampleMeal();
  const renderer = await mount([meal]);

  const row = renderer.root.findByProps({ accessibilityLabel: `View meal details for ${meal.name}` });
  await act(async () => {
    row.props.onPress();
  });

  const body = textOf(renderer.root);
  assert.match(body, /Banana yogurt bowl/);
  assert.match(body, /Breakfast/);
  assert.match(body, new RegExp(formatExpectedTime(meal.ts)));
  assert.match(body, /420 kcal/);
  assert.match(body, /18gProtein/);
  assert.match(body, /62gCarbs/);
  assert.match(body, /9gFats/);
  const closeControls = renderer.root.findAllByProps({ accessibilityLabel: "Close meal details" });
  assert.ok(closeControls.length > 0);

  const close = closeControls[0];
  await act(async () => {
    close.props.onPress();
  });

  assert.equal(renderer.root.findAllByProps({ accessibilityLabel: "Close meal details" }).length, 0);
});

test("tapping the trash button deletes without opening meal details", async () => {
  const meal = sampleMeal();
  const renderer = await mount([meal]);
  const trash = renderer.root.findByProps({ accessibilityLabel: `Delete ${meal.name}` });
  let stopped = false;

  await act(async () => {
    trash.props.onPress({ stopPropagation: () => { stopped = true; } });
  });

  assert.equal(stopped, true);
  assert.deepEqual(deleteCalls, [meal.id]);
  assert.equal(renderer.root.findAllByProps({ accessibilityLabel: "Close meal details" }).length, 0);
});

function formatExpectedTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
