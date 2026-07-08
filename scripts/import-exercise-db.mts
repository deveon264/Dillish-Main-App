// Regenerates constants/exerciseDb.ts from the open-source exercise dataset
// github.com/yuhonas/free-exercise-db (Unlicense / public domain).
//
//   npm run exercise-db:import
//
// The output is deterministic (sorted, no timestamps), so running twice
// produces no diff. Curation rule: keep only exercises whose equipment is
// realistic at home for this app's audience (bodyweight, dumbbells, resistance
// bands, exercise/medicine ball); machine/barbell/cable-only moves have no
// consumer in the app's workouts and would only bloat the bundle. A small set
// of first-party entries covers gentle standing-cardio moves the dataset
// lacks. See docs/exercise-db-source.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toDbExercise, type RawDbExercise, type DbExercise } from "../lib/exerciseDbMapping";

const SOURCE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const OUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "constants", "exerciseDb.ts");

const HOME_EQUIPMENT = new Set(["dumbbells", "resistance_bands", "pilates_equipment"]);

// Moves this app's workouts use that free-exercise-db has no equivalent for.
const FIRST_PARTY: DbExercise[] = [
  {
    id: "FP_March_In_Place",
    name: "March in Place",
    instructions: [
      "Stand tall with your feet hip-width apart and arms relaxed at your sides.",
      "Lift one knee toward hip height while swinging the opposite arm forward.",
      "Lower it with control and immediately lift the other knee, settling into a steady marching rhythm.",
      "Keep your shoulders relaxed and breathe evenly throughout.",
    ],
    muscleGroups: ["legs", "core_abs"],
    equipment: [],
    level: "beginner",
    category: "cardio",
    tags: ["first-party"],
  },
  {
    id: "FP_Side_Steps",
    name: "Side Steps",
    instructions: [
      "Stand with feet together and knees slightly bent.",
      "Step wide to one side, then bring the trailing foot in to meet it.",
      "Repeat in the other direction, keeping the steps light and springy without leaving the floor.",
      "Add an arm reach on each step for extra rhythm.",
    ],
    muscleGroups: ["legs"],
    equipment: [],
    level: "beginner",
    category: "cardio",
    tags: ["first-party"],
  },
  {
    id: "FP_Standing_Knee_Drive",
    name: "Standing Knee Drive",
    instructions: [
      "Stand tall and reach both arms overhead.",
      "Drive one knee up toward your hands as they sweep down to meet it.",
      "Return to standing tall and repeat on the other side, alternating with a steady rhythm.",
      "Brace your core each time the knee lifts.",
    ],
    muscleGroups: ["core_abs", "legs"],
    equipment: [],
    level: "beginner",
    category: "cardio",
    tags: ["first-party"],
  },
  {
    id: "FP_Standing_Punches",
    name: "Standing Punches",
    instructions: [
      "Stand with feet staggered, knees soft, and fists guarding your chin.",
      "Punch one arm across your body with control, rotating slightly through the torso.",
      "Pull it back quickly and punch with the other arm, exhaling sharply with each punch.",
      "Keep the pace brisk but the shoulders relaxed.",
    ],
    muscleGroups: ["arms", "upper_body", "core_abs"],
    equipment: [],
    level: "beginner",
    category: "cardio",
    tags: ["first-party"],
  },
  {
    id: "FP_Standing_Core_Twist",
    name: "Standing Core Twists",
    instructions: [
      "Stand with feet shoulder-width apart and arms bent in front of your chest.",
      "Rotate your torso to one side, letting the back heel pivot slightly.",
      "Return through center and rotate to the other side in a smooth, continuous rhythm.",
      "Keep your hips steady and let the waist do the work.",
    ],
    muscleGroups: ["core_abs"],
    equipment: [],
    level: "beginner",
    category: "cardio",
    tags: ["first-party"],
  },
  {
    id: "FP_Bicycle_Crunch",
    name: "Bicycle Crunch",
    instructions: [
      "Lie on your back with hands lightly supporting your head and legs at tabletop.",
      "Curl up and rotate one elbow toward the opposite knee while extending the other leg long.",
      "Switch sides in a slow, controlled pedaling motion.",
      "Keep your lower back pressed toward the floor throughout.",
    ],
    muscleGroups: ["core_abs"],
    equipment: [],
    level: "beginner",
    category: "strength",
    tags: ["first-party"],
  },
];

async function main() {
  console.log(`Fetching ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const raw = (await res.json()) as RawDbExercise[];
  console.log(`Fetched ${raw.length} raw exercises.`);

  const mapped = raw
    .map(toDbExercise)
    .filter((e): e is DbExercise => e !== null)
    .filter((e) => e.equipment.length === 0 || e.equipment.every((q) => HOME_EQUIPMENT.has(q)));

  const all = [...mapped, ...FIRST_PARTY].sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Set(all.map((e) => e.id));
  if (ids.size !== all.length) throw new Error("Duplicate exercise ids after merge");

  const header = `// AUTO-GENERATED by scripts/import-exercise-db.mts. Do not edit by hand;
// re-run \`npm run exercise-db:import\` instead.
//
// Source: https://github.com/yuhonas/free-exercise-db
// License: The Unlicense (public domain). See docs/exercise-db-source.md.
// Curated to home-friendly equipment (${all.length} exercises: ${mapped.length} from
// the dataset plus ${FIRST_PARTY.length} first-party entries tagged "first-party").

import type { DbExercise } from "@/lib/exerciseDbMapping";

export type { DbExercise } from "@/lib/exerciseDbMapping";

export const EXERCISE_DB: DbExercise[] = `;

  const footer = `;

const byId = new Map(EXERCISE_DB.map((e) => [e.id, e]));
const byName = new Map(EXERCISE_DB.map((e) => [e.name.toLowerCase(), e]));

export function getDbExercise(id: string): DbExercise | undefined {
  return byId.get(id);
}

export function findDbExerciseByName(name: string): DbExercise | undefined {
  return byName.get(name.trim().toLowerCase());
}
`;

  fs.writeFileSync(OUT_PATH, header + JSON.stringify(all, null, 2) + footer);
  console.log(`Wrote ${all.length} exercises to ${path.relative(process.cwd(), OUT_PATH)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
