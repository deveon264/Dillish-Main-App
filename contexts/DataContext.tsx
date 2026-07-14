import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { getJSON, setJSON, genId, todayKey } from "@/lib/storage";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_PROFILE, isDefaultProfile, type Profile } from "@/lib/profile";
import {
  type StreakState,
  type PbCelebration,
  DEFAULT_STREAK_STATE,
  DEFAULT_PB_CELEBRATION,
  sanitizePbCelebration,
  combineDays,
  displayStreak,
  displayBest,
} from "@/lib/streak";
import { usePbCelebrationCore } from "@/hooks/usePbCelebrationCore";
import { useStreakSyncCore } from "@/hooks/useStreakSyncCore";
import {
  buildNotifications,
  applyReadState,
  type WaterLog,
  type CalorieLog,
  type WorkoutCompletion,
  type NotifTone,
  type AppNotification,
} from "@/lib/notifications";

// Re-exported so existing importers (`@/contexts/DataContext`) keep working;
// the canonical definition lives in `@/lib/profile` (server-safe).
export type { Profile } from "@/lib/profile";
export { DEFAULT_PROFILE } from "@/lib/profile";

// Re-exported so existing importers (`@/contexts/DataContext`) keep working;
// the canonical definitions (and the pure `buildNotifications` builder) live in
// `@/lib/notifications`, which stays react-native-free so it can be unit-tested.
export type { WaterLog, CalorieLog, WorkoutCompletion, NotifTone, AppNotification };

export type WeightLog = { id: string; weight: number; ts: number };
export type ProgressPhoto = { id: string; uri: string; ts: number; weight: number | null };

type DataContextType = {
  ready: boolean;
  // Re-syncs the local caches and server profile without blanking the UI. Wired
  // to the pull-to-refresh on the bottom-tab screens.
  reload: () => Promise<void>;
  profile: Profile;
  waterLogs: WaterLog[];
  weightLogs: WeightLog[];
  progressPhotos: ProgressPhoto[];
  calorieLogs: CalorieLog[];
  completions: WorkoutCompletion[];
  favorites: string[];
  toggleFavorite: (workoutId: string) => Promise<void>;
  isFavorite: (workoutId: string) => boolean;
  // Bookmarked recipes (separate slice from workout favorites so ids never mix).
  savedRecipes: string[];
  toggleSavedRecipe: (recipeId: string) => Promise<void>;
  isRecipeSaved: (recipeId: string) => boolean;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  addWater: (amountMl: number) => Promise<void>;
  removeWater: (id: string) => Promise<void>;
  addWeight: (weight: number, ts?: number) => Promise<void>;
  removeWeight: (id: string) => Promise<void>;
  addPhoto: (uri: string, weight: number | null, ts?: number) => Promise<void>;
  removePhoto: (id: string) => Promise<void>;
  addCalorie: (entry: Omit<CalorieLog, "id" | "ts">) => Promise<string>;
  updateCaloriePhoto: (id: string, uri: string) => Promise<void>;
  deleteCalorie: (id: string) => Promise<void>;
  completeWorkout: (c: Omit<WorkoutCompletion, "id" | "ts">) => Promise<void>;
  // The single streak number shown everywhere, plus the combined active-OR-
  // workout day set that drives the home / workout pill rows.
  streak: number;
  // Personal best: the longest streak the member has ever reached. Never below
  // the current `streak`.
  streakBest: number;
  // The value of a brand-new personal best reached today that has not yet been
  // celebrated on this device, or null when there is nothing to celebrate. Drives
  // both the streak notification and the workout-completion banner, so both read
  // the same de-duped record and never re-fire for an already-celebrated best.
  newBestToday: number | null;
  streakDays: Set<string>;
  notifications: AppNotification[];
  unreadCount: number;
  markNotificationsRead: () => Promise<void>;
  // One-time home-screen welcome popup. The thank-you video screen queues it as
  // it hands off to the dashboard; dismissing clears it for good. Device-local,
  // so existing members (who never pass through onboarding) never see it.
  welcomePending: boolean;
  queueWelcome: () => Promise<void>;
  dismissWelcome: () => Promise<void>;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

const keyFor = (uid: string, slice: string) => `florish:u:${uid}:${slice}`;

function seedWeightLogsFromProfile(profile: Profile): WeightLog[] | null {
  if (profile.weight == null) return null;
  const now = Date.now();
  const seeded: WeightLog[] = [{ id: genId(), weight: profile.weight, ts: now }];
  if (profile.startWeight != null && profile.startWeight !== profile.weight) {
    seeded.push({
      id: genId(),
      weight: profile.startWeight,
      ts: now - 28 * 24 * 60 * 60 * 1000,
    });
  }
  return seeded.sort((a, b) => b.ts - a.ts);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const uid = user?.id ?? null;

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [progressPhotos, setProgressPhotos] = useState<ProgressPhoto[]>([]);
  const [calorieLogs, setCalorieLogs] = useState<CalorieLog[]>([]);
  const [completions, setCompletions] = useState<WorkoutCompletion[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<string[]>([]);
  const [notifReadIds, setNotifReadIds] = useState<string[]>([]);
  const [welcomePending, setWelcomePending] = useState(false);
  // The streak slice is owned by useStreakSyncCore and the personal-best
  // celebration slice by usePbCelebrationCore (both below); neither is held
  // inline here anymore.

  // Monotonic token so a manual reload (pull-to-refresh) that races an unmount
  // or a re-login is ignored: each load bumps it and only applies its results
  // while it still holds the latest value. Replaces the old per-effect `active`
  // boolean so the loader can also be called on demand via `reload`.
  const loadSeqRef = useRef(0);
  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const seq = ++loadSeqRef.current;
      const isStale = () => seq !== loadSeqRef.current;
      if (!uid) {
        setProfile(DEFAULT_PROFILE);
        setWaterLogs([]);
        setWeightLogs([]);
        setProgressPhotos([]);
        setCalorieLogs([]);
        setCompletions([]);
        setFavorites([]);
        setSavedRecipes([]);
        setNotifReadIds([]);
        setWelcomePending(false);
        // useStreakSyncCore resets the streak on a null uid; clear the pb here.
        resetPb();
        setReady(false);
        return;
      }
      // A silent reload (pull-to-refresh) must NOT flip `ready` to false, or every
      // screen gated on `ready` would blank out mid-gesture. Only the initial
      // (non-silent) load gates the UI behind the loading state.
      if (!opts?.silent) setReady(false);
      const [p, w, wt, ph, c, wk, fav, sr, nr, wp] = await Promise.all([
        getJSON<Profile>(keyFor(uid, "profile"), DEFAULT_PROFILE),
        getJSON<WaterLog[]>(keyFor(uid, "water"), []),
        getJSON<WeightLog[]>(keyFor(uid, "weight"), []),
        getJSON<ProgressPhoto[]>(keyFor(uid, "photos"), []),
        getJSON<CalorieLog[]>(keyFor(uid, "calories"), []),
        getJSON<WorkoutCompletion[]>(keyFor(uid, "workouts"), []),
        getJSON<string[]>(keyFor(uid, "favorites"), []),
        getJSON<string[]>(keyFor(uid, "saved_recipes"), []),
        getJSON<string[]>(keyFor(uid, "notifs_read"), []),
        getJSON<boolean>(keyFor(uid, "welcome_pending"), false),
      ]);
      if (isStale()) return;

      // Hydrate the device-local-only slices immediately, before the (network-
      // bound) profile reconciliation below. Otherwise a meal/water/workout
      // logged while that fetch is in flight would be clobbered when this load
      // finally calls its setters with the stale snapshot read from disk.
      // The streak cache (device-local) and its server reconciliation are owned
      // by useStreakSyncCore below; it hydrates local-first on the same uid.
      setWaterLogs(w);
      setProgressPhotos([...ph].sort((a, b) => b.ts - a.ts));
      setCalorieLogs(c);
      setCompletions(wk);
      setFavorites(fav);
      setSavedRecipes(sr);
      setNotifReadIds(nr);
      setWelcomePending(wp);

      let mergedProfile = { ...DEFAULT_PROFILE, ...p };

      // The server is the source of truth for profile metrics so they survive a
      // changed account id or a cleared device. Fall back to the local cache on
      // any network/transient error so the app still works offline.
      if (token) {
        try {
          const resp = await fetch(`${getApiUrl()}/api/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const { profile: serverProfile } = (await resp.json()) as { profile: Profile | null };
            if (isStale()) return;
            if (serverProfile) {
              mergedProfile = { ...DEFAULT_PROFILE, ...serverProfile };
              setJSON(keyFor(uid, "profile"), mergedProfile);
            } else if (!isDefaultProfile(mergedProfile)) {
              // One-time reconciliation: the account has no server profile yet
              // but the device does — push the local values up so they aren't
              // lost on the next device/id change.
              const up = await fetch(`${getApiUrl()}/api/profile`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(mergedProfile),
              });
              if (up.ok) {
                const { profile: saved } = (await up.json()) as { profile: Profile | null };
                if (isStale()) return;
                if (saved) {
                  mergedProfile = { ...DEFAULT_PROFILE, ...saved };
                  setJSON(keyFor(uid, "profile"), mergedProfile);
                }
              }
            }
          }
        } catch {
          // offline / transient: keep the local cache.
        }
      }

      if (isStale()) return;
      // Profile (and weight, which can be seeded from it) is set last because it
      // depends on the server reconciliation above; the device-local slices were
      // already hydrated before that network call.
      setProfile(mergedProfile);

      let weightArr = [...wt].sort((a, b) => b.ts - a.ts);
      if (weightArr.length === 0) {
        const seeded = seedWeightLogsFromProfile(mergedProfile);
        if (seeded) {
          weightArr = seeded;
          setJSON(keyFor(uid, "weight"), weightArr);
        }
      }
      setWeightLogs(weightArr);

      // The personal-best celebration baseline is seeded once the streak hook
      // finishes reconciling (see onStreakReconciled), so it baselines against
      // the server-resolved `longest` and never congratulates an existing record
      // retroactively, while a record genuinely beaten today still fires. The
      // seed itself now runs in onStreakReconciled (fired by useStreakSyncCore
      // once its server reconcile settles), so there is nothing to do here.
      setReady(true);
    },
    [uid, token]
  );

  useEffect(() => {
    load();
    // Invalidate any in-flight load when uid/token changes or on unmount so its
    // stale results are dropped (isStale() short-circuits after this bump).
    return () => {
      loadSeqRef.current++;
    };
  }, [load]);

  // Public re-sync for pull-to-refresh: re-reads the local caches and re-pulls
  // the server profile without blanking the UI (silent = no `ready` flip).
  const reload = useCallback(() => load({ silent: true }), [load]);

  useEffect(() => {
    if (!uid || !ready || weightLogs.length > 0 || profile.weight == null) return;
    const seeded = seedWeightLogsFromProfile(profile);
    if (!seeded) return;
    setWeightLogs(seeded);
    setJSON(keyFor(uid, "weight"), seeded);
  }, [uid, ready, weightLogs.length, profile.weight, profile.startWeight]);

  // Seeds the personal-best celebration baseline once the streak hook finishes
  // reconciling against the server. Baselining at the server-resolved `longest`
  // (not the local cache) means a fresh-device restore never re-congratulates an
  // existing record, while a record genuinely beaten today still fires. The
  // actual seed is delegated to usePbCelebrationCore's hydratePb (defined
  // further below). Because that hook also depends on this streak's `best`,
  // there is a definition cycle: it is bridged with a ref, which is safe here
  // since onReconciled only ever fires async (after the hydrate settles, long
  // after both hooks have run and the ref has been populated).
  const hydratePbRef = useRef<(loaded: PbCelebration, baselineBest: number) => void>(
    () => {}
  );
  const onStreakReconciled = useCallback((state: StreakState, pbRaw: unknown) => {
    hydratePbRef.current(sanitizePbCelebration(pbRaw), state.longest);
  }, []);

  // The device-side streak sync: hydrate the local cache first, reconcile against
  // the server, record today optimistically, and push the local window so
  // offline days reconcile on the next sync. The native fetch / storage /
  // AppState wiring lives here; the testable logic lives in useStreakSyncCore.
  const { streakState } = useStreakSyncCore({
    uid,
    token,
    ready,
    getToday: todayKey,
    loadLocal: () => getJSON<StreakState>(keyFor(uid ?? "", "streak"), DEFAULT_STREAK_STATE),
    loadPb: () => getJSON<PbCelebration>(keyFor(uid ?? "", "streak_pb"), DEFAULT_PB_CELEBRATION),
    saveLocal: (s) => {
      if (uid) setJSON(keyFor(uid, "streak"), s);
    },
    fetchServer: async () => {
      const resp = await fetch(`${getApiUrl()}/api/streak`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return null;
      const { streak } = (await resp.json()) as { streak: StreakState | null };
      return streak;
    },
    pushActiveDay: async (day, recentDays) => {
      const resp = await fetch(`${getApiUrl()}/api/streak`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ day, recentDays }),
      });
      if (!resp.ok) return null;
      const { streak } = (await resp.json()) as { streak: StreakState };
      return streak;
    },
    addAppStateListener: (handler) => AppState.addEventListener("change", handler),
    onReconciled: onStreakReconciled,
  });

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!uid) return;
      // Optimistic local update + offline cache so the UI is instant and works
      // offline; the same patch is written through to the server below.
      setProfile((prev) => {
        const next = { ...prev, ...patch };
        setJSON(keyFor(uid, "profile"), next);
        return next;
      });
      if (token) {
        try {
          await fetch(`${getApiUrl()}/api/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(patch),
          });
          // The server clamps/sanitizes identically to the client screens, so
          // there's nothing to reconcile here; on failure the local cache holds
          // the value and the next save (or app launch) retries.
        } catch {
          // offline / transient: local cache already holds the change.
        }
      }
    },
    [uid, token]
  );

  const addWater = useCallback(
    async (amountMl: number) => {
      if (!uid) return;
      setWaterLogs((prev) => {
        const next = [{ id: genId(), amountMl, ts: Date.now() }, ...prev];
        setJSON(keyFor(uid, "water"), next);
        return next;
      });
    },
    [uid]
  );

  const removeWater = useCallback(
    async (id: string) => {
      if (!uid) return;
      setWaterLogs((prev) => {
        const next = prev.filter((l) => l.id !== id);
        setJSON(keyFor(uid, "water"), next);
        return next;
      });
    },
    [uid]
  );

  const addWeight = useCallback(
    async (weight: number, ts?: number) => {
      if (!uid) return;
      const entryTs = ts ?? Date.now();
      setWeightLogs((prev) => {
        const next = [{ id: genId(), weight, ts: entryTs }, ...prev].sort((a, b) => b.ts - a.ts);
        setJSON(keyFor(uid, "weight"), next);
        return next;
      });
    },
    [uid]
  );

  const removeWeight = useCallback(
    async (id: string) => {
      if (!uid) return;
      setWeightLogs((prev) => {
        const next = prev.filter((l) => l.id !== id);
        setJSON(keyFor(uid, "weight"), next);
        return next;
      });
    },
    [uid]
  );

  const addPhoto = useCallback(
    async (uri: string, weight: number | null, ts = Date.now()) => {
      if (!uid) return;
      const entry: ProgressPhoto = { id: genId(), uri, ts, weight };
      let nextArr: ProgressPhoto[] = [];
      setProgressPhotos((prev) => {
        nextArr = [entry, ...prev].sort((a, b) => b.ts - a.ts);
        return nextArr;
      });
      const ok = await setJSON(keyFor(uid, "photos"), nextArr);
      if (!ok) {
        setProgressPhotos((prev) => prev.filter((p) => p.id !== entry.id));
        throw new Error("Could not save photo. Storage may be full.");
      }
    },
    [uid]
  );

  const removePhoto = useCallback(
    async (id: string) => {
      if (!uid) return;
      setProgressPhotos((prev) => {
        const next = prev.filter((p) => p.id !== id);
        setJSON(keyFor(uid, "photos"), next);
        return next;
      });
    },
    [uid]
  );

  const addCalorie = useCallback(
    async (entry: Omit<CalorieLog, "id" | "ts">) => {
      if (!uid) throw new Error("Sign in to save a meal.");
      // Await the disk write before resolving so callers (e.g. the meal-log
      // save flow) know the entry is durably persisted — a fire-and-forget
      // write could be lost if the app is force-closed right after logging.
      const newEntry: CalorieLog = { ...entry, id: genId(), ts: Date.now() };
      let nextArr: CalorieLog[] = [];
      setCalorieLogs((prev) => {
        nextArr = [newEntry, ...prev];
        return nextArr;
      });
      const ok = await setJSON(keyFor(uid, "calories"), nextArr);
      if (!ok) {
        setCalorieLogs((prev) => prev.filter((l) => l.id !== newEntry.id));
        throw new Error("Could not save meal. Storage may be full.");
      }
      return newEntry.id;
    },
    [uid]
  );

  const updateCaloriePhoto = useCallback(
    async (id: string, uri: string) => {
      if (!uid) return;
      let previousUri: string | undefined;
      let nextArr: CalorieLog[] | null = null;
      setCalorieLogs((prev) => {
        const target = prev.find((log) => log.id === id);
        // A background re-host can finish after the member deletes the meal.
        // In that case there is deliberately nothing to update or persist.
        if (!target || target.photoUri === uri) return prev;
        previousUri = target.photoUri;
        nextArr = prev.map((log) => (log.id === id ? { ...log, photoUri: uri } : log));
        return nextArr;
      });
      if (!nextArr) return;
      const ok = await setJSON(keyFor(uid, "calories"), nextArr);
      if (!ok) {
        // Roll back only if this entry still has the photo written by this
        // operation. A later edit or deletion always wins.
        setCalorieLogs((prev) =>
          prev.map((log) =>
            log.id === id && log.photoUri === uri ? { ...log, photoUri: previousUri } : log
          )
        );
        throw new Error("Could not update meal photo.");
      }
    },
    [uid]
  );

  const deleteCalorie = useCallback(
    async (id: string) => {
      if (!uid) return;
      let nextArr: CalorieLog[] = [];
      setCalorieLogs((prev) => {
        nextArr = prev.filter((l) => l.id !== id);
        return nextArr;
      });
      await setJSON(keyFor(uid, "calories"), nextArr);
    },
    [uid]
  );

  const toggleFavorite = useCallback(
    async (workoutId: string) => {
      if (!uid) return;
      setFavorites((prev) => {
        const next = prev.includes(workoutId) ? prev.filter((id) => id !== workoutId) : [...prev, workoutId];
        setJSON(keyFor(uid, "favorites"), next);
        return next;
      });
    },
    [uid]
  );

  const isFavorite = useCallback((workoutId: string) => favorites.includes(workoutId), [favorites]);

  const toggleSavedRecipe = useCallback(
    async (recipeId: string) => {
      if (!uid) return;
      setSavedRecipes((prev) => {
        const next = prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId];
        setJSON(keyFor(uid, "saved_recipes"), next);
        return next;
      });
    },
    [uid]
  );

  const isRecipeSaved = useCallback((recipeId: string) => savedRecipes.includes(recipeId), [savedRecipes]);

  // The combined active-OR-workout day set and the single streak number, derived
  // once here so every screen (home card + pills, profile badge, workout
  // completion screen, and the streak notification) reads the same value. A day
  // counts when the member signed in / opened the app (active days, persisted)
  // OR completed a workout (device-local completions).
  const completionDayKeys = useMemo(
    () => completions.map((c) => todayKey(new Date(c.ts))),
    [completions]
  );
  const streakDays = useMemo(
    () => combineDays(streakState.recentDays, completionDayKeys),
    [streakState.recentDays, completionDayKeys]
  );
  const streak = useMemo(
    () => displayStreak(streakState, streakDays, todayKey()),
    [streakState, streakDays]
  );
  const streakBest = useMemo(
    () => displayBest(streakState, streak),
    [streakState, streak]
  );

  // Personal-best celebration lifecycle (baseline-once + stamp-on-new-record),
  // extracted into a deps-injectable hook so the orchestration can be unit
  // tested. `pbDeps` is memoized once so the hook's stamping effect doesn't
  // re-run every render; the helpers it closes over are module-stable. The
  // hydrate effect above calls `hydratePb` / `resetPb` (both defined here) after
  // their closures run post-commit.
  const pbDeps = useMemo(
    () => ({
      persist: (id: string, rec: PbCelebration) => setJSON(keyFor(id, "streak_pb"), rec),
      today: () => todayKey(),
    }),
    []
  );
  const { pbCelebration, newBestToday, hydratePb, resetPb } = usePbCelebrationCore({
    uid,
    ready,
    streakBest,
    deps: pbDeps,
  });
  // Bridge for onStreakReconciled (defined above), which seeds the pb baseline.
  hydratePbRef.current = hydratePb;

  const notifications = useMemo<AppNotification[]>(() => {
    const base = buildNotifications({ waterLogs, calorieLogs, completions, profile, streak, newBest: newBestToday });
    return applyReadState(base, notifReadIds);
  }, [waterLogs, calorieLogs, completions, profile, streak, newBestToday, notifReadIds]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markNotificationsRead = useCallback(async () => {
    if (!uid) return;
    const ids = notifications.map((n) => n.id);
    setNotifReadIds(ids);
    setJSON(keyFor(uid, "notifs_read"), ids);
  }, [uid, notifications]);

  const queueWelcome = useCallback(async () => {
    if (!uid) return;
    setWelcomePending(true);
    setJSON(keyFor(uid, "welcome_pending"), true);
  }, [uid]);

  const dismissWelcome = useCallback(async () => {
    if (!uid) return;
    setWelcomePending(false);
    setJSON(keyFor(uid, "welcome_pending"), false);
  }, [uid]);

  const completeWorkout = useCallback(
    async (c: Omit<WorkoutCompletion, "id" | "ts">) => {
      if (!uid) return;
      setCompletions((prev) => {
        const next = [{ ...c, id: genId(), ts: Date.now() }, ...prev];
        setJSON(keyFor(uid, "workouts"), next);
        return next;
      });
    },
    [uid]
  );

  const value = useMemo(
    () => ({
      ready,
      reload,
      profile,
      waterLogs,
      weightLogs,
      progressPhotos,
      calorieLogs,
      completions,
      favorites,
      toggleFavorite,
      isFavorite,
      savedRecipes,
      toggleSavedRecipe,
      isRecipeSaved,
      updateProfile,
      addWater,
      removeWater,
      addWeight,
      removeWeight,
      addPhoto,
      removePhoto,
      addCalorie,
      updateCaloriePhoto,
      deleteCalorie,
      completeWorkout,
      streak,
      streakBest,
      newBestToday,
      streakDays,
      notifications,
      unreadCount,
      markNotificationsRead,
      welcomePending,
      queueWelcome,
      dismissWelcome,
    }),
    [ready, reload, profile, waterLogs, weightLogs, progressPhotos, calorieLogs, completions, favorites, toggleFavorite, isFavorite, savedRecipes, toggleSavedRecipe, isRecipeSaved, updateProfile, addWater, removeWater, addWeight, removeWeight, addPhoto, removePhoto, addCalorie, updateCaloriePhoto, deleteCalorie, completeWorkout, streak, streakBest, newBestToday, streakDays, notifications, unreadCount, markNotificationsRead, welcomePending, queueWelcome, dismissWelcome]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

export function sumToday(logs: { ts: number; amountMl?: number }[]): number {
  const tk = todayKey();
  return logs.filter((l) => todayKey(new Date(l.ts)) === tk).reduce((s, l) => s + (l.amountMl ?? 0), 0);
}
