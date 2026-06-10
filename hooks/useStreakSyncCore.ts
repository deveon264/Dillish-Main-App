import { useCallback, useEffect, useRef, useState } from "react";

import {
  type StreakState,
  type PbCelebration,
  DEFAULT_STREAK_STATE,
  sanitizeStreakState,
  recordActiveDay,
  mergeWindow,
} from "@/lib/streak";

// Device-side glue that ties the AsyncStorage streak cache to the server streak
// (GET/POST /api/streak). Every native dependency is injected as a function so
// this hook imports ONLY `react` + the (react-native-free) streak helpers and
// stays importable under the node:test + tsx suite. The thin caller in
// contexts/DataContext supplies the real fetch / storage / AppState wiring.
//
// The contract it implements (the part with real correctness risk):
//  - Hydrate the device-local cache FIRST so the streak shows instantly and the
//    app works offline, THEN reconcile against the server (the source of truth),
//    so a fresh device / reinstall restores a streak longer than the local
//    rolling window.
//  - Record today as an active day optimistically (local cache + UI), then push
//    today plus the local rolling window to the server so any days recorded
//    offline reconcile on the next successful sync. A failed push keeps the day
//    locally; the next hydrate / foreground retries.
export type StreakSyncDeps = {
  // The signed-in user id, or null when logged out (resets to the default).
  uid: string | null;
  // The session token, or null when there is no authenticated session. When
  // null the hook stays in local-only mode (no GET / POST). Included in the
  // hydrate effect's deps so a re-login (new token, same uid) re-reconciles.
  token: string | null;
  // Whether the rest of the app data has hydrated. Today's active day is only
  // recorded once ready, mirroring the original effect gating.
  ready: boolean;
  // Today's local day key ("YYYY-MM-DD"). Injected as a getter (not a constant)
  // so the foreground-on-a-new-day path can be driven, and so tests stay
  // independent of the wall clock / timezone.
  getToday: () => string;
  // Reads the raw (unsanitized) device-local streak blob for the current uid.
  loadLocal: () => Promise<unknown>;
  // Reads the raw device-local personal-best-celebration blob. The hook does not
  // own that state; it loads it alongside the streak so `onReconciled` can seed
  // the baseline atomically against the server-resolved streak.
  loadPb: () => Promise<unknown>;
  // Writes the device-local streak cache.
  saveLocal: (state: StreakState) => void;
  // Fetches the server streak (GET). Returns the raw blob, or null when the
  // account has no server streak yet. Throwing means offline / transient.
  fetchServer: () => Promise<StreakState | null>;
  // Pushes today plus the local rolling window (POST) and returns the server's
  // saved streak, or null when there was no usable response.
  pushActiveDay: (day: string, recentDays: string[]) => Promise<StreakState | null>;
  // Subscribe to AppState "change" events (foreground re-record on a new day);
  // returns a remover.
  addAppStateListener: (
    handler: (state: string) => void
  ) => { remove: () => void };
  // Fired once after each hydrate's server reconcile settles, with the resolved
  // streak and the raw loaded pb blob, so the caller can seed the personal-best
  // baseline against the same server-resolved `longest` the original code used.
  onReconciled?: (state: StreakState, pbRaw: unknown) => void;
};

export type StreakSyncResult = {
  streakState: StreakState;
  // Exposed mainly for tests / callers that want to force a record; the hook
  // already invokes it on hydrate and on a new-day foreground.
  recordActiveDayNow: () => Promise<void>;
};

export function useStreakSyncCore(deps: StreakSyncDeps): StreakSyncResult {
  const {
    uid,
    token,
    ready,
    getToday,
    loadLocal,
    loadPb,
    saveLocal,
    fetchServer,
    pushActiveDay,
    addAppStateListener,
    onReconciled,
  } = deps;

  const [streakState, setStreakState] = useState<StreakState>(DEFAULT_STREAK_STATE);
  // Mirrors the latest streak so the record callback can read the current value
  // synchronously (a memoized callback would otherwise close over a stale
  // snapshot). Kept in sync on every render and on each optimistic write.
  const streakStateRef = useRef<StreakState>(streakState);
  streakStateRef.current = streakState;
  // Flips true only after this hook's own hydrate+reconcile settles. The record
  // effect gates on it (in addition to the caller's `ready`) so today is never
  // recorded against a pre-reconcile streak: the original single-effect code
  // implicitly guaranteed this by setting `ready` only after the streak GET.
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the local cache first, then reconcile against the server. Re-runs on
  // a uid / token change (logout resets, re-login re-reconciles).
  useEffect(() => {
    let active = true;
    setHydrated(false);
    (async () => {
      if (!uid) {
        setStreakState(DEFAULT_STREAK_STATE);
        return;
      }
      // Local-first: show the cached streak before any network round-trip.
      const localRaw = await loadLocal();
      if (!active) return;
      const localStreak = sanitizeStreakState(localRaw);
      let finalStreak = localStreak;
      setStreakState(finalStreak);

      // Loaded alongside the streak so the baseline can be seeded atomically
      // against the reconciled streak in onReconciled (avoids a fresh-device
      // race where the baseline would seed below the restored server best).
      const pbRaw = await loadPb();
      if (!active) return;

      if (token) {
        try {
          const server = await fetchServer();
          if (!active) return;
          if (server) {
            // The server is the source of truth for the persisted count, but the
            // local cache may hold active days recorded offline that the server
            // has not seen yet. A cold start (full quit + reopen) used to blindly
            // overwrite the local cache with the bare server response, dropping
            // those offline days before the record/push below could reconcile
            // them up. Fold the local rolling window into the server response so
            // the union of both windows wins: the offline days survive into the
            // cache, the live union streak recovers, and the next push carries
            // them to the server.
            const merged = mergeWindow(sanitizeStreakState(server), localStreak.recentDays);
            // The server is authoritative for the persisted count/frontier, but
            // the local cache can hold a higher personal best the stale server
            // has not caught up to (e.g. an offline run that pushed the best up
            // never landed before the cold start). A personal best must never
            // decrease on reconcile, so keep the larger `longest` rather than
            // adopting the bare server value: otherwise the "new personal best"
            // baseline/celebration would silently re-baseline down over time.
            const bestLongest = Math.max(merged.longest, localStreak.longest);
            const sane =
              bestLongest > merged.longest ? { ...merged, longest: bestLongest } : merged;
            finalStreak = sane;
            setStreakState(sane);
            saveLocal(sane);
          }
          // No server streak yet: the record effect below creates it by POSTing
          // today, so there is nothing to push up here.
        } catch {
          // offline / transient: keep the local cache.
        }
      }
      if (!active) return;
      onReconciled?.(finalStreak, pbRaw);
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, token]);

  // Records today as an active day. De-duped: a day already recorded is a no-op
  // (no state change, no network call). Updates the local cache optimistically,
  // then writes through to the server, sending the local window so offline days
  // reconcile on this sync. On failure the local cache holds the day.
  const recordActiveDayNow = useCallback(async () => {
    if (!uid) return;
    const todayK = getToday();
    const prev = streakStateRef.current;
    // De-dupe: today already on the frontier and in the window is a no-op.
    if (prev.lastActiveDay === todayK && prev.recentDays.includes(todayK)) return;
    const next = recordActiveDay(prev, todayK);
    streakStateRef.current = next;
    setStreakState(next);
    saveLocal(next);
    if (!token) return;
    try {
      const localRaw = await loadLocal();
      const recentDays = sanitizeStreakState(localRaw).recentDays;
      const saved = await pushActiveDay(todayK, recentDays);
      if (saved) {
        const sane = sanitizeStreakState(saved);
        streakStateRef.current = sane;
        setStreakState(sane);
        saveLocal(sane);
      }
    } catch {
      // offline / transient: the local cache already holds today; the next
      // successful sync (hydrate or foreground) reconciles it to the server.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, token]);

  // Record today on every hydrate (fresh login, signup, restored session) and
  // again whenever the app returns to the foreground on a NEW day, so a streak
  // survives across days the app is simply left open.
  const lastForegroundDay = useRef<string>(getToday());
  useEffect(() => {
    if (!uid || !ready || !hydrated) return;
    recordActiveDayNow();
    lastForegroundDay.current = getToday();
    const sub = addAppStateListener((state) => {
      if (state !== "active") return;
      const now = getToday();
      if (now !== lastForegroundDay.current) {
        lastForegroundDay.current = now;
        recordActiveDayNow();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, ready, hydrated, recordActiveDayNow]);

  return { streakState, recordActiveDayNow };
}

// Re-exported for callers that pass typed deps.
export type { StreakState, PbCelebration };
