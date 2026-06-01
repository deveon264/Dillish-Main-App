import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads these lazily, so setting them before any handler runs is
// enough. Throwaway values for the test runtime only.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";
process.env.ADMIN_PASSCODE = "coach-passcode-123";

import { mintSessionToken } from "@/lib/adminAuth";
import { GET as profileGet, PATCH as profilePatch } from "@/app/api/profile+api";
import { DEFAULT_PROFILE } from "@/lib/profile";
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
  return new Request("http://t/api/profile", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function tokenFor(id: string, email: string, isAdmin = false): Promise<string> {
  db.seedUser({ id, email });
  const { token } = await mintSessionToken({ sub: id, email, isAdmin });
  return token;
}

test("GET and PATCH require a valid session", async () => {
  const getRes = await profileGet(req("GET"));
  assert.equal(getRes.status, 401);
  const patchRes = await profilePatch(req("PATCH", { age: 30 }));
  assert.equal(patchRes.status, 401);
});

test("a fresh account has no server profile yet", async () => {
  const token = await tokenFor("u1", "m@x.com");
  const res = await profileGet(req("GET", undefined, token));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.profile, null);
});

test("PATCH persists metrics and GET reads them back (survives a new 'login')", async () => {
  const token = await tokenFor("u1", "m@x.com");

  const patchRes = await profilePatch(
    req("PATCH", { age: 28, weight: 65, weightUnit: "kg", height: 168, goalWeight: 60, goals: ["lose-weight"] }, token)
  );
  assert.equal(patchRes.status, 200);
  const saved = (await patchRes.json()).profile;
  assert.equal(saved.age, 28);
  assert.equal(saved.weight, 65);
  assert.equal(saved.goalWeight, 60);
  assert.deepEqual(saved.goals, ["lose-weight"]);

  // A brand-new token for the same account (e.g. after re-login) reads the same
  // values straight from the server.
  const { token: token2 } = await mintSessionToken({ sub: "u1", email: "m@x.com", isAdmin: false });
  const getRes = await profileGet(req("GET", undefined, token2));
  const got = (await getRes.json()).profile;
  assert.equal(got.age, 28);
  assert.equal(got.height, 168);
  assert.deepEqual(got.goals, ["lose-weight"]);
});

test("PATCH merges over the existing profile without clobbering other fields", async () => {
  const token = await tokenFor("u1", "m@x.com");
  await profilePatch(req("PATCH", { age: 28, weight: 65 }, token));
  await profilePatch(req("PATCH", { goalWeight: 60 }, token));

  const got = (await profileGet(req("GET", undefined, token)).then((r) => r.json())).profile;
  assert.equal(got.age, 28);
  assert.equal(got.weight, 65);
  assert.equal(got.goalWeight, 60);
});

test("concurrent PATCHes on different fields both persist (no lost update)", async () => {
  const token = await tokenFor("u1", "m@x.com");

  // Fire both writes without awaiting in between; the server merge is a single
  // atomic jsonb statement, so neither should clobber the other's field.
  await Promise.all([
    profilePatch(req("PATCH", { age: 30 }, token)),
    profilePatch(req("PATCH", { goalWeight: 58 }, token)),
  ]);

  const got = (await profileGet(req("GET", undefined, token)).then((r) => r.json())).profile;
  assert.equal(got.age, 30);
  assert.equal(got.goalWeight, 58);
});

test("server clamps out-of-range values and drops garbage", async () => {
  const token = await tokenFor("u1", "m@x.com");
  const saved = (
    await profilePatch(
      req("PATCH", { waterGoalMl: 99999, calorieGoal: 1, age: -5, weight: 0, weightUnit: "stone" }, token)
    ).then((r) => r.json())
  ).profile;

  assert.equal(saved.waterGoalMl, 5000); // clamped to max
  assert.equal(saved.calorieGoal, 500); // clamped to min
  assert.equal(saved.age, DEFAULT_PROFILE.age); // -5 rejected -> base (null)
  assert.equal(saved.weight, DEFAULT_PROFILE.weight); // 0 rejected -> base (null)
  assert.equal(saved.weightUnit, "kg"); // bad unit -> base
});
