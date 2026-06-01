// Server-side password hashing for member/coach accounts.
//
// Runs in Metro's Node runtime alongside the other +api routes. We use WebCrypto
// (PBKDF2-SHA256) — the same crypto surface lib/adminAuth.ts relies on — so no
// node-only modules are needed and the hashing works identically in every
// runtime. Stored format: `pbkdf2$<iterations>$<saltB64url>$<hashB64url>`.

const enc = new TextEncoder();
const ITERATIONS = 100_000;
const KEY_BITS = 256;

function webcrypto(): Crypto {
  const c = (globalThis as any).crypto;
  if (!c?.subtle) throw new Error("WebCrypto is not available in this runtime");
  return c;
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

// Constant-time comparison so a wrong password can't be timed byte-by-byte.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const subtle = webcrypto().subtle;
  const keyMaterial = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  webcrypto().getRandomValues(salt);
  const hash = await deriveBits(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = (stored ?? "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = b64urlDecode(parts[2]);
    expected = b64urlDecode(parts[3]);
  } catch {
    return false;
  }
  const actual = await deriveBits(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}
