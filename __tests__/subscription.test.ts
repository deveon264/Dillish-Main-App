import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads these lazily, so setting them before any handler runs is
// enough. Throwaway values for the test runtime only.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";
process.env.ADMIN_PASSCODE = "coach-passcode-123";

import { mintSessionToken } from "@/lib/adminAuth";
import { GET as subGet, POST as subPost } from "@/app/api/subscription+api";
import { PLANS } from "@/lib/subscription";
import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

const DAY_MS = 24 * 60 * 60 * 1000;

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
  return new Request("http://t/api/subscription", {
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
  assert.equal((await subGet(req("GET"))).status, 401);
  assert.equal((await subPost(req("POST", { action: "cancel" }))).status, 401);
});

test("GET lazily seeds a real active plan and persists it", async () => {
  const token = await tokenFor("u1", "m@x.com");
  const res = await subGet(req("GET", undefined, token));
  assert.equal(res.status, 200);
  const { subscription } = await res.json();
  assert.equal(subscription.status, "active");
  assert.equal(subscription.planKey, "yearly");
  assert.ok(subscription.currentPeriodEnd > Date.now());

  // The seed is persisted, so a later read returns the same record (not a
  // brand-new seed with a different timestamp).
  const res2 = await subGet(req("GET", undefined, token));
  const again = (await res2.json()).subscription;
  assert.equal(again.startedAt, subscription.startedAt);
  assert.equal(again.currentPeriodEnd, subscription.currentPeriodEnd);
});

test("subscribe with a trial sets trialing status and a 7-day period", async () => {
  const token = await tokenFor("u1", "m@x.com");
  const res = await subPost(req("POST", { action: "subscribe", planKey: "monthly", trial: true }, token));
  assert.equal(res.status, 200);
  const sub = (await res.json()).subscription;
  assert.equal(sub.status, "trialing");
  assert.equal(sub.planKey, "monthly");
  assert.ok(sub.trialEndsAt && sub.trialEndsAt > Date.now());
  const days = Math.round((sub.currentPeriodEnd - Date.now()) / DAY_MS);
  assert.equal(days, 7);
});

test("switch changes the plan and resets the period to a full term", async () => {
  const token = await tokenFor("u1", "m@x.com");
  await subGet(req("GET", undefined, token)); // seed yearly
  const res = await subPost(req("POST", { action: "switch", planKey: "weekly" }, token));
  const sub = (await res.json()).subscription;
  assert.equal(sub.planKey, "weekly");
  const days = Math.round((sub.currentPeriodEnd - Date.now()) / DAY_MS);
  assert.equal(days, PLANS.weekly.periodDays);
});

test("cancel keeps access until period end; resume clears the flag", async () => {
  const token = await tokenFor("u1", "m@x.com");
  const seeded = (await subGet(req("GET", undefined, token)).then((r) => r.json())).subscription;

  const canceled = (await subPost(req("POST", { action: "cancel" }, token)).then((r) => r.json())).subscription;
  assert.equal(canceled.cancelAtPeriodEnd, true);
  // Still active until the period lapses — access is not revoked immediately.
  assert.equal(canceled.status, "active");
  assert.equal(canceled.currentPeriodEnd, seeded.currentPeriodEnd);

  const resumed = (await subPost(req("POST", { action: "resume" }, token)).then((r) => r.json())).subscription;
  assert.equal(resumed.cancelAtPeriodEnd, false);
});

test("unknown action and unknown plan are rejected", async () => {
  const token = await tokenFor("u1", "m@x.com");
  assert.equal((await subPost(req("POST", { action: "explode" }, token))).status, 400);
  assert.equal((await subPost(req("POST", { action: "switch", planKey: "lifetime" }, token))).status, 400);
});
