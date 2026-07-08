// Canonical profile-metric shape shared by the client (contexts/DataContext)
// and the server (lib/userStore, app/api/profile). Kept free of any
// react-native imports so it is safe to import from both the app and the
// Metro-Node API routes. The server is the source of truth for these values;
// the device only keeps an offline cache.

export type NotificationPrefs = {
  workout: boolean;
  hydration: boolean;
  streak: boolean;
  content: boolean;
  weekly: boolean;
};

// Fitness-personalization vocabulary. Goal ids intentionally match the values
// the goal screen has always stored ("lose-weight", "tone", ...) so existing
// saved profiles keep working.
export const GOAL_IDS = [
  "lose-weight",
  "tone",
  "strength",
  "flexibility",
  "wellness",
  "energy",
] as const;
export type GoalId = (typeof GOAL_IDS)[number];

export const FITNESS_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type FitnessLevel = (typeof FITNESS_LEVELS)[number];

export const EQUIPMENT_IDS = [
  "none",
  "dumbbells",
  "resistance_bands",
  "yoga_mat",
  "pilates_equipment",
  "gym_equipment",
] as const;
export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export const DURATION_PREFERENCES = ["10_15", "20_30", "30_45", "45_plus"] as const;
export type DurationPreference = (typeof DURATION_PREFERENCES)[number];

export const BODY_FOCUS_IDS = [
  "full_body",
  "core_abs",
  "glutes",
  "legs",
  "arms",
  "upper_body",
  "back_posture",
  "mobility",
] as const;
export type BodyFocusId = (typeof BODY_FOCUS_IDS)[number];

// "No limitations" is represented by an empty array, never stored as a value,
// so the list below is only real filters. Used for workout filtering only, not
// medical advice.
export const LIMITATION_IDS = [
  "knee_friendly",
  "back_friendly",
  "low_impact",
  "no_jumping",
  "postpartum_friendly",
] as const;
export type LimitationId = (typeof LIMITATION_IDS)[number];

export type Profile = {
  goals: string[];
  gender: "male" | "female" | "other";
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
  notifications: NotificationPrefs;
  restDays: string[];
  workoutReminderTime: string;
  // Fitness personalization. `fitnessLevel === null` means the fitness
  // questions were never answered (pre-personalization account); see
  // hasFitnessProfile(). `secondaryGoals` is never stored: it is always
  // derived as goals minus primaryGoal.
  primaryGoal: string | null;
  fitnessLevel: FitnessLevel | null;
  equipment: EquipmentId[];
  daysPerWeek: number | null;
  durationPreference: DurationPreference | null;
  bodyFocus: BodyFocusId[];
  limitations: LimitationId[];
  programId: string | null;
  programStartedAt: number | null;
};

export const NOTIFICATION_KEYS: (keyof NotificationPrefs)[] = [
  "workout",
  "hydration",
  "streak",
  "content",
  "weekly",
];

export const DEFAULT_PROFILE: Profile = {
  goals: [],
  gender: "other",
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
  notifications: {
    workout: true,
    hydration: true,
    streak: true,
    content: false,
    weekly: true,
  },
  restDays: [],
  workoutReminderTime: "07:00",
  primaryGoal: null,
  fitnessLevel: null,
  equipment: [],
  daysPerWeek: null,
  durationPreference: null,
  bodyFocus: [],
  limitations: [],
  programId: null,
  programStartedAt: null,
};

function has(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// Accepts a positive measurement (weight/height) within a generous bound, or
// null. Returns the fallback for anything malformed so bad input can't corrupt
// the stored profile.
function measurement(value: unknown, max: number, fallback: number | null): number | null {
  if (value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > max) return fallback;
  return n;
}

// Validates a (possibly partial) patch and returns ONLY the keys that carry a
// usable value, mirroring the validation the client screens already apply.
// Invalid/garbage values for a key are dropped (so a stored value is preserved
// rather than clobbered with a default); explicit `null` for a nullable field
// is kept. Used for the atomic JSONB merge in the PATCH endpoint and as the
// shared core of `sanitizeProfile`.
export function sanitizeProfilePatch(input: unknown): Partial<Profile> {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Partial<Profile> = {};

  if (has(src, "goals") && Array.isArray(src.goals)) {
    out.goals = src.goals
      .filter((g): g is string => typeof g === "string" && g.trim() !== "")
      .map((g) => g.trim())
      .slice(0, 12);
  }
  if (has(src, "gender") && (src.gender === "male" || src.gender === "female" || src.gender === "other")) {
    out.gender = src.gender;
  }
  // Nullable measurements: keep an explicit null, keep a valid number, drop
  // anything else.
  const nullableMeasurement = (key: keyof Profile, max: number) => {
    if (!has(src, key)) return;
    if (src[key] === null) {
      (out as any)[key] = null;
      return;
    }
    const v = measurement(src[key], max, null);
    if (v !== null) (out as any)[key] = v;
  };
  nullableMeasurement("age", 120);
  nullableMeasurement("weight", 1000);
  nullableMeasurement("height", 400);
  nullableMeasurement("startWeight", 1000);
  nullableMeasurement("goalWeight", 1000);

  if (has(src, "weightUnit") && (src.weightUnit === "kg" || src.weightUnit === "lbs")) {
    out.weightUnit = src.weightUnit;
  }
  if (has(src, "heightUnit") && (src.heightUnit === "cm" || src.heightUnit === "ft")) {
    out.heightUnit = src.heightUnit;
  }
  if (has(src, "activityLevel") && typeof src.activityLevel === "string" && src.activityLevel.trim()) {
    out.activityLevel = src.activityLevel.trim();
  }
  if (has(src, "bodyPreference") && typeof src.bodyPreference === "string" && src.bodyPreference.trim()) {
    out.bodyPreference = src.bodyPreference.trim();
  }
  if (has(src, "waterGoalMl")) {
    const n = Number(src.waterGoalMl);
    if (Number.isFinite(n)) out.waterGoalMl = Math.min(5000, Math.max(1000, Math.round(n)));
  }
  if (has(src, "calorieGoal")) {
    const n = Number(src.calorieGoal);
    if (Number.isFinite(n)) out.calorieGoal = Math.min(10000, Math.max(500, Math.round(n)));
  }
  if (has(src, "notifications") && src.notifications && typeof src.notifications === "object") {
    const raw = src.notifications as Record<string, unknown>;
    const prefs = { ...DEFAULT_PROFILE.notifications };
    for (const key of NOTIFICATION_KEYS) {
      if (has(raw, key)) prefs[key] = Boolean(raw[key]);
    }
    out.notifications = prefs;
  }
  if (has(src, "restDays") && Array.isArray(src.restDays)) {
    out.restDays = src.restDays
      .filter((d): d is string => typeof d === "string")
      .slice(0, 7);
  }
  if (has(src, "workoutReminderTime") && typeof src.workoutReminderTime === "string") {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(src.workoutReminderTime)) {
      out.workoutReminderTime = src.workoutReminderTime;
    }
  }

  // Fitness personalization fields. Enum members are kept, explicit nulls are
  // kept (they mean "answered: none / cleared"), anything else is dropped.
  const enumArray = <T extends string>(key: keyof Profile, allowed: readonly T[]) => {
    if (!has(src, key) || !Array.isArray(src[key])) return;
    const seen = new Set<T>();
    for (const v of src[key] as unknown[]) {
      if (typeof v === "string" && (allowed as readonly string[]).includes(v)) seen.add(v as T);
      if (seen.size >= 12) break;
    }
    (out as any)[key] = [...seen];
  };
  const nullableEnum = <T extends string>(key: keyof Profile, allowed: readonly T[]) => {
    if (!has(src, key)) return;
    if (src[key] === null) {
      (out as any)[key] = null;
      return;
    }
    if (typeof src[key] === "string" && (allowed as readonly string[]).includes(src[key] as string)) {
      (out as any)[key] = src[key];
    }
  };

  nullableEnum("primaryGoal", GOAL_IDS);
  nullableEnum("fitnessLevel", FITNESS_LEVELS);
  nullableEnum("durationPreference", DURATION_PREFERENCES);
  enumArray("equipment", EQUIPMENT_IDS);
  enumArray("bodyFocus", BODY_FOCUS_IDS);
  enumArray("limitations", LIMITATION_IDS);

  if (has(src, "daysPerWeek")) {
    if (src.daysPerWeek === null) {
      out.daysPerWeek = null;
    } else {
      const n = Number(src.daysPerWeek);
      if (Number.isFinite(n)) out.daysPerWeek = Math.min(6, Math.max(2, Math.round(n)));
    }
  }
  if (has(src, "programId")) {
    if (src.programId === null) {
      out.programId = null;
    } else if (typeof src.programId === "string" && src.programId.trim()) {
      out.programId = src.programId.trim();
    }
  }
  if (has(src, "programStartedAt")) {
    if (src.programStartedAt === null) {
      out.programStartedAt = null;
    } else {
      const n = Number(src.programStartedAt);
      if (Number.isFinite(n) && n > 0) out.programStartedAt = Math.round(n);
    }
  }

  return out;
}

// Merges a (possibly partial) patch over a base profile, dropping invalid
// fields, and returns a complete profile. Keys absent from `input` keep the
// base value, giving PATCH merge semantics. Also used on read to coerce a
// stored (possibly partial or legacy) blob into a full, sane profile.
export function sanitizeProfile(input: unknown, base: Profile = DEFAULT_PROFILE): Profile {
  return { ...base, ...sanitizeProfilePatch(input) };
}

// True when the profile carries no user-entered data, i.e. it is still the
// untouched default. Used to decide whether a local profile is worth pushing up
// to the server during one-time reconciliation.
export function isDefaultProfile(p: Profile): boolean {
  const d = DEFAULT_PROFILE;
  return (
    p.goals.length === 0 &&
    p.gender === d.gender &&
    p.age === d.age &&
    p.weight === d.weight &&
    p.weightUnit === d.weightUnit &&
    p.height === d.height &&
    p.heightUnit === d.heightUnit &&
    p.activityLevel === d.activityLevel &&
    p.bodyPreference === d.bodyPreference &&
    p.waterGoalMl === d.waterGoalMl &&
    p.calorieGoal === d.calorieGoal &&
    p.startWeight === d.startWeight &&
    p.goalWeight === d.goalWeight &&
    NOTIFICATION_KEYS.every((k) => p.notifications[k] === d.notifications[k]) &&
    p.restDays.length === 0 &&
    p.workoutReminderTime === d.workoutReminderTime &&
    p.primaryGoal === null &&
    p.fitnessLevel === null &&
    p.equipment.length === 0 &&
    p.daysPerWeek === null &&
    p.durationPreference === null &&
    p.bodyFocus.length === 0 &&
    p.limitations.length === 0 &&
    p.programId === null &&
    p.programStartedAt === null
  );
}

// True once the user has answered the fitness-personalization questions.
// Gates the personalized Home hero and library ranking; older accounts that
// finished the original 4-step onboarding return false and get the classic
// featured workout plus a personalize prompt.
export function hasFitnessProfile(p: Profile): boolean {
  return p.fitnessLevel !== null;
}

// Secondary goals are always derived, never stored, so they can't drift from
// the goals list when either field is edited alone.
export function secondaryGoalsOf(p: Profile): string[] {
  return p.goals.filter((g) => g !== p.primaryGoal);
}
