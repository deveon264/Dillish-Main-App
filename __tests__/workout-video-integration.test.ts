import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useRef, useState } from "react";

import { nextVideoTime, acceptedVideoDuration } from "@/lib/workoutProgress";

// Tell React this is a valid environment for act() so effects flush
// synchronously and no "not configured to support act(...)" warnings are logged.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act } from "react-test-renderer";

import {
  useWorkoutAdvanceCore,
  type WorkoutAdvanceCore,
} from "@/hooks/useWorkoutAdvanceCore";

// =========================================================================
// Why this suite exists
// =========================================================================
// Every other workout-advance suite calls `completeExercise("video")` (or the
// pure `decideExerciseCompletion`) DIRECTLY. None of them exercise the bridge
// the workout screen actually relies on at runtime, namely:
//
//   useEventListener(player, "timeUpdate",   (e) => setVideoTime(nextVideoTime(e)));
//   useEventListener(player, "statusChange", ({ status }) =>
//     { const d = acceptedVideoDuration(status, player.duration); if (d !== null) setVideoDuration(d); });
//   useEventListener(player, "playToEnd",    () => onVideoEndRef.current());
//   ...
//   onVideoEndRef.current = () => completeExercise("video");
//
// i.e. the real expo-video player emits "timeUpdate" / "statusChange" /
// "playToEnd", and those events flow through `useEventListener` and the
// `onVideoEndRef` bridge into the advance machine. A real device pass confirms
// the native module fires those events; this harness confirms OUR wiring turns
// each fired event into the right downstream state change, including the
// staleness guarantee that the listener (registered once) always invokes the
// LATEST render's `completeExercise` closure rather than a captured stale one.
//
// The real `useEventListener` from `expo` cannot be imported in the node:test
// runtime (its package entry needs `__DEV__` and native setup), so we reproduce
// its exact contract here: a ref kept current every render, with a single
// subscription whose callback always calls `listenerRef.current(...)`. See
// node_modules/expo/src/hooks/useEvent.ts -- this mirrors that implementation
// line for line so the harness stays faithful to the real hook.

import { useEffect } from "react";

function useEventListener(
  emitter: FakePlayer,
  eventName: string,
  listener: (...args: any[]) => void,
): void {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  useEffect(() => {
    const callback = (...args: any[]) => listenerRef.current(...args);
    const subscription = emitter.addListener(eventName, callback);
    return () => subscription.remove();
  }, [emitter, eventName]);
}

// A minimal stand-in for the expo-video player: an event emitter with the same
// `addListener(name, cb) -> { remove() }` shape `useEventListener` consumes,
// plus an `emit` to fire events from a test and a `duration` field the
// "statusChange" handler reads (the screen reads `player.duration`). It also
// counts how many times each event was subscribed, so a test can prove the
// listener is wired exactly once across re-renders.
class FakePlayer {
  duration = 0;
  private listeners: Record<string, Set<(...a: any[]) => void>> = {};
  addCounts: Record<string, number> = {};

  addListener(name: string, cb: (...a: any[]) => void) {
    (this.listeners[name] ??= new Set()).add(cb);
    this.addCounts[name] = (this.addCounts[name] ?? 0) + 1;
    return {
      remove: () => {
        this.listeners[name]?.delete(cb);
      },
    };
  }

  emit(name: string, payload?: any) {
    for (const cb of this.listeners[name] ?? []) cb(payload);
  }
}

// A three-exercise workout, each with its own clip. The harness reproduces the
// screen's per-exercise video state and the onVideoEndRef bridge, wired to the
// real `useWorkoutAdvanceCore`.
const DURATIONS = [30, 40, 50];
const VIDEO_IDS = ["v0", "v1", "v2"];

type Props = { restGap: number; paused: boolean };

function renderPlayerHarness(initial: Props) {
  const player = new FakePlayer();
  const result: { current: WorkoutAdvanceCore } = { current: {} as WorkoutAdvanceCore };
  const video = { time: 0, duration: 0 };
  const calls = { complete: 0, finish: 0 };
  // The clip confirmed-loaded for the exercise now showing (the screen's
  // loadedVideoIdRef). A test mutates it through `setLoaded`.
  let loadedId: string | null = "v0";
  let props = { ...initial };

  function Harness(p: Props) {
    const [videoTime, setVideoTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const onVideoEndRef = useRef<() => void>(() => {});
    video.time = videoTime;
    video.duration = videoDuration;

    // The screen's three player-event handlers, verbatim in behaviour.
    useEventListener(player, "timeUpdate", (e: { currentTime: number }) => {
      setVideoTime(nextVideoTime(e));
    });
    useEventListener(player, "statusChange", ({ status }: { status: string }) => {
      const d = acceptedVideoDuration(status, player.duration);
      if (d !== null) setVideoDuration(d);
    });
    useEventListener(player, "playToEnd", () => {
      onVideoEndRef.current();
    });

    const core = useWorkoutAdvanceCore({
      total: 3,
      restGap: p.restGap,
      paused: p.paused,
      durationAt: (i) => DURATIONS[i] ?? 0,
      initialRemaining: DURATIONS[0],
      videoIdAt: (i) => VIDEO_IDS[i] ?? null,
      getLoadedVideoId: () => loadedId,
      videoDuration,
      onComplete: () => {
        calls.complete += 1;
      },
      onFinish: () => {
        calls.finish += 1;
      },
    });
    result.current = core;

    // The bridge, assigned during render exactly as the screen does (line ~480
    // of app/workout/[id].tsx): the once-registered "playToEnd" listener always
    // calls THIS render's completeExercise closure.
    onVideoEndRef.current = () => core.completeExercise("video");

    return null;
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Harness, props));
  });

  return {
    player,
    result,
    video,
    calls,
    setLoaded(id: string | null) {
      loadedId = id;
    },
    update(next: Partial<Props>) {
      props = { ...props, ...next };
      act(() => renderer.update(createElement(Harness, props)));
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

// =========================================================================
// "timeUpdate" -> videoTime
// =========================================================================

test("a 'timeUpdate' event from the player commits its currentTime to videoTime", () => {
  const h = renderPlayerHarness({ restGap: 15, paused: false });

  act(() => h.player.emit("timeUpdate", { currentTime: 12.5 }));
  assert.equal(h.video.time, 12.5);

  act(() => h.player.emit("timeUpdate", { currentTime: 0 }));
  assert.equal(h.video.time, 0);
  h.unmount();
});

test("a 'timeUpdate' event with no currentTime never tracks undefined (falls back to 0)", () => {
  const h = renderPlayerHarness({ restGap: 15, paused: false });

  act(() => h.player.emit("timeUpdate", { currentTime: 9 }));
  assert.equal(h.video.time, 9);

  // A malformed event must not poison the progress bar.
  act(() => h.player.emit("timeUpdate", {}));
  assert.equal(h.video.time, 0);
  h.unmount();
});

// =========================================================================
// "statusChange" -> videoDuration
// =========================================================================

test("a 'statusChange' to readyToPlay with a good duration commits videoDuration", () => {
  const h = renderPlayerHarness({ restGap: 15, paused: false });

  h.player.duration = 20;
  act(() => h.player.emit("statusChange", { status: "readyToPlay" }));
  assert.equal(h.video.duration, 20);
  h.unmount();
});

test("a 'statusChange' that is not ready (or a garbage duration) leaves videoDuration untouched", () => {
  const h = renderPlayerHarness({ restGap: 15, paused: false });

  // Latch a known-good duration first.
  h.player.duration = 18;
  act(() => h.player.emit("statusChange", { status: "readyToPlay" }));
  assert.equal(h.video.duration, 18);

  // A still-loading clip reports a length before it is ready: ignore it.
  h.player.duration = 99;
  act(() => h.player.emit("statusChange", { status: "loading" }));
  assert.equal(h.video.duration, 18);

  // Ready, but a garbage duration (NaN) must not overwrite the good value.
  h.player.duration = NaN;
  act(() => h.player.emit("statusChange", { status: "readyToPlay" }));
  assert.equal(h.video.duration, 18);
  h.unmount();
});

// =========================================================================
// "playToEnd" -> onVideoEndRef -> completeExercise("video")
// =========================================================================

test("a 'playToEnd' for the current loaded clip opens the rest gap (rest on)", () => {
  const h = renderPlayerHarness({ restGap: 15, paused: false });

  act(() => h.player.emit("playToEnd"));

  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.result.current.restRemaining, 15);
  assert.equal(h.result.current.index, 0);
  assert.equal(h.calls.complete, 1);
  assert.equal(h.calls.finish, 0);
  h.unmount();
});

test("a 'playToEnd' with rest off advances straight to the next exercise", () => {
  const h = renderPlayerHarness({ restGap: 0, paused: false });

  act(() => h.player.emit("playToEnd"));

  assert.equal(h.result.current.phase, "active");
  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.remaining, DURATIONS[1]);
  assert.equal(h.calls.complete, 1);
  assert.equal(h.calls.finish, 0);
  h.unmount();
});

// =========================================================================
// The stale-clip guard, driven through the REAL event path: a "playToEnd"
// emitted while the next clip is still loading (loaded id null) is dropped.
// =========================================================================

test("a 'playToEnd' fired mid-load (next clip not yet confirmed) never skips ahead", () => {
  const h = renderPlayerHarness({ restGap: 15, paused: false });

  // Advance to exercise 1; the new clip has not confirmed-loaded yet.
  act(() => h.result.current.goNext());
  assert.equal(h.result.current.index, 1);
  h.setLoaded(null);

  // A late "playToEnd" from exercise 0's outgoing clip arrives over the wire.
  act(() => h.player.emit("playToEnd"));

  assert.equal(h.result.current.index, 1);
  assert.equal(h.result.current.phase, "active");
  assert.equal(h.calls.complete, 0);
  assert.equal(h.calls.finish, 0);
  h.unmount();
});

// =========================================================================
// The whole point of the onVideoEndRef bridge: the "playToEnd" listener is
// registered exactly ONCE (it survives every re-render), yet a fired event
// always runs the CURRENT render's completeExercise closure. We walk the full
// workout end to end by emitting real "playToEnd" events and confirming each
// clip as loaded, and assert the workout finishes with the listener never
// re-subscribed.
// =========================================================================

test("one registered 'playToEnd' listener drives every exercise to the finish via the latest closure", () => {
  const h = renderPlayerHarness({ restGap: 0, paused: false });

  // Exercise 0 -> 1: emit the end, confirm exercise 1's clip as loaded.
  act(() => h.player.emit("playToEnd"));
  assert.equal(h.result.current.index, 1);
  h.setLoaded("v1");

  // Exercise 1 -> 2.
  act(() => h.player.emit("playToEnd"));
  assert.equal(h.result.current.index, 2);
  h.setLoaded("v2");

  // Exercise 2 is the last: its end finishes the workout.
  act(() => h.player.emit("playToEnd"));
  assert.equal(h.result.current.phase, "done");
  assert.equal(h.calls.finish, 1);
  assert.equal(h.calls.complete, 3);

  // The listener was wired exactly once despite the re-renders each advance
  // triggered: the freshness comes from the ref bridge, not from re-subscribing.
  assert.equal(h.player.addCounts["playToEnd"], 1);
  h.unmount();
});

// =========================================================================
// The bridge stays fresh after a prop-driven re-render too: toggling paused
// re-renders the harness (reassigning onVideoEndRef.current), and a subsequent
// emitted "playToEnd" still completes the exercise now showing.
// =========================================================================

test("the bridge still fires correctly after a re-render from a prop change", () => {
  const h = renderPlayerHarness({ restGap: 15, paused: false });

  // A re-render from a paused toggle (mirrors the user pausing/resuming).
  act(() => h.update({ paused: true }));
  act(() => h.update({ paused: false }));

  // The once-registered listener now resolves to the latest closure.
  act(() => h.player.emit("playToEnd"));
  assert.equal(h.result.current.phase, "rest");
  assert.equal(h.result.current.index, 0);
  assert.equal(h.calls.complete, 1);
  assert.equal(h.player.addCounts["playToEnd"], 1);
  h.unmount();
});

// =========================================================================
// Teardown: unmounting removes the subscriptions, so a stray event after the
// player screen is gone can never call back into a torn-down tree.
// =========================================================================

test("unmounting removes the player subscriptions", () => {
  const h = renderPlayerHarness({ restGap: 15, paused: false });
  h.unmount();

  // No listeners remain: emitting is a no-op and must not throw.
  assert.doesNotThrow(() => h.player.emit("playToEnd"));
  assert.doesNotThrow(() => h.player.emit("timeUpdate", { currentTime: 5 }));
  assert.equal(h.calls.complete, 0);
});
