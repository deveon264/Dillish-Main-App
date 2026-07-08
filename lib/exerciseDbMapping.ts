// Mapping layer between the open-source exercise dataset
// (github.com/yuhonas/free-exercise-db, Unlicense / public domain) and this
// app's vocabulary (lib/profile.ts enums). Used by the import script
// (scripts/import-exercise-db.mts) to generate constants/exerciseDb.ts, and by
// tests. React-native-free.

import type { BodyFocusId, EquipmentId, FitnessLevel } from "@/lib/profile";

// Shape of one record in free-exercise-db's dist/exercises.json.
export type RawDbExercise = {
  id: string;
  name: string;
  force?: string | null;
  level: string;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images?: string[];
};

// Our internal exercise-database record.
export type DbExercise = {
  id: string;
  name: string;
  instructions: string[];
  muscleGroups: BodyFocusId[];
  equipment: EquipmentId[];
  level: FitnessLevel;
  category: string;
  tags: string[];
};

const MUSCLE_MAP: Record<string, BodyFocusId> = {
  abdominals: "core_abs",
  glutes: "glutes",
  quadriceps: "legs",
  hamstrings: "legs",
  calves: "legs",
  adductors: "legs",
  abductors: "legs",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  chest: "upper_body",
  shoulders: "upper_body",
  traps: "upper_body",
  lats: "back_posture",
  "middle back": "back_posture",
  "lower back": "back_posture",
  neck: "back_posture",
};

// null means "not representable in the app's equipment vocabulary" and the
// exercise is skipped by the importer. "body only" maps to the empty list,
// which the app already treats as bodyweight-only.
const EQUIPMENT_MAP: Record<string, EquipmentId[] | null> = {
  "body only": [],
  "": [],
  dumbbell: ["dumbbells"],
  bands: ["resistance_bands"],
  "exercise ball": ["pilates_equipment"],
  "medicine ball": ["pilates_equipment"],
  kettlebells: ["gym_equipment"],
  barbell: ["gym_equipment"],
  cable: ["gym_equipment"],
  machine: ["gym_equipment"],
  "e-z curl bar": ["gym_equipment"],
  "foam roll": null,
  other: null,
};

const LEVEL_MAP: Record<string, FitnessLevel> = {
  beginner: "beginner",
  intermediate: "intermediate",
  expert: "advanced",
};

const KEPT_CATEGORIES = new Set(["strength", "stretching", "cardio", "plyometrics"]);

export function mapMuscle(muscle: string): BodyFocusId | null {
  return MUSCLE_MAP[muscle.toLowerCase()] ?? null;
}

export function mapEquipment(equipment: string | null | undefined): EquipmentId[] | null {
  return EQUIPMENT_MAP[(equipment ?? "").toLowerCase()] ?? null;
}

export function mapLevel(level: string): FitnessLevel | null {
  return LEVEL_MAP[level.toLowerCase()] ?? null;
}

export function keepCategory(category: string): boolean {
  return KEPT_CATEGORIES.has(category.toLowerCase());
}

// Converts one raw record to our shape, or null when the record is outside
// what the app can represent or recommend (unmappable equipment, dropped
// category, unknown level, no usable instructions).
export function toDbExercise(raw: RawDbExercise): DbExercise | null {
  if (!keepCategory(raw.category)) return null;
  const equipment = mapEquipment(raw.equipment);
  if (equipment === null) return null;
  const level = mapLevel(raw.level);
  if (!level) return null;
  const instructions = (raw.instructions ?? []).map((s) => s.trim()).filter(Boolean);
  if (instructions.length === 0) return null;

  const muscleGroups = [...new Set(raw.primaryMuscles.map(mapMuscle).filter((m): m is BodyFocusId => m !== null))];
  if (muscleGroups.length === 0) return null;

  const tags: string[] = [];
  if (raw.force) tags.push(`force:${raw.force}`);
  if (raw.mechanic) tags.push(`mechanic:${raw.mechanic}`);
  for (const m of raw.secondaryMuscles ?? []) {
    const mapped = mapMuscle(m);
    if (mapped) tags.push(`secondary:${mapped}`);
  }

  return {
    id: raw.id,
    name: raw.name,
    instructions,
    muscleGroups,
    equipment,
    level,
    category: raw.category.toLowerCase(),
    tags: [...new Set(tags)],
  };
}
