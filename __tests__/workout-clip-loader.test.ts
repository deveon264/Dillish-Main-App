import { test } from "node:test";
import assert from "node:assert/strict";

import {
  loadExerciseClip,
  type ClipLoaderRefs,
  type ClipLoaderDeps,
} from "@/lib/workoutClipLoader";

// This suite covers the screen's OWN race-safe clip loader: the monotonic
// `loadSeq` token, the out-of-order resolution check, and the
// `loadedVideoId = null` reset at the start of every load. These live in the
// workout screen's effect (app/workout/[id].tsx), which imports expo-video and so
// cannot run in node:test directly; the logic is extracted into
// `loadExerciseClip` (the same pattern as `useWorkoutAdvanceCore`) so the guard
// can be exercised here. The screen calls this exact helper.

// A controllable deferred so a test can resolve a `replaceAsync` (or the native
// probe) at a precise moment, modelling a load that resolves slowly / out of
// order relative to a newer load.
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function freshRefs(): ClipLoaderRefs {
  return { loadSeq: { current: 0 }, loadedVideoId: { current: "stale-leftover" } };
}

// Base deps: web (no probe), an immediate replaceAsync, not paused. Each test
// overrides the bits it needs and records the calls it cares about.
function baseDeps(over: Partial<ClipLoaderDeps> = {}): ClipLoaderDeps {
  return {
    currentVideo: { id: "v1" },
    isWeb: true,
    videoUrl: (id) => `https://cdn/${id}.mp4`,
    replaceAsync: async () => {},
    play: () => {},
    isPaused: () => false,
    resetVideoProgress: () => {},
    ...over,
  };
}

test("a successful load bumps the token, clears then records loadedVideoId, and plays when not paused", async () => {
  const refs = freshRefs();
  const replaced: (string | null)[] = [];
  let played = 0;
  // Capture the loadedVideoId value AT the moment the source is swapped: it must
  // still be null then (only set AFTER the swap resolves).
  let idAtSwap: string | null = "unset";

  await loadExerciseClip(refs, baseDeps({
    currentVideo: { id: "v1" },
    replaceAsync: async (src) => {
      idAtSwap = refs.loadedVideoId.current;
      replaced.push(src);
    },
    play: () => {
      played += 1;
    },
  }));

  assert.equal(refs.loadSeq.current, 1, "token bumped once");
  assert.equal(idAtSwap, null, "loadedVideoId reset to null before the swap resolved");
  assert.deepEqual(replaced, ["https://cdn/v1.mp4"]);
  assert.equal(refs.loadedVideoId.current, "v1", "loadedVideoId records the loaded clip");
  assert.equal(played, 1, "auto-plays since the session is running");
});

test("a paused load swaps the source but does not auto-play", async () => {
  const refs = freshRefs();
  let played = 0;
  await loadExerciseClip(refs, baseDeps({
    isPaused: () => true,
    play: () => {
      played += 1;
    },
  }));
  assert.equal(refs.loadedVideoId.current, "v1");
  assert.equal(played, 0, "stays paused: opening a workout must not start playback");
});

test("a no-video exercise clears the player source and leaves loadedVideoId null", async () => {
  const refs = freshRefs();
  const replaced: (string | null)[] = [];
  let played = 0;
  await loadExerciseClip(refs, baseDeps({
    currentVideo: null,
    replaceAsync: async (src) => {
      replaced.push(src);
    },
    play: () => {
      played += 1;
    },
  }));
  assert.equal(refs.loadSeq.current, 1, "still bumps the token");
  assert.deepEqual(replaced, [null], "source cleared for the no-video exercise");
  assert.equal(refs.loadedVideoId.current, null, "no clip is confirmed loaded");
  assert.equal(played, 0);
});

test("every load resets loadedVideoId to null at the start, even before it resolves", async () => {
  const refs = freshRefs();
  refs.loadedVideoId.current = "v0"; // a previous clip was loaded.
  const swap = deferred<void>();

  // Kick off the load but DON'T resolve the swap yet.
  const p = loadExerciseClip(refs, baseDeps({
    currentVideo: { id: "v1" },
    replaceAsync: () => swap.promise,
  }));

  // The instant the load starts (synchronously, before any await resolves) the
  // confirmed-loaded id must already be null: a "playToEnd" arriving in this
  // mid-load window has nothing to match and is dropped by the completion guard.
  assert.equal(refs.loadedVideoId.current, null);

  swap.resolve();
  await p;
  assert.equal(refs.loadedVideoId.current, "v1");
});

// ---- the core race: an out-of-order resolution must not set the source -------

test("a load resolving AFTER a newer switch does not set the player source for the stale exercise", async () => {
  const refs = freshRefs();
  const swapA = deferred<void>();
  const replacedSources: (string | null)[] = [];
  let playedFor: string[] = [];

  // Load A (v1) starts and its source-swap hangs (a slow load).
  const pA = loadExerciseClip(refs, baseDeps({
    currentVideo: { id: "v1" },
    replaceAsync: async (src) => {
      replacedSources.push(src);
      await swapA.promise; // hangs until we release it
    },
    play: () => {
      playedFor.push("v1");
    },
  }));

  // Before A resolves, the user switches to exercise 2: load B (v2) starts and
  // completes immediately, bumping the token to 2 and recording v2.
  await loadExerciseClip(refs, baseDeps({
    currentVideo: { id: "v2" },
    replaceAsync: async (src) => {
      replacedSources.push(src);
    },
    play: () => {
      playedFor.push("v2");
    },
  }));

  assert.equal(refs.loadSeq.current, 2, "newer load owns the token");
  assert.equal(refs.loadedVideoId.current, "v2", "the current clip is v2");

  // NOW the stale load A finally resolves. Because the token has moved on, it
  // must bow out: it must NOT overwrite loadedVideoId back to v1 and must NOT
  // auto-play the stale clip.
  swapA.resolve();
  await pA;

  assert.equal(refs.loadedVideoId.current, "v2", "stale load did not clobber the current clip id");
  assert.deepEqual(playedFor, ["v2"], "the stale clip never auto-played");
});

test("a load found stale at the FIRST check (after the native probe) never swaps the source", async () => {
  const refs = freshRefs();
  const probeA = deferred<{ ok: boolean; status: number; url: string }>();
  const replacedSources: (string | null)[] = [];

  // Native load A: its probe hangs before the source swap.
  const pA = loadExerciseClip(refs, baseDeps({
    currentVideo: { id: "v1" },
    isWeb: false,
    probe: () => probeA.promise,
    replaceAsync: async (src) => {
      replacedSources.push(src);
    },
  }));

  // A newer load B (v2) lands first (synchronous on web), owning token 2.
  await loadExerciseClip(refs, baseDeps({
    currentVideo: { id: "v2" },
    replaceAsync: async (src) => {
      replacedSources.push(src);
    },
  }));

  // A's probe now resolves, but the token has moved on: A must abort BEFORE
  // calling replaceAsync, so v1's source is never swapped in.
  probeA.resolve({ ok: true, status: 206, url: "https://cdn/v1.mp4" });
  await pA;

  assert.deepEqual(replacedSources, ["https://cdn/v2.mp4"], "only the current clip's source was set");
  assert.equal(refs.loadedVideoId.current, "v2");
});

test("a failed native probe leaves loadedVideoId null (header image fallback) without throwing", async () => {
  const refs = freshRefs();
  let swapped = 0;
  await loadExerciseClip(refs, baseDeps({
    currentVideo: { id: "v1" },
    isWeb: false,
    probe: async () => ({ ok: false, status: 404, url: "" }),
    replaceAsync: async () => {
      swapped += 1;
    },
  }));
  assert.equal(swapped, 0, "a failed probe never swaps the source");
  assert.equal(refs.loadedVideoId.current, null, "no clip confirmed loaded on failure");
});

test("the native probe's redirected final URL is the one swapped into the player", async () => {
  const refs = freshRefs();
  const replaced: (string | null)[] = [];
  await loadExerciseClip(refs, baseDeps({
    currentVideo: { id: "v1" },
    isWeb: false,
    videoUrl: (id) => `https://cdn/${id}.mp4`,
    probe: async () => ({ ok: true, status: 206, url: "https://signed.cdn/v1?token=abc" }),
    replaceAsync: async (src) => {
      replaced.push(src);
    },
  }));
  assert.deepEqual(replaced, ["https://signed.cdn/v1?token=abc"]);
  assert.equal(refs.loadedVideoId.current, "v1");
});
