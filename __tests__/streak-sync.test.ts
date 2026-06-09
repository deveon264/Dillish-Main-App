import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads these lazily, so setting them before any handler runs is
// enough. Throwaway values for the test runtime only.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";
process.env.ADMIN_PASSCODE = "coach-passcode-123";

import { mintSessionToken } from "@/lib/adminAuth";
import { GET as streakGet, POST as streakPost } from "@/app/api/streak+api";
import { dayKeyOf } from "@/lib/streak";
import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

function req(method: string, body?: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request("http://t/api/streak", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function tokenFor(id: string, email: string): Promise<string> {
  db.seedUser({ id, email });
  const { token } = await mintSessionToken({ sub: id, email, isAdmin: false });
  return token;
}

test("GET and POST require a valid session", async () => {
  const getRes = await streakGet(req("GET"));
  assert.equal(getRes.status, 401);
  const postRes = await streakPost(req("POST", { day: "2026-06-09" }));
  assert.equal(postRes.status, 401);
});

test("a fresh account has no server streak yet", async () => {
  const token = await tokenFor("u1", "m@x.com");
  const res = await streakGet(req("GET", undefined, token));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.streak, null);
});

test("POST rejects an invalid day key with 400", async () => {
  const token = await tokenFor("u1", "m@x.com");
  const res = await streakPost(req("POST", { day: "2026-6-9" }, token));
  assert.equal(res.status, 400);
  // A missing day is rejected too.
  const res2 = await streakPost(req("POST", {}, token));
  assert.equal(res2.status, 400);
});

test("POST records a day and GET reads it back (survives a new 'login')", async () => {
  const token = await tokenFor("u1", "m@x.com");

  const postRes = await streakPost(req("POST", { day: "2026-06-09" }, token));
  assert.equal(postRes.status, 200);
  const saved = (await postRes.json()).streak;
  assert.equal(saved.count, 1);
  assert.equal(saved.lastActiveDay, "2026-06-09");
  assert.deepEqual(saved.recentDays, ["2026-06-09"]);

  // A brand-new token for the same account (e.g. after re-login) reads the same
  // streak straight from the server.
  const { token: token2 } = await mintSessionToken({ sub: "u1", email: "m@x.com", isAdmin: false });
  const getRes = await streakGet(req("GET", undefined, token2));
  const got = (await getRes.json()).streak;
  assert.equal(got.count, 1);
  assert.equal(got.lastActiveDay, "2026-06-09");
});

test("POST advances the count on a consecutive day", async () => {
  const token = await tokenFor("u1", "m@x.com");
  await streakPost(req("POST", { day: "2026-06-08" }, token));
  const res = await streakPost(req("POST", { day: "2026-06-09" }, token));
  const saved = (await res.json()).streak;
  assert.equal(saved.count, 2);
  assert.equal(saved.lastActiveDay, "2026-06-09");
  assert.deepEqual(saved.recentDays, ["2026-06-08", "2026-06-09"]);
});

test("POST reconciles the device's offline window via recentDays", async () => {
  const token = await tokenFor("u1", "m@x.com");
  const res = await streakPost(
    req("POST", { day: "2026-06-09", recentDays: ["2026-06-06", "2026-06-07", "bad"] }, token)
  );
  const saved = (await res.json()).streak;
  // The frontier day plus the merged offline days, deduped, sorted, invalid dropped.
  assert.deepEqual(saved.recentDays, ["2026-06-06", "2026-06-07", "2026-06-09"]);
  // Merged days don't retroactively change the running count.
  assert.equal(saved.count, 1);
});

test("POST returns 404 when the account row is gone", async () => {
  // Mint a valid token but never seed the user row.
  const { token } = await mintSessionToken({ sub: "ghost", email: "g@x.com", isAdmin: false });
  const res = await streakPost(req("POST", { day: dayKeyOf() }, token));
  assert.equal(res.status, 404);
});
