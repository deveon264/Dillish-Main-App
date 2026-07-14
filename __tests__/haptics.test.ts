import assert from "node:assert/strict";
import test from "node:test";
import {
  createHaptics,
  waterAddFeedback,
  type HapticsBackend,
} from "../lib/hapticsCore";

function fakeBackend(calls: string[]): HapticsBackend {
  return {
    selection: () => {
      calls.push("selection");
    },
    success: () => {
      calls.push("success");
    },
    warning: () => {
      calls.push("warning");
    },
  };
}

test("Pulsar remains preferred and both backend loads are cached", () => {
  const primaryCalls: string[] = [];
  let primaryLoads = 0;
  let fallbackLoads = 0;
  const haptics = createHaptics({
    platform: "ios",
    loadPrimary: () => {
      primaryLoads += 1;
      return fakeBackend(primaryCalls);
    },
    loadFallback: () => {
      fallbackLoads += 1;
      return fakeBackend([]);
    },
  });

  haptics.selection();
  haptics.success();
  haptics.warning();

  assert.deepEqual(primaryCalls, ["selection", "success", "warning"]);
  assert.equal(primaryLoads, 1);
  assert.equal(fallbackLoads, 0, "Expo Haptics stays unloaded while Pulsar works");
});

test("Expo Haptics handles every semantic when Pulsar cannot load", () => {
  const fallbackCalls: string[] = [];
  let primaryLoads = 0;
  let fallbackLoads = 0;
  const haptics = createHaptics({
    platform: "android",
    loadPrimary: () => {
      primaryLoads += 1;
      throw new Error("Pulsar is not in Expo Go");
    },
    loadFallback: () => {
      fallbackLoads += 1;
      return fakeBackend(fallbackCalls);
    },
  });

  haptics.selection();
  haptics.success();
  haptics.warning();

  assert.deepEqual(fallbackCalls, ["selection", "success", "warning"]);
  assert.equal(primaryLoads, 1, "the failed Pulsar load is cached");
  assert.equal(fallbackLoads, 1, "the Expo fallback is cached");
});

test("a synchronous Pulsar playback failure retires it and switches to Expo", () => {
  const primaryCalls: string[] = [];
  const fallbackCalls: string[] = [];
  const haptics = createHaptics({
    platform: "ios",
    loadPrimary: () => ({
      selection: () => {
        primaryCalls.push("selection");
        throw new Error("native playback failed");
      },
      success: () => {
        primaryCalls.push("success");
      },
      warning: () => {
        primaryCalls.push("warning");
      },
    }),
    loadFallback: () => fakeBackend(fallbackCalls),
  });

  haptics.selection();
  haptics.success();

  assert.deepEqual(primaryCalls, ["selection"]);
  assert.deepEqual(fallbackCalls, ["selection", "success"]);
});

test("an asynchronous Pulsar rejection is contained and retried through Expo", async () => {
  const fallbackCalls: string[] = [];
  const haptics = createHaptics({
    platform: "android",
    loadPrimary: () => ({
      selection: () => Promise.reject(new Error("async native failure")),
      success: () => {},
      warning: () => {},
    }),
    loadFallback: () => fakeBackend(fallbackCalls),
  });

  assert.doesNotThrow(() => haptics.selection());
  await Promise.resolve();
  await Promise.resolve();
  haptics.success();

  assert.deepEqual(fallbackCalls, ["selection", "success"]);
});

test("web loads neither backend and two unavailable backends remain safe", () => {
  let webLoads = 0;
  const web = createHaptics({
    platform: "web",
    loadPrimary: () => {
      webLoads += 1;
      return fakeBackend([]);
    },
    loadFallback: () => {
      webLoads += 1;
      return fakeBackend([]);
    },
  });
  web.selection();
  web.success();
  assert.equal(webLoads, 0);

  let primaryLoads = 0;
  let fallbackLoads = 0;
  const unavailable = createHaptics({
    platform: "android",
    loadPrimary: () => {
      primaryLoads += 1;
      throw new Error("primary missing");
    },
    loadFallback: () => {
      fallbackLoads += 1;
      throw new Error("fallback missing");
    },
  });
  assert.doesNotThrow(() => unavailable.warning());
  assert.doesNotThrow(() => unavailable.selection());
  assert.equal(primaryLoads, 1);
  assert.equal(fallbackLoads, 1);
});

test("a rejected Expo Haptics promise is contained and cached as unavailable", async () => {
  let fallbackLoads = 0;
  let fallbackCalls = 0;
  const haptics = createHaptics({
    platform: "ios",
    loadPrimary: () => {
      throw new Error("primary missing");
    },
    loadFallback: () => {
      fallbackLoads += 1;
      return {
        selection: () => {
          fallbackCalls += 1;
          return Promise.reject(new Error("fallback rejected"));
        },
        success: () => {
          fallbackCalls += 1;
        },
        warning: () => {
          fallbackCalls += 1;
        },
      };
    },
  });

  assert.doesNotThrow(() => haptics.selection());
  await Promise.resolve();
  await Promise.resolve();
  haptics.success();

  assert.equal(fallbackCalls, 1, "the rejected fallback is not called again");
  assert.equal(fallbackLoads, 1);
});

test("water feedback celebrates only the transition across the daily goal", () => {
  assert.equal(waterAddFeedback(900, 100, 1000), "success");
  assert.equal(waterAddFeedback(900, 99, 1000), "selection");
  assert.equal(waterAddFeedback(1000, 250, 1000), "selection");
  assert.equal(waterAddFeedback(900, 100, 0), "selection");
});
