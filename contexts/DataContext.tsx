import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { getJSON, setJSON, genId, todayKey } from "@/lib/storage";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_PROFILE, isDefaultProfile, type Profile } from "@/lib/profile";

// Re-exported so existing importers (`@/contexts/DataContext`) keep working;
// the canonical definition lives in `@/lib/profile` (server-safe).
export type { Profile } from "@/lib/profile";
export { DEFAULT_PROFILE } from "@/lib/profile";

export type WaterLog = { id: string; amountMl: number; ts: number };
export type WeightLog = { id: string; weight: number; ts: number };
export type ProgressPhoto = { id: string; uri: string; ts: number; weight: number | null };
export type CalorieLog = {
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
export type WorkoutCompletion = {
  id: string;
  workoutId: string;
  ts: number;
  kcal: number;
  durationMin: number;
};

export type NotifTone = "accent" | "highlight" | "water" | "coach";
export type AppNotification = {
  id: string;
  icon: string;
  tone: NotifTone;
  title: string;
  body: string;
  ts: number;
  read: boolean;
};

function streakFromCompletions(completions: WorkoutCompletion[]): number {
  const days = new Set<string>();
  completions.forEach((c) => days.add(todayKey(new Date(c.ts))));
  let count = 0;
  const d = new Date();
  if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(todayKey(d))) {
    count += 1;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

// Notifications are derived from the member's real activity rather than being a
// static feed: hydration gaps, an unfinished workout, unlogged meals, and streak
// milestones. Each has a date-stable id so its read state persists for the day.
function buildNotifications(args: {
  waterLogs: WaterLog[];
  calorieLogs: CalorieLog[];
  completions: WorkoutCompletion[];
  profile: Profile;
}): Omit<AppNotification, "read">[] {
  const { waterLogs, calorieLogs, completions, profile } = args;
  const tk = todayKey();
  const now = Date.now();
  const out: Omit<AppNotification, "read">[] = [];

  const workoutToday = completions.some((c) => todayKey(new Date(c.ts)) === tk);
  const streak = streakFromCompletions(completions);

  if (!workoutToday) {
    out.push({
      id: `workout:${tk}`,
      icon: "barbell-outline",
      tone: "accent",
      title: "Today's workout is waiting",
      body:
        streak > 0
          ? `Keep your ${streak}-day streak alive — finish today's session.`
          : "Move your body today and start a new streak.",
      ts: now,
    });
  } else if ([3, 7, 14, 21, 30, 50, 100].includes(streak)) {
    out.push({
      id: `streak:${tk}`,
      icon: "flame-outline",
      tone: "highlight",
      title: `${streak}-day streak! 🔥`,
      body: "You showed up again today. Amazing consistency — keep it going.",
      ts: now,
    });
  }

  const todayWaterMl = waterLogs
    .filter((l) => todayKey(new Date(l.ts)) === tk)
    .reduce((s, l) => s + l.amountMl, 0);
  const waterGoalMl = profile.waterGoalMl > 0 ? profile.waterGoalMl : 2500;
  if (todayWaterMl < waterGoalMl) {
    const remL = ((waterGoalMl - todayWaterMl) / 1000).toFixed(1);
    out.push({
      id: `hydration:${tk}`,
      icon: "water-outline",
      tone: "water",
      title: "Time to hydrate",
      body: `You're ${remL} L away from today's water goal.`,
      ts: now - 1,
    });
  }

  const mealsToday = calorieLogs.filter((l) => todayKey(new Date(l.ts)) === tk).length;
  if (mealsToday === 0) {
    out.push({
      id: `meals:${tk}`,
      icon: "restaurant-outline",
      tone: "coach",
      title: "Log your meals",
      body: "Snap a photo of your food to keep your nutrition on track.",
      ts: now - 2,
    });
  }

  return out;
}

type DataContextType = {
  ready: boolean;
  profile: Profile;
  waterLogs: WaterLog[];
  weightLogs: WeightLog[];
  progressPhotos: ProgressPhoto[];
  calorieLogs: CalorieLog[];
  completions: WorkoutCompletion[];
  favorites: string[];
  toggleFavorite: (workoutId: string) => Promise<void>;
  isFavorite: (workoutId: string) => boolean;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  addWater: (amountMl: number) => Promise<void>;
  removeWater: (id: string) => Promise<void>;
  addWeight: (weight: number, ts?: number) => Promise<void>;
  removeWeight: (id: string) => Promise<void>;
  addPhoto: (uri: string, weight: number | null) => Promise<void>;
  removePhoto: (id: string) => Promise<void>;
  addCalorie: (entry: Omit<CalorieLog, "id" | "ts">) => Promise<void>;
  deleteCalorie: (id: string) => Promise<void>;
  completeWorkout: (c: Omit<WorkoutCompletion, "id" | "ts">) => Promise<void>;
  notifications: AppNotification[];
  unreadCount: number;
  markNotificationsRead: () => Promise<void>;
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
  const [notifReadIds, setNotifReadIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!uid) {
        setProfile(DEFAULT_PROFILE);
        setWaterLogs([]);
        setWeightLogs([]);
        setProgressPhotos([]);
        setCalorieLogs([]);
        setCompletions([]);
        setFavorites([]);
        setNotifReadIds([]);
        setReady(false);
        return;
      }
      setReady(false);
      const [p, w, wt, ph, c, wk, fav, nr] = await Promise.all([
        getJSON<Profile>(keyFor(uid, "profile"), DEFAULT_PROFILE),
        getJSON<WaterLog[]>(keyFor(uid, "water"), []),
        getJSON<WeightLog[]>(keyFor(uid, "weight"), []),
        getJSON<ProgressPhoto[]>(keyFor(uid, "photos"), []),
        getJSON<CalorieLog[]>(keyFor(uid, "calories"), []),
        getJSON<WorkoutCompletion[]>(keyFor(uid, "workouts"), []),
        getJSON<string[]>(keyFor(uid, "favorites"), []),
        getJSON<string[]>(keyFor(uid, "notifs_read"), []),
      ]);
      if (!active) return;

      // Hydrate the device-local-only slices immediately, before the (network-
      // bound) profile reconciliation below. Otherwise a meal/water/workout
      // logged while that fetch is in flight would be clobbered when this load
      // finally calls its setters with the stale snapshot read from disk.
      setWaterLogs(w);
      setProgressPhotos([...ph].sort((a, b) => b.ts - a.ts));
      setCalorieLogs(c);
      setCompletions(wk);
      setFavorites(fav);
      setNotifReadIds(nr);

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
            if (!active) return;
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
                if (!active) return;
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

      if (!active) return;
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
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [uid, token]);

  useEffect(() => {
    if (!uid || !ready || weightLogs.length > 0 || profile.weight == null) return;
    const seeded = seedWeightLogsFromProfile(profile);
    if (!seeded) return;
    setWeightLogs(seeded);
    setJSON(keyFor(uid, "weight"), seeded);
  }, [uid, ready, weightLogs.length, profile.weight, profile.startWeight]);

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
    async (uri: string, weight: number | null) => {
      if (!uid) return;
      const entry: ProgressPhoto = { id: genId(), uri, ts: Date.now(), weight };
      let nextArr: ProgressPhoto[] = [];
      setProgressPhotos((prev) => {
        nextArr = [entry, ...prev].sort((a, b) => b.ts - a.ts);
        return nextArr;
      });
      const ok = await setJSON(keyFor(uid, "photos"), nextArr);
      if (!ok) {
        setProgressPhotos((prev) => prev.filter((p) => p.id !== entry.id));
        throw new Error("Could not save photo — storage may be full.");
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
      if (!uid) return;
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
        throw new Error("Could not save meal — storage may be full.");
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

  const notifications = useMemo<AppNotification[]>(() => {
    const base = buildNotifications({ waterLogs, calorieLogs, completions, profile });
    return base.map((n) => ({ ...n, read: notifReadIds.includes(n.id) }));
  }, [waterLogs, calorieLogs, completions, profile, notifReadIds]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markNotificationsRead = useCallback(async () => {
    if (!uid) return;
    const ids = notifications.map((n) => n.id);
    setNotifReadIds(ids);
    setJSON(keyFor(uid, "notifs_read"), ids);
  }, [uid, notifications]);

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
      profile,
      waterLogs,
      weightLogs,
      progressPhotos,
      calorieLogs,
      completions,
      favorites,
      toggleFavorite,
      isFavorite,
      updateProfile,
      addWater,
      removeWater,
      addWeight,
      removeWeight,
      addPhoto,
      removePhoto,
      addCalorie,
      deleteCalorie,
      completeWorkout,
      notifications,
      unreadCount,
      markNotificationsRead,
    }),
    [ready, profile, waterLogs, weightLogs, progressPhotos, calorieLogs, completions, favorites, toggleFavorite, isFavorite, updateProfile, addWater, removeWater, addWeight, removeWeight, addPhoto, removePhoto, addCalorie, deleteCalorie, completeWorkout, notifications, unreadCount, markNotificationsRead]
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
