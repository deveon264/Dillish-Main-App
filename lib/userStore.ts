import { getPool, ensureSchema } from "@/lib/db";

// Server-side persistence for member/coach accounts. Identity lives here (not on
// the device) so the server can trust who is signed in. The coach is simply the
// row flagged is_admin.

export type DbUser = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  avatar: string | null;
  is_admin: boolean;
  onboarding_complete: boolean;
  created_at: number;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  isAdmin: boolean;
  onboardingComplete: boolean;
};

export function toPublicUser(u: DbUser): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar ?? null,
    isAdmin: u.is_admin,
    onboardingComplete: u.onboarding_complete,
  };
}

function mapRow(r: any): DbUser {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    password_hash: r.password_hash,
    avatar: r.avatar ?? null,
    is_admin: !!r.is_admin,
    onboarding_complete: !!r.onboarding_complete,
    created_at: Number(r.created_at),
  };
}

const COLS =
  "id, name, email, password_hash, avatar, is_admin, onboarding_complete, created_at";

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT ${COLS} FROM users WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  await ensureSchema();
  const { rows } = await getPool().query(`SELECT ${COLS} FROM users WHERE id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function createUser(input: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatar?: string | null;
  isAdmin: boolean;
}): Promise<DbUser> {
  await ensureSchema();
  const createdAt = Date.now();
  const { rows } = await getPool().query(
    `INSERT INTO users (id, name, email, password_hash, avatar, is_admin, onboarding_complete, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7)
     RETURNING ${COLS}`,
    [
      input.id,
      input.name,
      input.email.trim().toLowerCase(),
      input.passwordHash,
      input.avatar ?? null,
      input.isAdmin,
      createdAt,
    ]
  );
  return mapRow(rows[0]);
}

// Patches mutable profile fields. Only keys present in `fields` are written, so
// callers can update a single field without clobbering the rest. is_admin is
// never mutable here — admin status is decided only at signup.
export async function updateUserRow(
  id: string,
  fields: {
    name?: string;
    email?: string;
    avatar?: string | null;
    onboardingComplete?: boolean;
  }
): Promise<DbUser | null> {
  await ensureSchema();
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (fields.name !== undefined) {
    sets.push(`name = $${i++}`);
    vals.push(fields.name);
  }
  if (fields.email !== undefined) {
    sets.push(`email = $${i++}`);
    vals.push(fields.email.trim().toLowerCase());
  }
  if (fields.avatar !== undefined) {
    sets.push(`avatar = $${i++}`);
    vals.push(fields.avatar);
  }
  if (fields.onboardingComplete !== undefined) {
    sets.push(`onboarding_complete = $${i++}`);
    vals.push(fields.onboardingComplete);
  }
  if (sets.length === 0) return getUserById(id);
  vals.push(id);
  const { rows } = await getPool().query(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $${i} RETURNING ${COLS}`,
    vals
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

// Replaces an account's password hash. Used by the password-reset flow; the
// existing session/reset binding logic handles invalidation of old tokens.
export async function updateUserPassword(
  id: string,
  passwordHash: string
): Promise<DbUser | null> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING ${COLS}`,
    [passwordHash, id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function emailTaken(email: string, exceptId?: string): Promise<boolean> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT 1 FROM users WHERE email = $1 ${exceptId ? "AND id <> $2" : ""} LIMIT 1`,
    exceptId ? [email.trim().toLowerCase(), exceptId] : [email.trim().toLowerCase()]
  );
  return rows.length > 0;
}
