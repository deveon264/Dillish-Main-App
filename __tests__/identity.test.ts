import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// These secrets are read lazily inside adminAuth, so setting them here (before
// any handler runs) is enough. They are throwaway values for the test runtime.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";
process.env.ADMIN_PASSCODE = "coach-passcode-123";

import { ADMIN_EMAIL } from "@/constants/admin";
import { hashPassword, verifyPassword } from "@/lib/userAuth";
import {
  mintSessionToken,
  verifySessionToken,
  verifyAdminToken,
  verifyPasscode,
} from "@/lib/adminAuth";
import { POST as signup } from "@/app/api/signup+api";
import { POST as login } from "@/app/api/login+api";
import { GET as meGet, PATCH as mePatch } from "@/app/api/me+api";
import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

// --- helpers ----------------------------------------------------------------

function jsonRequest(url: string, method: string, body?: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function doSignup(body: Record<string, unknown>) {
  const res = await signup(jsonRequest("http://t/api/signup", "POST", body));
  return { res, data: await res.json() };
}

async function doLogin(body: Record<string, unknown>) {
  const res = await login(jsonRequest("http://t/api/login", "POST", body));
  return { res, data: await res.json() };
}

// =========================================================================
// lib/userAuth — password hashing
// =========================================================================

test("verifyPassword accepts the matching password and rejects others", async () => {
  const stored = await hashPassword("correct horse battery");
  assert.equal(await verifyPassword("correct horse battery", stored), true);
  assert.equal(await verifyPassword("wrong password", stored), false);
  assert.equal(await verifyPassword("", stored), false);
});

test("verifyPassword rejects a malformed or empty stored hash", async () => {
  assert.equal(await verifyPassword("anything", ""), false);
  assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  assert.equal(await verifyPassword("anything", "pbkdf2$0$$"), false);
});

// =========================================================================
// lib/adminAuth — session/admin tokens and passcode
// =========================================================================

test("a minted member token verifies but is not an admin token", async () => {
  const { token } = await mintSessionToken({ sub: "u1", email: "m@x.com", isAdmin: false });
  const session = await verifySessionToken(token);
  assert.ok(session);
  assert.equal(session!.sub, "u1");
  assert.equal(session!.email, "m@x.com");
  assert.equal(session!.role, "member");
  assert.equal(await verifyAdminToken(token), null);
});

test("a minted admin token verifies as both a session and an admin token", async () => {
  const { token } = await mintSessionToken({ sub: "a1", email: ADMIN_EMAIL, isAdmin: true });
  const session = await verifySessionToken(token);
  assert.equal(session!.role, "admin");
  assert.equal(await verifyAdminToken(token), ADMIN_EMAIL);
});

test("an admin-role token whose email is not the coach email is rejected as admin", async () => {
  // Even if a token claims role admin, verifyAdminToken pins it to the coach email.
  const { token } = await mintSessionToken({ sub: "x", email: "imposter@x.com", isAdmin: true });
  assert.equal(await verifyAdminToken(token), null);
});

test("a tampered token fails both session and admin verification", async () => {
  const { token } = await mintSessionToken({ sub: "u1", email: "m@x.com", isAdmin: false });
  const [payload, sig] = token.split(".");
  const tampered = `${payload}.${sig.slice(0, -2)}xx`;
  assert.equal(await verifySessionToken(tampered), null);
  assert.equal(await verifyAdminToken(tampered), null);
  assert.equal(await verifySessionToken("garbage"), null);
  assert.equal(await verifySessionToken(""), null);
  assert.equal(await verifySessionToken(null), null);
});

test("an expired token is rejected", async () => {
  // Mint a token whose expiry is already in the past by moving Date.now back
  // beyond the full TTL while it is computed.
  const realNow = Date.now;
  Date.now = () => realNow() - 1000 * 60 * 60 * 24 * 365; // a year ago
  let token: string;
  try {
    ({ token } = await mintSessionToken({ sub: "u1", email: "m@x.com", isAdmin: true }));
  } finally {
    Date.now = realNow;
  }
  assert.equal(await verifySessionToken(token!), null);
  assert.equal(await verifyAdminToken(token!), null);
});

test("verifyPasscode matches the configured passcode and rejects anything else", async () => {
  assert.equal(await verifyPasscode("coach-passcode-123"), true);
  assert.equal(await verifyPasscode("wrong"), false);
  assert.equal(await verifyPasscode(""), false);
  assert.equal(await verifyPasscode(null), false);
});

// =========================================================================
// /api/signup
// =========================================================================

test("signup happy path creates a member and returns a verifiable token", async () => {
  const { res, data } = await doSignup({
    name: "Mara",
    email: "Mara@Example.com",
    password: "hunter2",
  });
  assert.equal(res.status, 200);
  assert.equal(data.user.isAdmin, false);
  assert.equal(data.user.email, "mara@example.com"); // normalized
  const session = await verifySessionToken(data.token);
  assert.equal(session!.role, "member");
  assert.equal(session!.email, "mara@example.com");
  assert.equal(db.users.size, 1);
});

test("signup validates name, email, and password length", async () => {
  assert.equal((await doSignup({ name: "", email: "a@b.com", password: "hunter2" })).res.status, 400);
  assert.equal((await doSignup({ name: "A", email: "not-an-email", password: "hunter2" })).res.status, 400);
  assert.equal((await doSignup({ name: "A", email: "a@b.com", password: "short" })).res.status, 400);
  assert.equal(db.users.size, 0);
});

test("signup with the coach email is refused without the passcode", async () => {
  const { res, data } = await doSignup({
    name: "Coach",
    email: ADMIN_EMAIL,
    password: "hunter2",
  });
  assert.equal(res.status, 403);
  assert.match(data.error, /passcode/i);
  assert.equal(db.users.size, 0);
});

test("signup with the coach email and a wrong passcode is refused", async () => {
  const { res } = await doSignup({
    name: "Coach",
    email: ADMIN_EMAIL,
    password: "hunter2",
    passcode: "nope",
  });
  assert.equal(res.status, 403);
  assert.equal(db.users.size, 0);
});

test("signup with the coach email and correct passcode mints an admin", async () => {
  const { res, data } = await doSignup({
    name: "Coach",
    email: ADMIN_EMAIL,
    password: "hunter2",
    passcode: "coach-passcode-123",
  });
  assert.equal(res.status, 200);
  assert.equal(data.user.isAdmin, true);
  assert.equal(await verifyAdminToken(data.token), ADMIN_EMAIL);
});

test("signup rejects a duplicate email", async () => {
  await doSignup({ name: "A", email: "dupe@x.com", password: "hunter2" });
  const { res, data } = await doSignup({ name: "B", email: "dupe@x.com", password: "hunter2" });
  assert.equal(res.status, 409);
  assert.match(data.error, /already exists/i);
  assert.equal(db.users.size, 1);
});

// =========================================================================
// /api/login
// =========================================================================

test("login succeeds with the right credentials after signup", async () => {
  await doSignup({ name: "Mara", email: "mara@x.com", password: "hunter2" });
  const { res, data } = await doLogin({ email: "MARA@x.com", password: "hunter2" });
  assert.equal(res.status, 200);
  assert.equal(data.user.email, "mara@x.com");
  assert.ok(await verifySessionToken(data.token));
});

test("login rejects a wrong password with a generic 401", async () => {
  await doSignup({ name: "Mara", email: "mara@x.com", password: "hunter2" });
  const { res, data } = await doLogin({ email: "mara@x.com", password: "WRONG" });
  assert.equal(res.status, 401);
  assert.match(data.error, /incorrect email or password/i);
});

test("login rejects an unknown email with the same generic 401", async () => {
  const { res, data } = await doLogin({ email: "ghost@x.com", password: "hunter2" });
  assert.equal(res.status, 401);
  assert.match(data.error, /incorrect email or password/i);
});

// =========================================================================
// /api/me
// =========================================================================

test("GET /api/me returns the verified account, and rejects missing/bad tokens", async () => {
  const { data } = await doSignup({ name: "Mara", email: "mara@x.com", password: "hunter2" });
  const token = data.token as string;

  const ok = await meGet(jsonRequest("http://t/api/me", "GET", undefined, token));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).user.email, "mara@x.com");

  const noAuth = await meGet(jsonRequest("http://t/api/me", "GET"));
  assert.equal(noAuth.status, 401);

  const bad = await meGet(jsonRequest("http://t/api/me", "GET", undefined, "garbage.token"));
  assert.equal(bad.status, 401);
});

test("PATCH /api/me cannot flip is_admin on a member account", async () => {
  const { data } = await doSignup({ name: "Mara", email: "mara@x.com", password: "hunter2" });
  const token = data.token as string;

  const res = await mePatch(
    jsonRequest("http://t/api/me", "PATCH", { isAdmin: true, is_admin: true, role: "admin" }, token)
  );
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.equal(out.user.isAdmin, false);
  // The stored row is untouched as well.
  const stored = [...db.users.values()][0];
  assert.equal(stored.is_admin, false);
});

test("PATCH /api/me lets a member update their name", async () => {
  const { data } = await doSignup({ name: "Mara", email: "mara@x.com", password: "hunter2" });
  const token = data.token as string;
  const res = await mePatch(jsonRequest("http://t/api/me", "PATCH", { name: "Mara B." }, token));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).user.name, "Mara B.");
});

test("PATCH /api/me forbids a member from claiming the coach email", async () => {
  const { data } = await doSignup({ name: "Mara", email: "mara@x.com", password: "hunter2" });
  const token = data.token as string;
  const res = await mePatch(jsonRequest("http://t/api/me", "PATCH", { email: ADMIN_EMAIL }, token));
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /reserved/i);
});

test("PATCH /api/me forbids the coach from moving off the coach email", async () => {
  const { data } = await doSignup({
    name: "Coach",
    email: ADMIN_EMAIL,
    password: "hunter2",
    passcode: "coach-passcode-123",
  });
  const token = data.token as string;
  const res = await mePatch(
    jsonRequest("http://t/api/me", "PATCH", { email: "newcoach@x.com" }, token)
  );
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /can't be changed/i);
});

// =========================================================================
// Legacy on-device account migration (server-observable contract)
//
// Migration itself is orchestrated client-side (AuthContext): on a login that
// the server doesn't recognize, the client re-creates the account via /api/signup
// using the on-device credentials, then logs in normally. These tests pin the
// server side of that contract.
// =========================================================================

test("migration: unknown login then signup then login succeeds", async () => {
  // 1. First login fails because the account only exists on-device.
  const first = await doLogin({ email: "legacy@x.com", password: "hunter2" });
  assert.equal(first.res.status, 401);

  // 2. The client migrates by signing up with the same on-device credentials.
  const migrated = await doSignup({ name: "Legacy User", email: "legacy@x.com", password: "hunter2" });
  assert.equal(migrated.res.status, 200);
  assert.equal(migrated.data.user.isAdmin, false);

  // 3. Subsequent logins now work against the server account.
  const second = await doLogin({ email: "legacy@x.com", password: "hunter2" });
  assert.equal(second.res.status, 200);
});

test("migration cannot mint an admin: coach email still needs the passcode", async () => {
  // A legacy account using the coach email must not be silently promoted; the
  // signup the client would issue is refused without the passcode.
  const res = await doSignup({ name: "Coach", email: ADMIN_EMAIL, password: "hunter2" });
  assert.equal(res.res.status, 403);
  assert.equal(db.users.size, 0);
});
