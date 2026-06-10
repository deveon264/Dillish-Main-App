import { getPool, ensureSchema } from "@/lib/db";

// Server-side persistence for device push tokens. A token (an Expo push token
// string) is what the Expo push service delivers to; we keep one row per device
// token and tie it to the member currently signed in on that device, so a
// moderation action can reach them even when the app is closed.

// Saves (or re-points) a device push token to a member. The token is the
// primary key, so signing in on a shared phone re-points the same token to the
// new member rather than leaving it on the previous one.
export async function savePushToken(input: {
  userId: string;
  token: string;
  platform?: string | null;
}): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO push_tokens (token, user_id, platform, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           platform = EXCLUDED.platform,
           updated_at = EXCLUDED.updated_at`,
    [input.token, input.userId, input.platform ?? "", Date.now()]
  );
}

// Removes a single device token, scoped to its owner so a member can only drop
// their own device. Used on sign-out. Returns true when a row was removed.
export async function removePushToken(input: {
  userId: string;
  token: string;
}): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    `DELETE FROM push_tokens WHERE token = $1 AND user_id = $2`,
    [input.token, input.userId]
  );
  return (rowCount ?? 0) > 0;
}

// Every push token registered for a member (one per device they are signed in
// on). Used to fan a moderation push out to all of a member's devices.
export async function listPushTokensForUser(userId: string): Promise<string[]> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT token FROM push_tokens WHERE user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.token as string);
}

// Drops tokens the Expo push service has reported as no longer registered (the
// app was uninstalled), so we stop trying to deliver to dead devices. A no-op
// when the list is empty.
export async function deletePushTokens(tokens: string[]): Promise<number> {
  const list = tokens.filter((t) => typeof t === "string" && t.length > 0);
  if (list.length === 0) return 0;
  await ensureSchema();
  const { rowCount } = await getPool().query(
    `DELETE FROM push_tokens WHERE token = ANY($1::text[])`,
    [list]
  );
  return rowCount ?? 0;
}
