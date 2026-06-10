import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

// Tell React this is a valid environment for act() so effects flush
// synchronously and no "not configured to support act(...)" warnings are logged.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import TestRenderer, { act } from "react-test-renderer";

import {
  useStreakSyncCore,
  type StreakSyncDeps,
  type StreakSyncResult,
} from "@/hooks/useStreakSyncCore";
import {
  type StreakState,
  DEFAULT_STREAK_STATE,
  sanitizeStreakState,
  recordActiveDay,
  mergeWindow,
} from "@/lib/streak";

const TODAY = "2026-06-09";

// A controllable deferred so a test can assert state BEFORE a network promise
// resolves (e.g. that the local cache is shown before the server round-trip).
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Drains the chained microtasks the hook awaits (loadLocal -> loadPb ->
// fetchServer -> onReconciled, then the record path). A generous loop covers the
// whole chain; per the repo's RN-hook testing note we wrap it in act() so the
// trailing setState calls don't warn.
async function flush() {
  await act(async () => {
    for (let i = 0; i < 25; i++) await Promise.resolve();
  });
}

// An in-memory device "disk" + recording fakes for every injected dependency.
// fetchServer / pushActiveDay default to the happy path but each test can swap
// them. The fake server mirrors app/api/streak's reconciliation (recordActiveDay
// for the frontier + mergeWindow for the pushed offline window) so the device
// glue is exercised against realistic responses.
function makeEnv(opts?: {
  localStreak?: unknown;
  pb?: unknown;
  token?: string | null;
  ready?: boolean;
  serverStreak?: StreakState | null;
}) {
  const disk: { streak: unknown; pb: unknown } = {
    streak: opts?.localStreak ?? null,
    pb: opts?.pb ?? null,
  };
  const saves: StreakState[] = [];
  const pushes: { day: string; recentDays: string[] }[] = [];
  const reconciled: { state: StreakState; pbRaw: unknown }[] = [];
  let serverStreak: StreakState | null = opts?.serverStreak ?? null;
  let appStateHandler: ((state: string) => void) | null = null;

  let fetchServer = async () => serverStreak;
  // The fake server: records the pushed day onto its current streak, folds the
  // pushed offline window in, persists it, and returns it (what the device then
  // merges back). Mirrors the real endpoint closely enough to exercise the glue.
  let pushActiveDay: (day: string, recentDays: string[]) => Promise<StreakState | null> = async (
    day: string,
    recentDays: string[]
  ) => {
    pushes.push({ day, recentDays });
    const base = serverStreak ?? DEFAULT_STREAK_STATE;
    const advanced = recordActiveDay(base, day);
    const merged = mergeWindow(advanced, recentDays);
    serverStreak = merged;
    return merged;
  };

  const deps: StreakSyncDeps = {
    uid: "u1",
    token: opts?.token === undefined ? "tok" : opts.token,
    ready: opts?.ready ?? false,
    getToday: () => TODAY,
    loadLocal: async () => disk.streak,
    loadPb: async () => disk.pb,
    saveLocal: (s) => {
      disk.streak = s;
      saves.push(s);
    },
    fetchServer: () => fetchServer(),
    pushActiveDay: (day, recentDays) => pushActiveDay(day, recentDays),
    addAppStateListener: (handler) => {
      appStateHandler = handler;
      return { remove: () => {} };
    },
    onReconciled: (state, pbRaw) => reconciled.push({ state, pbRaw }),
  };

  return {
    deps,
    disk,
    saves,
    pushes,
    reconciled,
    setServerStreak(s: StreakState | null) {
      serverStreak = s;
    },
    setFetchServer(fn: () => Promise<StreakState | null>) {
      fetchServer = fn;
    },
    setPushActiveDay(fn: (day: string, recentDays: string[]) => Promise<StreakState | null>) {
      pushActiveDay = fn;
    },
    emitAppState(state: string) {
      if (!appStateHandler) throw new Error("no AppState listener was registered");
      act(() => appStateHandler!(state));
    },
  };
}

// Renders the hook inside a harness component and exposes its latest return.
function renderHook(deps: StreakSyncDeps) {
  const result: { current: StreakSyncResult } = { current: {} as StreakSyncResult };
  function Harness() {
    result.current = useStreakSyncCore(deps);
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Harness));
  });
  return {
    result,
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

// =========================================================================
// Hydrate: local-first, then reconcile against the server.
// =========================================================================

test("hydrates the local cache before the server round-trip, then merges the server", async () => {
  const local: StreakState = {
    count: 2,
    longest: 2,
    lastActiveDay: "2026-06-08",
    recentDays: ["2026-06-07", "2026-06-08"],
    updatedAt: 1,
  };
  const env = makeEnv({ localStreak: local, ready: false });

  // Pause the server fetch so we can observe the pre-network (local) state.
  const gate = deferred<StreakState | null>();
  env.setFetchServer(() => gate.promise);

  const { result } = renderHook(env.deps);
  await flush();

  // The displayed streak is the local cache while the server call is in flight.
  assert.equal(result.current.streakState.count, 2);
  assert.equal(result.current.streakState.lastActiveDay, "2026-06-08");

  // Server is the source of truth: a longer streak (restored window) wins.
  const server: StreakState = {
    count: 9,
    longest: 12,
    lastActiveDay: "2026-06-08",
    recentDays: ["2026-06-06", "2026-06-07", "2026-06-08"],
    updatedAt: 2,
  };
  await act(async () => {
    gate.resolve(server);
    await Promise.resolve();
  });
  await flush();

  assert.equal(result.current.streakState.count, 9);
  assert.equal(result.current.streakState.longest, 12);
  // The merged server state is written back to the device cache.
  assert.deepEqual(env.disk.streak, sanitizeStreakState(server));
  // onReconciled receives the server-resolved state (drives the pb baseline).
  assert.equal(env.reconciled.length, 1);
  assert.equal(env.reconciled[0].state.count, 9);
});

test("cross-device restore: empty local cache adopts the server count", async () => {
  // Fresh device: no local streak, but the account has a long server streak.
  const server: StreakState = {
    count: 10,
    longest: 10,
    lastActiveDay: TODAY,
    recentDays: [TODAY],
    updatedAt: 5,
  };
  const env = makeEnv({ localStreak: null, serverStreak: server, ready: false });

  const { result } = renderHook(env.deps);
  await flush();

  assert.equal(result.current.streakState.count, 10);
  assert.equal(result.current.streakState.lastActiveDay, TODAY);
  // Restored streak is cached locally for offline use.
  assert.deepEqual(env.disk.streak, sanitizeStreakState(server));
  assert.equal(env.reconciled[0].state.count, 10);
});

test("offline hydrate keeps the local cache when the server fetch throws", async () => {
  const local: StreakState = {
    count: 3,
    longest: 4,
    lastActiveDay: "2026-06-08",
    recentDays: ["2026-06-06", "2026-06-07", "2026-06-08"],
    updatedAt: 1,
  };
  const env = makeEnv({ localStreak: local, ready: false });
  env.setFetchServer(async () => {
    throw new Error("offline");
  });

  const { result } = renderHook(env.deps);
  await flush();

  // The local cache survives a failed reconcile, and the baseline still seeds
  // (onReconciled fires with the local state).
  assert.equal(result.current.streakState.count, 3);
  assert.equal(env.reconciled.length, 1);
  assert.equal(env.reconciled[0].state.count, 3);
});

// =========================================================================
// Record today: optimistic local write + window push + merge-back.
// =========================================================================

test("records today, sends the local window, and merges the server response", async () => {
  // A run ending yesterday; recording today should advance it.
  const local: StreakState = {
    count: 2,
    longest: 2,
    lastActiveDay: "2026-06-08",
    recentDays: ["2026-06-07", "2026-06-08"],
    updatedAt: 1,
  };
  // Server already knows the same run (so the POST advances it to 3).
  const server: StreakState = { ...local };
  const env = makeEnv({ localStreak: local, serverStreak: server, ready: true });

  const { result } = renderHook(env.deps);
  await flush();

  // Today's active day was recorded and pushed exactly once.
  assert.equal(env.pushes.length, 1);
  assert.equal(env.pushes[0].day, TODAY);
  // The pushed window carries the local rolling window (plus today, which the
  // optimistic local record added before the push read the cache back).
  assert.ok(env.pushes[0].recentDays.includes("2026-06-07"));
  assert.ok(env.pushes[0].recentDays.includes("2026-06-08"));
  assert.ok(env.pushes[0].recentDays.includes(TODAY));

  // The merged server response (count advanced to 3) is reflected and cached.
  assert.equal(result.current.streakState.count, 3);
  assert.equal(result.current.streakState.lastActiveDay, TODAY);
  assert.deepEqual(
    (env.disk.streak as StreakState).recentDays,
    result.current.streakState.recentDays
  );
});

test("offline-gap recovery: days recorded offline reconcile into the window on next sync", async () => {
  // The device recorded several days while offline, so its local window is ahead
  // of the server, which has no streak yet for these days (the offline pushes
  // never landed). On the next successful sync the device sends its accumulated
  // window up via the push so those days reconcile server-side; the GET returns
  // null here, so the local window is preserved into the record/push path.
  const local: StreakState = {
    count: 4,
    longest: 4,
    lastActiveDay: "2026-06-08",
    recentDays: ["2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08"],
    updatedAt: 1,
  };
  const env = makeEnv({ localStreak: local, serverStreak: null, ready: true });

  const { result } = renderHook(env.deps);
  await flush();

  // The whole offline window (plus today) was pushed up on the sync.
  assert.equal(env.pushes.length, 1);
  for (const d of ["2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08", TODAY]) {
    assert.ok(env.pushes[0].recentDays.includes(d), `window should include ${d}`);
  }
  // The reconciled state folds those offline days back into the window so the
  // pill row / live streak recover.
  for (const d of ["2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08", TODAY]) {
    assert.ok(
      result.current.streakState.recentDays.includes(d),
      `reconciled window should include ${d}`
    );
  }
});

test("cold start after offline use: a non-null server GET does not drop the offline days", async () => {
  // The member used the app offline for several days, then fully QUIT and
  // reopened it (a cold start, not a foreground resume). The device cache holds
  // the offline window, but the account already has a (now stale) server streak
  // from before the offline gap, so the hydrate GET returns a non-null streak.
  // It must fold the local window in rather than blindly overwriting the cache,
  // or those offline days are lost before the record/push can reconcile them up.
  const local: StreakState = {
    count: 5,
    longest: 5,
    lastActiveDay: "2026-06-08",
    recentDays: ["2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08"],
    updatedAt: 9,
  };
  // The server only knows the day before the offline gap began.
  const server: StreakState = {
    count: 1,
    longest: 5,
    lastActiveDay: "2026-06-03",
    recentDays: ["2026-06-03"],
    updatedAt: 2,
  };
  const env = makeEnv({ localStreak: local, serverStreak: server, ready: true });

  const { result } = renderHook(env.deps);
  await flush();

  // Every offline day survived the reconcile into the displayed window (plus
  // today), instead of being clobbered by the bare server response.
  for (const d of [
    "2026-06-04",
    "2026-06-05",
    "2026-06-06",
    "2026-06-07",
    "2026-06-08",
    TODAY,
  ]) {
    assert.ok(
      result.current.streakState.recentDays.includes(d),
      `reconciled window should keep offline day ${d}`
    );
  }
  // And those offline days were pushed up so the server reconciles them too.
  assert.equal(env.pushes.length, 1);
  for (const d of [
    "2026-06-04",
    "2026-06-05",
    "2026-06-06",
    "2026-06-07",
    "2026-06-08",
    TODAY,
  ]) {
    assert.ok(env.pushes[0].recentDays.includes(d), `push window should include ${d}`);
  }
  // The reconciled window is persisted back to the device cache.
  for (const d of ["2026-06-04", "2026-06-08", TODAY]) {
    assert.ok(
      (env.disk.streak as StreakState).recentDays.includes(d),
      `device cache should include ${d}`
    );
  }
});

test("a failed push keeps today in the local cache for the next retry", async () => {
  const local: StreakState = {
    count: 1,
    longest: 1,
    lastActiveDay: "2026-06-08",
    recentDays: ["2026-06-08"],
    updatedAt: 1,
  };
  const env = makeEnv({ localStreak: local, serverStreak: null, ready: true });
  env.setPushActiveDay(async () => {
    throw new Error("offline");
  });

  const { result } = renderHook(env.deps);
  await flush();

  // Optimistic local record still holds today even though the push failed.
  assert.equal(result.current.streakState.lastActiveDay, TODAY);
  assert.ok(result.current.streakState.recentDays.includes(TODAY));
  assert.ok((env.disk.streak as StreakState).recentDays.includes(TODAY));
});

test("recording is idempotent: a day already recorded does not push again", async () => {
  // Local cache already has today recorded.
  const local: StreakState = {
    count: 1,
    longest: 1,
    lastActiveDay: TODAY,
    recentDays: [TODAY],
    updatedAt: 1,
  };
  const server: StreakState = { ...local };
  const env = makeEnv({ localStreak: local, serverStreak: server, ready: true });

  const { result } = renderHook(env.deps);
  await flush();

  // No POST: today is already the frontier and in the window.
  assert.equal(env.pushes.length, 0);
  assert.equal(result.current.streakState.lastActiveDay, TODAY);

  // An explicit re-record is still a no-op.
  await act(async () => {
    await result.current.recordActiveDayNow();
  });
  await flush();
  assert.equal(env.pushes.length, 0);
});

// =========================================================================
// Local-only mode (no session): no GET / POST, but the cache still updates.
// =========================================================================

test("without a token the hook stays local-only (no server calls) but records today", async () => {
  const local: StreakState = {
    count: 1,
    longest: 1,
    lastActiveDay: "2026-06-08",
    recentDays: ["2026-06-08"],
    updatedAt: 1,
  };
  let fetched = false;
  const env = makeEnv({ localStreak: local, token: null, ready: true });
  env.setFetchServer(async () => {
    fetched = true;
    return null;
  });

  const { result } = renderHook(env.deps);
  await flush();

  assert.equal(fetched, false);
  assert.equal(env.pushes.length, 0);
  // Today is still recorded into the local cache and reflected in state.
  assert.equal(result.current.streakState.lastActiveDay, TODAY);
  assert.ok((env.disk.streak as StreakState).recentDays.includes(TODAY));
  // The baseline still seeds in offline / no-session mode.
  assert.equal(env.reconciled.length, 1);
});

// =========================================================================
// Logout: a null uid resets the displayed streak.
// =========================================================================

test("a null uid resets to the default streak", async () => {
  const env = makeEnv({ ready: false });
  (env.deps as any).uid = null;

  const { result } = renderHook(env.deps);
  await flush();

  assert.deepEqual(result.current.streakState, DEFAULT_STREAK_STATE);
  assert.equal(env.pushes.length, 0);
});
