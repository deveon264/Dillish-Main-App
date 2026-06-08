import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

// Tell React this is a valid environment for act() so state updates are flushed
// synchronously and no "not configured to support act(...)" warnings are logged.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act } from "react-test-renderer";

import {
  useOptimisticAvatar,
  type OptimisticAvatar,
  type PrefetchFn,
} from "@/lib/useOptimisticAvatar";

// A tiny deferred so a test can hold a prefetch "in flight" and resolve it on
// demand, then observe the swap-back to the canonical URL.
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Props = {
  canonicalAvatar: string | null;
  userId: string | null | undefined;
  prefetch: PrefetchFn;
};

// Renders the hook (a function component returning null) and exposes its latest
// return value plus a setProps() to drive new inputs through act().
function renderHook(initial: Props) {
  const result: { current: OptimisticAvatar } = { current: null as any };

  function Harness(props: Props) {
    result.current = useOptimisticAvatar(
      props.canonicalAvatar,
      props.userId,
      props.prefetch
    );
    return null;
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Harness, initial));
  });

  return {
    result,
    setProps(next: Props) {
      act(() => {
        renderer.update(createElement(Harness, next));
      });
    },
    unmount() {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

// Lets pending microtasks (the awaited prefetch + setState) flush inside act().
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const CANON = "https://app.example/api/avatar?id=u1&v=obj-1";
const NEW_CANON = "https://app.example/api/avatar?id=u1&v=obj-2";
const PICKED = "file:///tmp/picked.jpg";

// =========================================================================
// Instant preview the moment the image is picked (before the upload finishes)
// =========================================================================

test("shows the locally-picked URI immediately when picked, before the upload finishes", async () => {
  // prefetch stays pending so the preview is NOT swapped away yet.
  const gate = deferred();
  const prefetch: PrefetchFn = () => gate.promise;

  const { result } = renderHook({
    canonicalAvatar: CANON,
    userId: "u1",
    prefetch,
  });

  // Before any pick, the canonical URL is shown.
  assert.equal(result.current.avatarSource, CANON);

  // Picking shows the local image instantly (no await on the upload).
  act(() => result.current.showPicked(PICKED));
  assert.equal(result.current.avatarSource, PICKED);

  gate.resolve();
  await flush();
});

// =========================================================================
// While the upload is in flight (canonical unchanged) the preview is held and
// the previous canonical photo is NOT prefetched/flashed back.
// =========================================================================

test("holds the preview while the upload is in flight (canonical unchanged)", async () => {
  const prefetched: string[] = [];
  const prefetch: PrefetchFn = (url) => {
    prefetched.push(url);
    return Promise.resolve();
  };

  const { result } = renderHook({
    canonicalAvatar: CANON,
    userId: "u1",
    prefetch,
  });

  // Picked before the upload completes: canonical is still the previous URL.
  act(() => result.current.showPicked(PICKED));
  await flush();

  // The previous canonical URL must NOT be warmed, and the preview is kept so
  // the new photo doesn't flash back to the old one mid-upload.
  assert.deepEqual(prefetched, []);
  assert.equal(result.current.avatarSource, PICKED);
});

// =========================================================================
// Warm-and-swap: once the upload yields a new canonical URL it is prefetched,
// then the preview is cleared.
// =========================================================================

test("prefetches the new canonical URL and clears the preview once warm", async () => {
  const prefetched: string[] = [];
  const gate = deferred();
  const prefetch: PrefetchFn = (url) => {
    prefetched.push(url);
    return gate.promise;
  };

  const { result, setProps } = renderHook({
    canonicalAvatar: CANON,
    userId: "u1",
    prefetch,
  });

  act(() => result.current.showPicked(PICKED));
  assert.equal(result.current.avatarSource, PICKED);
  // Nothing is warmed yet: the canonical URL is still the previous one.
  assert.deepEqual(prefetched, []);

  // The upload completes and the canonical URL updates to the new object.
  setProps({ canonicalAvatar: NEW_CANON, userId: "u1", prefetch });

  // The new canonical URL is warmed in the background...
  assert.deepEqual(prefetched, [NEW_CANON]);
  // ...and while it is still warming the preview is retained.
  assert.equal(result.current.avatarSource, PICKED);

  // Once the prefetch resolves, the preview is dropped and the canonical URL
  // takes over.
  gate.resolve();
  await flush();
  assert.equal(result.current.avatarSource, NEW_CANON);
});

test("still swaps to the new canonical URL even if prefetch rejects", async () => {
  const gate = deferred();
  const prefetch: PrefetchFn = () => gate.promise;

  const { result, setProps } = renderHook({
    canonicalAvatar: CANON,
    userId: "u1",
    prefetch,
  });

  act(() => result.current.showPicked(PICKED));
  assert.equal(result.current.avatarSource, PICKED);

  setProps({ canonicalAvatar: NEW_CANON, userId: "u1", prefetch });

  gate.reject(new Error("network down"));
  await flush();
  // Warming failed but the displayed image still becomes the new canonical URL
  // so it stays consistent with other screens.
  assert.equal(result.current.avatarSource, NEW_CANON);
});

// =========================================================================
// Failed upload: clearPicked reverts the preview to the previous canonical photo
// =========================================================================

test("clearPicked on a failed upload reverts to the previous canonical photo", async () => {
  const prefetch: PrefetchFn = () => Promise.resolve();

  const { result } = renderHook({
    canonicalAvatar: CANON,
    userId: "u1",
    prefetch,
  });

  act(() => result.current.showPicked(PICKED));
  assert.equal(result.current.avatarSource, PICKED);

  // Upload failed: the preview is dropped and the previous canonical photo
  // (still unchanged) is shown again.
  act(() => result.current.clearPicked());
  assert.equal(result.current.avatarSource, CANON);
});

// =========================================================================
// Remove clears the preview (fallback to initials)
// =========================================================================

test("clearPicked drops the preview, falling back to the canonical/initials source", async () => {
  // No canonical photo: the source is null so the UI renders initials.
  const prefetch: PrefetchFn = () => Promise.resolve();

  const { result } = renderHook({
    canonicalAvatar: null,
    userId: "u1",
    prefetch,
  });

  act(() => result.current.showPicked(PICKED));
  assert.equal(result.current.avatarSource, PICKED);

  // Removing the photo clears the preview at once; with no canonical URL the
  // source is null (initials).
  act(() => result.current.clearPicked());
  assert.equal(result.current.avatarSource, null);
});

// =========================================================================
// User switch never carries a preview across accounts
// =========================================================================

test("clears the preview when the signed-in user id changes", async () => {
  // prefetch pending so the preview would otherwise persist.
  const gate = deferred();
  const prefetch: PrefetchFn = () => gate.promise;

  const NEXT_CANON = "https://app.example/api/avatar?id=u2&v=obj-9";

  const { result, setProps } = renderHook({
    canonicalAvatar: CANON,
    userId: "u1",
    prefetch,
  });

  act(() => result.current.showPicked(PICKED));
  assert.equal(result.current.avatarSource, PICKED);

  // A different account signs in: the optimistic preview must NOT carry over.
  setProps({ canonicalAvatar: NEXT_CANON, userId: "u2", prefetch });
  assert.equal(result.current.avatarSource, NEXT_CANON);

  gate.resolve();
  await flush();
});
