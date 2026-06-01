import type { Pool } from "pg";

import { __setPoolForTests } from "@/lib/db";

// A tiny in-memory stand-in for the Postgres pool used by lib/userStore and the
// app_settings helpers. It understands only the handful of SQL statements those
// modules issue, so the auth routes can be exercised end-to-end without a real
// database. Installing a fake also marks the schema as ready (see
// __setPoolForTests), so no CREATE TABLE statements are needed here.

export type Row = Record<string, any>;

export type FakeDb = {
  users: Map<string, Row>;
  settings: Map<string, string>;
  exercises: Row[];
  seedUser: (u: Partial<Row> & { id: string; email: string }) => Row;
  seedExercise: (
    e: Partial<Row> & { video_object_path: string }
  ) => Row;
};

function dupKeyError(): Error & { code: string } {
  const e = new Error("duplicate key value violates unique constraint") as Error & {
    code: string;
  };
  e.code = "23505";
  return e;
}

// Parses the SET clause of an UPDATE into per-column assignments. Each column is
// set either from a positional parameter (`col = $n`) or to a literal NULL
// (`col = NULL`), so the avatar updates (which null out columns) apply correctly.
type SetAssignment =
  | { col: string; kind: "param"; idx: number }
  | { col: string; kind: "null" };

function setAssignments(text: string): SetAssignment[] {
  const setPart = text.split(/\bSET\b/i)[1].split(/\bWHERE\b/i)[0];
  return setPart.split(",").map((part) => {
    const m = /(\w+)\s*=\s*(\$(\d+)|NULL)/i.exec(part);
    if (!m) throw new Error(`fakeUserDb: cannot parse assignment: ${part.trim()}`);
    if (m[2].startsWith("$")) {
      return { col: m[1], kind: "param", idx: Number(m[3]) - 1 };
    }
    return { col: m[1], kind: "null" };
  });
}

// Builds a fresh in-memory db, installs it as the active pool, and returns
// handles so tests can seed and inspect rows.
export function installFakeDb(): FakeDb {
  const users = new Map<string, Row>();
  const settings = new Map<string, string>();
  const exercises: Row[] = [];

  async function query(text: string, params: any[] = []): Promise<{ rows: Row[] }> {
    const sql = text.trim();

    // --- exercises (media paths the cleanup sweep reconciles against) -------
    if (/FROM\s+exercises/i.test(sql)) {
      return {
        rows: exercises.map((e) => ({
          video_object_path: e.video_object_path,
          poster_object_path: e.poster_object_path ?? null,
        })),
      };
    }

    // --- app_settings ------------------------------------------------------
    if (/FROM\s+app_settings/i.test(sql)) {
      const value = settings.get(params[0]);
      return { rows: value === undefined ? [] : [{ value }] };
    }
    if (/INSERT\s+INTO\s+app_settings/i.test(sql)) {
      settings.set(params[0], params[1]);
      return { rows: [] };
    }

    // --- users -------------------------------------------------------------
    if (/INSERT\s+INTO\s+users/i.test(sql)) {
      // Column order mirrors createUser():
      // id, name, email, password_hash, avatar, is_admin, [onboarding=FALSE], created_at
      const [id, name, email, password_hash, avatar, is_admin, created_at] = params;
      for (const u of users.values()) {
        if (u.email === email) throw dupKeyError();
      }
      const row: Row = {
        id,
        name,
        email,
        password_hash,
        avatar: avatar ?? null,
        is_admin: !!is_admin,
        onboarding_complete: false,
        created_at,
      };
      users.set(id, row);
      return { rows: [{ ...row }] };
    }

    if (/UPDATE\s+users/i.test(sql)) {
      const assignments = setAssignments(sql);
      const id = params[params.length - 1];
      const row = users.get(id);
      if (!row) return { rows: [] };
      for (const a of assignments) {
        row[a.col] = a.kind === "null" ? null : params[a.idx];
      }
      return { rows: [{ ...row }] };
    }

    if (/SELECT\s+1\s+FROM\s+users/i.test(sql)) {
      // emailTaken: optional "AND id <> $2" excludes the caller's own row.
      const email = params[0];
      const exceptId = /AND\s+id\s*<>/i.test(sql) ? params[1] : undefined;
      for (const u of users.values()) {
        if (u.email === email && u.id !== exceptId) return { rows: [{ "?column?": 1 }] };
      }
      return { rows: [] };
    }

    if (/FROM\s+users\s+WHERE\s+email/i.test(sql)) {
      const email = params[0];
      for (const u of users.values()) {
        if (u.email === email) return { rows: [{ ...u }] };
      }
      return { rows: [] };
    }

    if (/FROM\s+users\s+WHERE\s+id/i.test(sql)) {
      const row = users.get(params[0]);
      return { rows: row ? [{ ...row }] : [] };
    }

    throw new Error(`fakeUserDb: unhandled query: ${sql}`);
  }

  const fakePool = { query } as unknown as Pool;
  __setPoolForTests(fakePool);

  let exerciseSeq = 0;
  return {
    users,
    settings,
    exercises,
    seedUser(u) {
      const row: Row = {
        id: u.id,
        name: u.name ?? "Seeded",
        email: u.email,
        password_hash: u.password_hash ?? "",
        avatar: u.avatar ?? null,
        avatar_object_path: u.avatar_object_path ?? null,
        avatar_mime: u.avatar_mime ?? null,
        is_admin: !!u.is_admin,
        onboarding_complete: !!u.onboarding_complete,
        created_at: u.created_at ?? Date.now(),
      };
      users.set(row.id, row);
      return row;
    },
    seedExercise(e) {
      const row: Row = {
        id: e.id ?? `ex-${++exerciseSeq}`,
        video_object_path: e.video_object_path,
        poster_object_path: e.poster_object_path ?? null,
      };
      exercises.push(row);
      return row;
    },
  };
}

// Restores the default (real) pool resolution so a fake never leaks across files.
export function uninstallFakeDb(): void {
  __setPoolForTests(null);
}
