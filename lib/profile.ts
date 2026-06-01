// Canonical profile-metric shape shared by the client (contexts/DataContext)
// and the server (lib/userStore, app/api/profile). Kept free of any
// react-native imports so it is safe to import from both the app and the
// Metro-Node API routes. The server is the source of truth for these values;
// the device only keeps an offline cache.

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
    p.goalWeight === d.goalWeight
  );
}
