import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

let pulsarLoads = 0;
const expoCalls: string[] = [];

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "react-native") {
    return {
      Platform: { OS: "ios" },
      // Expo Go: the RNPulsar TurboModule is not in the binary.
      TurboModuleRegistry: { get: () => null },
    };
  }
  if (request === "react-native-pulsar") {
    pulsarLoads += 1;
    throw new Error("module evaluation would RedBox in Expo Go");
  }
  if (request === "expo-haptics") {
    return {
      selectionAsync: () => {
        expoCalls.push("selection");
      },
      notificationAsync: (type: string) => {
        expoCalls.push(type);
      },
      NotificationFeedbackType: { Success: "success", Warning: "warning" },
    };
  }
  return originalLoad.apply(this, [request, parent, isMain]);
};

after(() => {
  Module._load = originalLoad;
});

test("Expo Go: a missing RNPulsar never evaluates react-native-pulsar and Expo Haptics plays", async () => {
  const { haptics } = await import("@/lib/haptics");

  haptics.selection();
  haptics.success();
  haptics.warning();

  assert.equal(pulsarLoads, 0, "react-native-pulsar must not be required when RNPulsar is absent");
  assert.deepEqual(expoCalls, ["selection", "success", "warning"]);
});

test("the RNPulsar probe stays ahead of the react-native-pulsar require", () => {
  const source = readFileSync(resolve(import.meta.dirname, "../lib/haptics.ts"), "utf8");
  const probeAt = source.indexOf('TurboModuleRegistry.get("RNPulsar")');
  const requireAt = source.indexOf('require("react-native-pulsar")');
  assert.ok(probeAt !== -1, "probe present");
  assert.ok(requireAt !== -1, "pulsar require present");
  assert.ok(probeAt < requireAt, "probe must run before the package is required");
});
