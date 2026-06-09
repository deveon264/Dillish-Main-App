import { Pool } from "pg";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

// Test seam: backs the data layer with an in-memory pool so the auth flows can
// be exercised without a real Postgres. Passing a pool also marks the schema as
// ready so `ensureSchema()` skips its CREATE TABLE statements. Never called by
// application code — only the test suite.
export function __setPoolForTests(p: Pool | null): void {
  pool = p;
  schemaReady = p ? Promise.resolve() : null;
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
      // Per-exercise uploads tie a video to a specific exercise inside a
      // specific workout (constants/workouts.ts ids). Both stay null for
      // generic library uploads so the standalone library is unaffected.
      .then(() =>
        pool.query(
          `ALTER TABLE exercises
             ADD COLUMN IF NOT EXISTS workout_id TEXT,
             ADD COLUMN IF NOT EXISTS workout_exercise_id TEXT`
        )
      )
      // Small key/value table for server settings the coach can change in-app,
      // such as a rotated admin passcode that overrides the ADMIN_PASSCODE env.
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at BIGINT NOT NULL
          )`
        )
      )
      // Real, server-verified accounts. Identity lives here (not on the device)
      // so uploads/deletes and every member's data can be tied to a verified
      // login. The coach is simply the row flagged is_admin.
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            avatar TEXT,
            is_admin BOOLEAN NOT NULL DEFAULT FALSE,
            onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
            created_at BIGINT NOT NULL
          )`
        )
      )
      // Profile photos moved to object storage after the initial release: the
      // bytes live in storage and only a key/mime is kept here. Backfill the
      // columns so existing environments pick them up without a manual
      // migration. The legacy `avatar` column may still hold old data-URI
      // photos and is rendered as-is for backward compatibility.
      .then(() =>
        pool.query(
          `ALTER TABLE users
             ADD COLUMN IF NOT EXISTS avatar_object_path TEXT,
             ADD COLUMN IF NOT EXISTS avatar_mime TEXT`
        )
      )
      // Profile metrics (age/weight/height/units/goals/water+calorie goals/
      // start+goal weight) are persisted account-side as a JSON blob so they
      // follow the user across logins and devices instead of living only in
      // on-device storage. Added after the initial release; backfill so existing
      // environments pick it up without a manual migration.
      .then(() =>
        pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB`)
      )
      // Per-member subscription state (plan, status, renewal date, provider
      // ids) persisted account-side as a JSON blob so the plan a member is on
      // follows them across logins and devices. Added after the initial
      // release; backfill so existing environments pick it up without a manual
      // migration.
      .then(() =>
        pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription JSONB`)
      )
      // Per-member weekly-streak state (running count, last active day, and a
      // bounded rolling window of recent active days) persisted account-side as
      // a JSON blob so the streak follows the member across logins and devices
      // instead of resetting on a new phone or reinstall. Added after the
      // initial release; backfill so existing environments pick it up without a
      // manual migration.
      .then(() =>
        pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak JSONB`)
      )
      // Community feed: the app's first shared, multi-user data. Unlike the
      // device-local activity logs, posts/comments/likes/reports/blocks live
      // server-side so every member sees the same feed. Post photos live in
      // object storage; only the object path is kept here. The schema uses no FK
      // constraints (consistent with the rest of this file); a post's related
      // rows are removed explicitly in one transaction by communityStore.
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS community_posts (
            id TEXT PRIMARY KEY,
            author_id TEXT NOT NULL,
            type TEXT NOT NULL,
            body TEXT NOT NULL DEFAULT '',
            photo_object_path TEXT,
            created_at BIGINT NOT NULL
          )`
        )
      )
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS community_comments (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            body TEXT NOT NULL,
            created_at BIGINT NOT NULL
          )`
        )
      )
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS community_likes (
            post_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            created_at BIGINT NOT NULL,
            PRIMARY KEY (post_id, user_id)
          )`
        )
      )
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS community_reports (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            reporter_id TEXT NOT NULL,
            reason TEXT NOT NULL DEFAULT '',
            created_at BIGINT NOT NULL
          )`
        )
      )
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS community_blocks (
            blocker_id TEXT NOT NULL,
            blocked_id TEXT NOT NULL,
            created_at BIGINT NOT NULL,
            PRIMARY KEY (blocker_id, blocked_id)
          )`
        )
      )
      // Global moderation block applied by an admin (coach). Unlike
      // community_blocks (a per-viewer mute), a row here hides the member's
      // posts from everyone's feed. Reversible by deleting the row (unblock).
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS community_admin_blocks (
            user_id TEXT PRIMARY KEY,
            blocked_by TEXT NOT NULL DEFAULT '',
            created_at BIGINT NOT NULL
          )`
        )
      )
      // Feed reads order by (created_at DESC, id DESC) with a keyset cursor;
      // comment/like reads are scoped to a post. These indexes back those paths.
      .then(() =>
        pool.query(
          `CREATE INDEX IF NOT EXISTS idx_community_posts_feed
             ON community_posts (created_at DESC, id DESC)`
        )
      )
      .then(() =>
        pool.query(
          `CREATE INDEX IF NOT EXISTS idx_community_comments_post
             ON community_comments (post_id, created_at)`
        )
      )
      .then(() =>
        pool.query(
          `CREATE INDEX IF NOT EXISTS idx_community_likes_post
             ON community_likes (post_id)`
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

// Reads a single app setting, or null if it has never been set.
export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await getPool().query<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = $1`,
    [key]
  );
  return rows[0]?.value ?? null;
}

// Inserts or updates a single app setting.
export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [key, value, Date.now()]
  );
}
