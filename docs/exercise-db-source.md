# Exercise Database Source & License

The internal exercise database (`constants/exerciseDb.ts`) is generated from an
open-source dataset:

- **Repository:** https://github.com/yuhonas/free-exercise-db
- **License:** The Unlicense (public domain dedication) — freely reusable,
  no attribution required (given here anyway for provenance).
- **File used:** `dist/exercises.json` (873 exercises), fetched from the `main`
  branch on 2026-07-08.
- **Imported:** 359 exercises total — 353 from the dataset plus 6 first-party
  entries (gentle standing-cardio moves the dataset lacks), tagged
  `"first-party"` in their `tags`.

## How it's imported

`npm run exercise-db:import` runs `scripts/import-exercise-db.mts`, which
downloads the JSON, converts each record through the mapping layer in
`lib/exerciseDbMapping.ts`, and regenerates `constants/exerciseDb.ts`
deterministically (sorted, no timestamps).

Curation rules (in the script):

- Categories kept: strength, stretching, cardio, plyometrics.
  Dropped: powerlifting, olympic weightlifting, strongman.
- Equipment kept: body only, dumbbell, bands, exercise/medicine ball.
  Dropped: machine, barbell, cable, kettlebells, e-z curl bar, foam roll,
  other (no consumer in the app's home-focused workouts).
- Records with unmappable muscles or empty instructions are dropped.

## Field mapping (repo → app)

| Repo field | App field | Examples |
|---|---|---|
| `primaryMuscles` | `muscleGroups` (`BodyFocusId`) | abdominals → core_abs, quadriceps → legs, lats → back_posture |
| `equipment` | `equipment` (`EquipmentId[]`) | body only → [], dumbbell → [dumbbells], bands → [resistance_bands] |
| `level` | `level` (`FitnessLevel`) | beginner → beginner, expert → advanced |
| `instructions` | `instructions` | step array, trimmed |
| `force`/`mechanic`/`secondaryMuscles` | `tags` | force:push, mechanic:compound, secondary:arms |

The dataset's exercise photos are **not** imported (off-brand gym imagery and
bundle weight); workout exercises keep the app's bundled `.webp` illustrations.
