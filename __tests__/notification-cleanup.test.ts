import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads SESSION_SECRET lazily, so setting it before any handler runs
// is enough. A throwaway value for the test runtime.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";

import { ADMIN_EMAIL } from "@/constants/admin";
import { mintSessionToken } from "@/lib/adminAuth";

import { runNotificationCleanup } from "@/app/api/notification-cleanup+api";
import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

// The endpoint deletes rows older than 90 days. It computes its own cutoff from
// the real Date.now(), so seed row ages relative to now: "OLD" rows are
// comfortably past the window (eligible for deletion) and "RECENT" rows are well
// within it (must be kept).
const DAY_MS = 24 * 60 * 60 * 1000;
const OLD = () => Date.now() - 120 * DAY_MS; // 120 days old -> delete
const RECENT = () => Date.now() - 1 * DAY_MS; // 1 day old -> keep

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

async function adminToken(): Promise<string> {
  const { token } = await mintSessionToken({
    sub: "test-admin",
    email: ADMIN_EMAIL,
    isAdmin: true,
  });
  return token;
}

function cleanupRequest(token: string | null, query = ""): Request {
  return new Request(`http://t/api/notification-cleanup${query}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

test("notification rows older than the window are deleted", async () => {
  const token = await adminToken();
  db.seedNotification({ recipient_id: "u1", created_at: OLD() });
  db.seedNotification({ recipient_id: "u2", created_at: OLD() });

  const res = await runNotificationCleanup(cleanupRequest(token));
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.scanned, 2);
  assert.equal(body.deleted, 2);
  assert.equal(body.maxAgeDays, 90);
  assert.equal(db.communityNotifications.length, 0);
});

test("recent notification rows are never deleted", async () => {
  const token = await adminToken();
  db.seedNotification({ recipient_id: "u1", created_at: RECENT() });

  const res = await runNotificationCleanup(cleanupRequest(token));
  const body = await res.json();

  assert.equal(body.scanned, 0);
  assert.equal(body.deleted, 0);
  assert.equal(db.communityNotifications.length, 1);
});

test("a mixed table deletes only the old rows and keeps recent ones", async () => {
  const token = await adminToken();
  db.seedNotification({ id: "old", recipient_id: "u1", created_at: OLD() });
  db.seedNotification({ id: "recent", recipient_id: "u1", created_at: RECENT() });

  const res = await runNotificationCleanup(cleanupRequest(token));
  const body = await res.json();

  assert.equal(body.deleted, 1);
  assert.equal(db.communityNotifications.length, 1);
  assert.equal(db.communityNotifications[0].id, "recent");
});

test("dryRun reports the eligible count without deleting anything", async () => {
  const token = await adminToken();
  db.seedNotification({ recipient_id: "u1", created_at: OLD() });
  db.seedNotification({ recipient_id: "u2", created_at: OLD() });

  const res = await runNotificationCleanup(cleanupRequest(token, "?dryRun=1"));
  const body = await res.json();

  assert.equal(body.dryRun, true);
  assert.equal(body.scanned, 2);
  assert.equal(body.deleted, 0);
  assert.equal(db.communityNotifications.length, 2);
});

test("a request without an admin token is rejected (403) and deletes nothing", async () => {
  db.seedNotification({ recipient_id: "u1", created_at: OLD() });

  const res = await runNotificationCleanup(cleanupRequest(null));
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "Not authorized" });

  assert.equal(db.communityNotifications.length, 1);
});
