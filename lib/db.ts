import { Pool } from "pg";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

// Creates the exercises table on first use so fresh environments work without
// a manual migration step. Video bytes live in object storage; only a path is
// stored here.
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const pool = getPool();
    schemaReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS exercises (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          cues TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT 'Strength',
          level TEXT NOT NULL DEFAULT 'Beginner',
          duration TEXT NOT NULL DEFAULT '',
          video_object_path TEXT NOT NULL,
          video_mime TEXT NOT NULL DEFAULT 'video/mp4',
          video_size BIGINT NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL DEFAULT '',
          created_at BIGINT NOT NULL
        )`
      )
      // Posters were added after the initial release; backfill the columns so
      // existing environments pick them up without a manual migration.
      .then(() =>
        pool.query(
          `ALTER TABLE exercises
             ADD COLUMN IF NOT EXISTS poster_object_path TEXT,
             ADD COLUMN IF NOT EXISTS poster_mime TEXT`
        )
      )
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null;
        throw e;
      });
  }
  return schemaReady;
}
