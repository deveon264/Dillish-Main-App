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
  seedUser: (u: Partial<Row> & { id: string; email: string }) => Row;
};

function dupKeyError(): Error & { code: string } {
  const e = new Error("duplicate key value violates unique constraint") as Error & {
    code: string;
  };
  e.code = "23505";
  return e;
}

function colNamesFromSet(text: string): string[] {
  const setPart = text.split(/\bSET\b/i)[1].split(/\bWHERE\b/i)[0];
  return [...setPart.matchAll(/(\w+)\s*=\s*\$\d+/g)].map((m) => m[1]);
}

// Builds a fresh in-memory db, installs it as the active pool, and returns
// handles so tests can seed and inspect rows.
export function installFakeDb(): FakeDb {
  const users = new Map<string, Row>();
  const settings = new Map<string, string>();

  async function query(text: string, params: any[] = []): Promise<{ rows: Row[] }> {
    const sql = text.trim();

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
      const cols = colNamesFromSet(sql);
      const id = params[params.length - 1];
      const row = users.get(id);
      if (!row) return { rows: [] };
      cols.forEach((c, i) => {
        row[c] = params[i];
      });
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

  return {
    users,
    settings,
    seedUser(u) {
      const row: Row = {
        id: u.id,
        name: u.name ?? "Seeded",
        email: u.email,
        password_hash: u.password_hash ?? "",
        avatar: u.avatar ?? null,
        is_admin: !!u.is_admin,
        onboarding_complete: !!u.onboarding_complete,
        created_at: u.created_at ?? Date.now(),
      };
      users.set(row.id, row);
      return row;
    },
  };
}

// Restores the default (real) pool resolution so a fake never leaks across files.
export function uninstallFakeDb(): void {
  __setPoolForTests(null);
}
