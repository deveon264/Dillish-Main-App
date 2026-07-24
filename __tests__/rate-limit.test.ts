import { test } from "node:test";
import assert from "node:assert/strict";

import { rateLimit, type RateLimitStore } from "@/lib/rateLimit";

// In-memory store mirroring the Postgres fixed-window upsert: a new window
// resets count to 1 with a fresh reset_at, otherwise it increments in place.
function memStore(): RateLimitStore {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return async (bucket, windowMs, now) => {
    const prev = buckets.get(bucket);
    const next =
      !prev || prev.resetAt <= now
        ? { count: 1, resetAt: now + windowMs }
        : { count: prev.count + 1, resetAt: prev.resetAt };
    buckets.set(bucket, next);
    return next;
  };
}

test("allows up to the limit, then blocks the next request", async () => {
  const store = memStore();
  const opts = { limit: 3, windowSec: 60 };
  for (let i = 1; i <= 3; i++) {
    const r = await rateLimit("k", opts, store);
    assert.equal(r.ok, true, `hit ${i} of 3 should pass`);
  }
  const blocked = await rateLimit("k", opts, store);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec > 0, "a blocked result reports Retry-After seconds");
});

test("separate buckets are counted independently", async () => {
  const store = memStore();
  const opts = { limit: 1, windowSec: 60 };
  assert.equal((await rateLimit("a", opts, store)).ok, true);
  assert.equal((await rateLimit("a", opts, store)).ok, false);
  assert.equal((await rateLimit("b", opts, store)).ok, true); // unaffected by "a"
});

test("a fresh window opens once reset_at has passed", async () => {
  // Exercise the fixed-window reset directly with a controllable clock (rateLimit
  // itself reads Date.now(), so drive the store to assert the reset semantics).
  const store = memStore();
  const w = 60_000;
  assert.equal((await store("k", w, 1_000)).count, 1); // window opens
  assert.equal((await store("k", w, 2_000)).count, 2); // same window
  assert.equal((await store("k", w, 61_001)).count, 1); // past reset_at -> new window
});

test("fails open when the store throws (never lock out real users)", async () => {
  const throwing: RateLimitStore = async () => {
    throw new Error("db down");
  };
  const r = await rateLimit("k", { limit: 1, windowSec: 60 }, throwing);
  assert.equal(r.ok, true);
});
