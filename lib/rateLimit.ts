import { getPool, ensureSchema } from "@/lib/db";

// Application-level rate limiting for the API routes. A single fixed-window
// counter keyed by an arbitrary bucket string (e.g. "login:ip:1.2.3.4" or
// "ai:analyze:<userId>"), backed by the existing Postgres so the count is
// shared across requests/instances.

export type RateLimitOptions = { limit: number; windowSec: number };
export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

// Records one hit against `bucket` and returns the running count plus the
// window's reset time (epoch ms). Injectable so the limiter is unit-testable
// without a real database (see __tests__/rate-limit.test.ts).
export type RateLimitStore = (
  bucket: string,
  windowMs: number,
  now: number,
) => Promise<{ count: number; resetAt: number }>;

// Postgres-backed store. The count/reset update is a single atomic upsert so
// concurrent requests can't lose increments to a read-modify-write race: a new
// window resets count to 1, otherwise it increments in place.
const pgStore: RateLimitStore = async (bucket, windowMs, now) => {
  await ensureSchema();
  const { rows } = await getPool().query<{ count: number; reset_at: string }>(
    `INSERT INTO rate_limits (bucket, count, reset_at) VALUES ($1, 1, $2)
     ON CONFLICT (bucket) DO UPDATE SET
       count    = CASE WHEN rate_limits.reset_at <= $3 THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= $3 THEN $2 ELSE rate_limits.reset_at END
     RETURNING count, reset_at`,
    [bucket, now + windowMs, now],
  );
  return { count: Number(rows[0].count), resetAt: Number(rows[0].reset_at) };
};

// ponytail: fixed window, not sliding — a burst can reach ~2x `limit` across a
// window boundary. Fine for abuse-prevention; move to a sliding window only if
// that edge case ever matters.
export async function rateLimit(
  bucket: string,
  opts: RateLimitOptions,
  store: RateLimitStore = pgStore,
): Promise<RateLimitResult> {
  const now = Date.now();
  try {
    const { count, resetAt } = await store(bucket, opts.windowSec * 1000, now);
    const ok = count <= opts.limit;
    return {
      ok,
      remaining: Math.max(0, opts.limit - count),
      retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  } catch (e: any) {
    // Fail open: never lock a real user out because the limiter's own storage
    // hiccuped. The protected endpoints still need the DB for their real work,
    // so this only widens the abuse window during an outage, it doesn't expose
    // anything new.
    console.error(`[rateLimit] fail-open bucket=${bucket} ${e?.message ?? e}`);
    return { ok: true, remaining: opts.limit, retryAfterSec: 0 };
  }
}

// Best-effort client IP for keying unauthenticated endpoints. Behind a proxy
// (Replit) x-forwarded-for holds the real client; falls back to x-real-ip, then
// a shared "unknown" bucket so keying still works in local dev.
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// Standard 429 response with a Retry-After header (seconds).
export function tooMany(retryAfterSec: number): Response {
  return Response.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSec)) } },
  );
}
