// Backfills canonical move ids onto legacy workout-tied exercise uploads.
//
//   npm run exercise-db:backfill-move-ids
//
// The script only fills missing move_id values. It never overwrites an existing
// move_id, so coach overrides and already-migrated rows stay untouched.

import Module from "node:module";
import { createRequire } from "node:module";

const ext = (Module as unknown as { _extensions: Record<string, unknown> })._extensions;
for (const e of [".webp", ".png", ".jpg", ".jpeg"]) {
  ext[e] = (m: { exports: unknown }, filename: string) => {
    m.exports = { uri: filename };
  };
}

const require = createRequire(import.meta.url);
const { WORKOUTS } = require("../constants/workouts") as typeof import("../constants/workouts");
const { ensureSchema, getPool } = await import("../lib/db");

type UploadRow = {
  id: string;
  workout_id: string | null;
  workout_exercise_id: string | null;
};

function buildMoveLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const workout of WORKOUTS) {
    for (const exercise of workout.exercises) {
      lookup.set(`${workout.id}/${exercise.id}`, exercise.moveId);
    }
  }
  return lookup;
}

async function main() {
  await ensureSchema();
  const pool = getPool();
  const lookup = buildMoveLookup();

  const { rows } = await pool.query<UploadRow>(
    `SELECT id, workout_id, workout_exercise_id
       FROM exercises
      WHERE (move_id IS NULL OR move_id = '')
        AND workout_id IS NOT NULL
        AND workout_exercise_id IS NOT NULL
      ORDER BY created_at ASC`
  );

  let updated = 0;
  let unmatched = 0;

  for (const row of rows) {
    const key = `${row.workout_id}/${row.workout_exercise_id}`;
    const moveId = lookup.get(key);
    if (!moveId) {
      unmatched += 1;
      continue;
    }

    const res = await pool.query(
      `UPDATE exercises
          SET move_id = $2
        WHERE id = $1
          AND (move_id IS NULL OR move_id = '')`,
      [row.id, moveId]
    );
    updated += res.rowCount ?? 0;
  }

  console.log(
    `backfill-move-ids: scanned=${rows.length} updated=${updated} unmatched=${unmatched}`
  );

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
