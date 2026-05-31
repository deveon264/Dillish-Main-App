import { ADMIN_EMAIL, isAdminEmail } from "@/constants/admin";
import { getSetting, setSetting } from "@/lib/db";

// Key under which a coach-rotated passcode is stored. When present it overrides
// the ADMIN_PASSCODE env var so the coach can change the passcode in-app
// without editing a server secret.
const PASSCODE_SETTING_KEY = "admin_passcode";

// Server-side admin authentication.
//
// The app uses a client-side mock login, so the server cannot trust any
// identity value the client sends (e.g. an `x-user-email` header is trivially
// spoofable). Instead the coach proves possession of a server-only passcode
// (ADMIN_PASSCODE) once, and the server mints a short-lived HMAC-signed token.
// Upload/delete routes then verify that signature themselves — a forged token
// or a spoofed header grants nothing.

const TOKEN_TTL_SEC = 60 * 60 * 12; // 12 hours
const SIGN_INFO = "florish-admin-session-v1";

const enc = new TextEncoder();

function getEnvPasscode(): string {
  const p = process.env.ADMIN_PASSCODE;
  if (!p) throw new Error("ADMIN_PASSCODE is not set");
  return p;
}

// Returns the passcode currently in effect: a coach-rotated value if one has
// been saved, otherwise the ADMIN_PASSCODE env var. If the DB is unreachable we
// fall back to the env var so the coach is never locked out.
async function getEffectivePasscode(): Promise<string> {
  try {
    const override = await getSetting(PASSCODE_SETTING_KEY);
    if (override) return override;
  } catch (e: any) {
    console.error("admin passcode lookup failed, falling back to env:", e?.message ?? e);
  }
  return getEnvPasscode();
}

function getSessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function subtle(): SubtleCrypto {
  const c = (globalThis as any).crypto;
  if (!c?.subtle) throw new Error("WebCrypto is not available in this runtime");
  return c.subtle;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Derive a dedicated signing key from SESSION_SECRET so the raw secret is never
// used to sign payloads directly.
async function signingKey(): Promise<CryptoKey> {
  const base = await subtle().importKey(
    "raw",
    enc.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const derived = await subtle().sign("HMAC", base, enc.encode(SIGN_INFO));
  return subtle().importKey(
    "raw",
    derived,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function hmac(data: string): Promise<string> {
  const key = await signingKey();
  const sig = await subtle().sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

// Constant-time string comparison to avoid leaking the passcode via timing.
function timingSafeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export async function verifyPasscode(input: string | null | undefined): Promise<boolean> {
  if (!input) return false;
  return timingSafeEqual(input, await getEffectivePasscode());
}

// Rotates the coach passcode after confirming the current one. The new value is
// persisted to the DB and immediately overrides the ADMIN_PASSCODE env var.
// Existing signed tokens stay valid because they are independent of the passcode.
export async function rotatePasscode(
  current: string | null | undefined,
  next: string | null | undefined
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyPasscode(current))) {
    return { ok: false, error: "Current passcode is incorrect" };
  }
  const trimmed = (next ?? "").trim();
  if (trimmed.length < 6) {
    return { ok: false, error: "New passcode must be at least 6 characters" };
  }
  if (timingSafeEqual(trimmed, (current ?? "").trim())) {
    return { ok: false, error: "New passcode must be different from the current one" };
  }
  await setSetting(PASSCODE_SETTING_KEY, trimmed);
  return { ok: true };
}

export async function mintAdminToken(): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + TOKEN_TTL_SEC * 1000;
  const payload = b64url(
    enc.encode(JSON.stringify({ role: "admin", email: ADMIN_EMAIL, exp: expiresAt }))
  );
  const sig = await hmac(payload);
  return { token: `${payload}.${sig}`, expiresAt };
}

// Returns the verified admin email, or null if the token is missing, malformed,
// tampered with, or expired.
export async function verifyAdminToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = await hmac(payload);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    if (data.role !== "admin") return null;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (!isAdminEmail(data.email)) return null;
    return data.email as string;
  } catch {
    return null;
  }
}

// Reads the Bearer token from the request and verifies it server-side.
export async function requireAdmin(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return null;
  return verifyAdminToken(m[1]);
}
