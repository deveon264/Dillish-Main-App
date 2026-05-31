import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { getJSON, setJSON, genId, todayKey } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";

export type Profile = {
  goals: string[];
  age: number | null;
  weight: number | null;
  weightUnit: "kg" | "lbs";
  height: number | null;
  heightUnit: "cm" | "ft";
  activityLevel: string;
  bodyPreference: string;
  waterGoalMl: number;
  calorieGoal: number;
  startWeight: number | null;
  goalWeight: number | null;
};

export type WaterLog = { id: string; amountMl: number; ts: number };
export type CalorieLog = {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  ts: number;
  photoUri?: string;
};
export type WorkoutCompletion = {
  id: string;
  workoutId: string;
  ts: number;
  kcal: number;
  durationMin: number;
};

export const DEFAULT_PROFILE: Profile = {
  goals: [],
  age: null,
  weight: null,
  weightUnit: "kg",
  height: null,
  heightUnit: "cm",
  activityLevel: "moderate",
  bodyPreference: "toned",
  waterGoalMl: 2500,
  calorieGoal: 1800,
  startWeight: null,
  goalWeight: null,
};

type DataContextType = {
  ready: boolean;
  profile: Profile;
  waterLogs: WaterLog[];
  calorieLogs: CalorieLog[];
  completions: WorkoutCompletion[];
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  addWater: (amountMl: number) => Promise<void>;
  removeWater: (id: string) => Promise<void>;
  addCalorie: (entry: Omit<CalorieLog, "id" | "ts">) => Promise<void>;
  deleteCalorie: (id: string) => Promise<void>;
  completeWorkout: (c: Omit<WorkoutCompletion, "id" | "ts">) => Promise<void>;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

const keyFor = (uid: string, slice: string) => `florish:u:${uid}:${slice}`;

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [calorieLogs, setCalorieLogs] = useState<CalorieLog[]>([]);
  const [completions, setCompletions] = useState<WorkoutCompletion[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!uid) {
        setProfile(DEFAULT_PROFILE);
        setWaterLogs([]);
        setCalorieLogs([]);
        setCompletions([]);
        setReady(false);
        return;
      }
      setReady(false);
      const [p, w, c, wk] = await Promise.all([
        getJSON<Profile>(keyFor(uid, "profile"), DEFAULT_PROFILE),
        getJSON<WaterLog[]>(keyFor(uid, "water"), []),
        getJSON<CalorieLog[]>(keyFor(uid, "calories"), []),
        getJSON<WorkoutCompletion[]>(keyFor(uid, "workouts"), []),
      ]);
      if (!active) return;
      setProfile({ ...DEFAULT_PROFILE, ...p });
      setWaterLogs(w);
      setCalorieLogs(c);
      setCompletions(wk);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [uid]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!uid) return;
      setProfile((prev) => {
        const next = { ...prev, ...patch };
        setJSON(keyFor(uid, "profile"), next);
        return next;
      });
    },
    [uid]
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

  const addCalorie = useCallback(
    async (entry: Omit<CalorieLog, "id" | "ts">) => {
      if (!uid) return;
      setCalorieLogs((prev) => {
        const next = [{ ...entry, id: genId(), ts: Date.now() }, ...prev];
        setJSON(keyFor(uid, "calories"), next);
        return next;
      });
    },
    [uid]
  );

  const deleteCalorie = useCallback(
    async (id: string) => {
      if (!uid) return;
      setCalorieLogs((prev) => {
        const next = prev.filter((l) => l.id !== id);
        setJSON(keyFor(uid, "calories"), next);
        return next;
      });
    },
    [uid]
  );

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
      calorieLogs,
      completions,
      updateProfile,
      addWater,
      removeWater,
      addCalorie,
      deleteCalorie,
      completeWorkout,
    }),
    [ready, profile, waterLogs, calorieLogs, completions, updateProfile, addWater, removeWater, addCalorie, deleteCalorie, completeWorkout]
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
