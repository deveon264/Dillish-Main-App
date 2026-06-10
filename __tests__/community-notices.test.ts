import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads SESSION_SECRET lazily, so setting it before any handler runs
// is enough. A throwaway value for the test runtime.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";

import { ADMIN_EMAIL } from "@/constants/admin";
import { mintSessionToken } from "@/lib/adminAuth";

import {
  warnUser,
  withdrawWarnings,
  hasActiveWarning,
  listNoticesForMember,
  acknowledgeNotice,
} from "@/lib/communityStore";
import {
  POST as warnPost,
  DELETE as warnDelete,
} from "@/app/api/community-author-warn+api";
import {
  GET as noticesGet,
  DELETE as noticesDelete,
} from "@/app/api/community-notices+api";

import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

// Two real member rows plus the admin, so the authed-endpoint tests use real
// users (per the "Testing authed community endpoints" pattern) even though the
// notice queries themselves do not JOIN users.
const ADMIN_ID = "admin-1";
const MEMBER_A = "member-a";
const MEMBER_B = "member-b";

function seedActors() {
  db.seedUser({ id: ADMIN_ID, email: ADMIN_EMAIL, name: "Admin", is_admin: true });
  db.seedUser({ id: MEMBER_A, email: "a@example.com", name: "Aja" });
  db.seedUser({ id: MEMBER_B, email: "b@example.com", name: "Bex" });
}

async function adminToken(): Promise<string> {
  const { token } = await mintSessionToken({ sub: ADMIN_ID, email: ADMIN_EMAIL, isAdmin: true });
  return token;
}

async function memberToken(sub: string, email: string): Promise<string> {
  const { token } = await mintSessionToken({ sub, email, isAdmin: false });
  return token;
}

function authed(url: string, method: string, token: string | null, body?: unknown): Request {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

// --- store: warnUser / hasActiveWarning -----------------------------------

test("warnUser creates an outstanding warning visible to the member", async () => {
  await warnUser({ userId: MEMBER_A, message: "Keep it civil please", warnedBy: ADMIN_ID });

  assert.equal(await hasActiveWarning(MEMBER_A), true);
  const notices = await listNoticesForMember(MEMBER_A);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].kind, "warning");
  assert.equal(notices[0].message, "Keep it civil please");
  // A different member is unaffected.
  assert.equal(await hasActiveWarning(MEMBER_B), false);
});

test("hasActiveWarning is false with no notices and after the warning is acknowledged", async () => {
  assert.equal(await hasActiveWarning(MEMBER_A), false);

  db.seedNotice({ user_id: MEMBER_A, message: "w", acknowledged_at: Date.now() });
  // An already-acknowledged warning does not count as active.
  assert.equal(await hasActiveWarning(MEMBER_A), false);
});

// --- store: withdrawWarnings ----------------------------------------------

test("withdrawWarnings removes all outstanding warnings and reports the count", async () => {
  db.seedNotice({ user_id: MEMBER_A, message: "one" });
  db.seedNotice({ user_id: MEMBER_A, message: "two" });

  const removed = await withdrawWarnings(MEMBER_A);
  assert.equal(removed, 2);
  assert.equal(await hasActiveWarning(MEMBER_A), false);
  assert.deepEqual(await listNoticesForMember(MEMBER_A), []);
});

test("withdrawWarnings leaves already-acknowledged warnings and other members untouched", async () => {
  const acked = db.seedNotice({ user_id: MEMBER_A, message: "old", acknowledged_at: Date.now() });
  db.seedNotice({ user_id: MEMBER_A, message: "fresh" });
  db.seedNotice({ user_id: MEMBER_B, message: "theirs" });

  const removed = await withdrawWarnings(MEMBER_A);
  assert.equal(removed, 1); // only the outstanding one for A
  // The acknowledged row survives; B's warning is untouched.
  assert.equal(db.notices.some((n) => n.id === acked.id), true);
  assert.equal(await hasActiveWarning(MEMBER_B), true);
});

test("withdrawWarnings returns 0 when there is nothing to withdraw", async () => {
  assert.equal(await withdrawWarnings(MEMBER_A), 0);
});

// --- store: listNoticesForMember (ordering) -------------------------------

test("listNoticesForMember orders block first, then un-acknowledged warnings newest-first", async () => {
  const t = 1_000_000;
  db.seedNotice({ user_id: MEMBER_A, message: "oldest", created_at: t });
  db.seedNotice({ user_id: MEMBER_A, message: "newest", created_at: t + 2000 });
  db.seedNotice({ user_id: MEMBER_A, message: "middle", created_at: t + 1000 });
  // An acknowledged warning must be excluded from the list entirely.
  db.seedNotice({ user_id: MEMBER_A, message: "dismissed", created_at: t + 3000, acknowledged_at: t + 4000 });
  db.seedAdminBlock({ user_id: MEMBER_A, created_at: t + 500 });

  const notices = await listNoticesForMember(MEMBER_A);
  assert.deepEqual(
    notices.map((n) => ({ id: n.id, kind: n.kind, message: n.message })),
    [
      { id: "block", kind: "block", message: notices[0].message },
      { id: notices[1].id, kind: "warning", message: "newest" },
      { id: notices[2].id, kind: "warning", message: "middle" },
      { id: notices[3].id, kind: "warning", message: "oldest" },
    ]
  );
  // The derived block notice carries the block's own timestamp.
  assert.equal(notices[0].createdAt, t + 500);
});

test("listNoticesForMember returns just the block notice when there are no warnings", async () => {
  db.seedAdminBlock({ user_id: MEMBER_A });
  const notices = await listNoticesForMember(MEMBER_A);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].id, "block");
  assert.equal(notices[0].kind, "block");
});

test("the block notice disappears the moment the admin block is removed", async () => {
  db.seedAdminBlock({ user_id: MEMBER_A });
  assert.equal((await listNoticesForMember(MEMBER_A))[0].id, "block");

  db.adminBlocks.delete(MEMBER_A);
  assert.deepEqual(await listNoticesForMember(MEMBER_A), []);
});

// --- store: acknowledgeNotice ---------------------------------------------

test("acknowledgeNotice dismisses the owner's own warning", async () => {
  const n = db.seedNotice({ user_id: MEMBER_A, message: "be nice" });

  const ok = await acknowledgeNotice({ userId: MEMBER_A, id: n.id });
  assert.equal(ok, true);
  assert.equal(await hasActiveWarning(MEMBER_A), false);
  assert.deepEqual(await listNoticesForMember(MEMBER_A), []);
});

test("acknowledgeNotice cannot dismiss another member's warning", async () => {
  const n = db.seedNotice({ user_id: MEMBER_A, message: "be nice" });

  // Member B tries to acknowledge A's notice: scoped by user_id, so it fails.
  const ok = await acknowledgeNotice({ userId: MEMBER_B, id: n.id });
  assert.equal(ok, false);
  // A's warning is still outstanding.
  assert.equal(await hasActiveWarning(MEMBER_A), true);
});

test("acknowledgeNotice is a no-op (false) for an already-acknowledged or missing notice", async () => {
  const n = db.seedNotice({ user_id: MEMBER_A, message: "be nice" });
  assert.equal(await acknowledgeNotice({ userId: MEMBER_A, id: n.id }), true);
  // Second time: already acknowledged.
  assert.equal(await acknowledgeNotice({ userId: MEMBER_A, id: n.id }), false);
  // Unknown id.
  assert.equal(await acknowledgeNotice({ userId: MEMBER_A, id: "does-not-exist" }), false);
});

test('the derived block notice (id "block") is not dismissable', async () => {
  db.seedAdminBlock({ user_id: MEMBER_A });

  const ok = await acknowledgeNotice({ userId: MEMBER_A, id: "block" });
  assert.equal(ok, false);
  // The block notice is still shown; it clears only when the admin unblocks.
  assert.equal((await listNoticesForMember(MEMBER_A))[0].id, "block");
});

// --- endpoint: POST /api/community-author-warn (send a warning) -----------

test("warn endpoint: missing token is rejected (401) and writes nothing", async () => {
  seedActors();
  const res = await warnPost(
    authed("http://t/api/community-author-warn", "POST", null, {
      authorId: MEMBER_A,
      message: "hi",
    })
  );
  assert.equal(res.status, 401);
  assert.equal(await hasActiveWarning(MEMBER_A), false);
});

test("warn endpoint: a member token is forbidden (403)", async () => {
  seedActors();
  const token = await memberToken(MEMBER_B, "b@example.com");
  const res = await warnPost(
    authed("http://t/api/community-author-warn", "POST", token, {
      authorId: MEMBER_A,
      message: "hi",
    })
  );
  assert.equal(res.status, 403);
  assert.equal(await hasActiveWarning(MEMBER_A), false);
});

test("warn endpoint: admin sends a warning the member can then see", async () => {
  seedActors();
  const token = await adminToken();
  const res = await warnPost(
    authed("http://t/api/community-author-warn", "POST", token, {
      authorId: MEMBER_A,
      message: "Please keep posts on topic",
    })
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const notices = await listNoticesForMember(MEMBER_A);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].message, "Please keep posts on topic");
});

test("warn endpoint: rejects an empty message and a self-warn", async () => {
  seedActors();
  const token = await adminToken();

  const noMsg = await warnPost(
    authed("http://t/api/community-author-warn", "POST", token, { authorId: MEMBER_A, message: "   " })
  );
  assert.equal(noMsg.status, 400);

  const selfWarn = await warnPost(
    authed("http://t/api/community-author-warn", "POST", token, { authorId: ADMIN_ID, message: "hi" })
  );
  assert.equal(selfWarn.status, 400);
  assert.equal(await hasActiveWarning(MEMBER_A), false);
});

// --- endpoint: DELETE /api/community-author-warn (withdraw) ----------------

test("warn endpoint: admin withdraws every outstanding warning", async () => {
  seedActors();
  db.seedNotice({ user_id: MEMBER_A, message: "one" });
  db.seedNotice({ user_id: MEMBER_A, message: "two" });
  const token = await adminToken();

  const res = await warnDelete(
    authed(`http://t/api/community-author-warn?authorId=${MEMBER_A}`, "DELETE", token)
  );
  assert.equal(res.status, 200);
  assert.equal(await hasActiveWarning(MEMBER_A), false);
});

test("warn endpoint: a member cannot withdraw warnings (403)", async () => {
  seedActors();
  db.seedNotice({ user_id: MEMBER_A, message: "one" });
  const token = await memberToken(MEMBER_A, "a@example.com");

  const res = await warnDelete(
    authed(`http://t/api/community-author-warn?authorId=${MEMBER_A}`, "DELETE", token)
  );
  assert.equal(res.status, 403);
  assert.equal(await hasActiveWarning(MEMBER_A), true);
});

// --- endpoint: GET /api/community-notices (member reads own notices) -------

test("notices endpoint: missing token is rejected (401)", async () => {
  const res = await noticesGet(authed("http://t/api/community-notices", "GET", null));
  assert.equal(res.status, 401);
});

test("notices endpoint: a member sees their own block + warnings", async () => {
  seedActors();
  db.seedAdminBlock({ user_id: MEMBER_A });
  db.seedNotice({ user_id: MEMBER_A, message: "warned" });
  const token = await memberToken(MEMBER_A, "a@example.com");

  const res = await noticesGet(authed("http://t/api/community-notices", "GET", token));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.notices[0].kind, "block");
  assert.equal(body.notices[1].kind, "warning");
  assert.equal(body.notices[1].message, "warned");
});

// --- endpoint: DELETE /api/community-notices (member dismisses) ------------

test("notices endpoint: a member dismisses their own warning", async () => {
  seedActors();
  const n = db.seedNotice({ user_id: MEMBER_A, message: "warned" });
  const token = await memberToken(MEMBER_A, "a@example.com");

  const res = await noticesDelete(
    authed(`http://t/api/community-notices?id=${n.id}`, "DELETE", token)
  );
  assert.equal(res.status, 200);
  assert.equal(await hasActiveWarning(MEMBER_A), false);
});

test("notices endpoint: a member cannot dismiss someone else's notice (404)", async () => {
  seedActors();
  const n = db.seedNotice({ user_id: MEMBER_A, message: "warned" });
  // Member B is signed in and tries to dismiss A's notice id.
  const token = await memberToken(MEMBER_B, "b@example.com");

  const res = await noticesDelete(
    authed(`http://t/api/community-notices?id=${n.id}`, "DELETE", token)
  );
  assert.equal(res.status, 404);
  assert.equal(await hasActiveWarning(MEMBER_A), true);
});

test("notices endpoint: missing id is a 400, unknown id is a 404", async () => {
  seedActors();
  const token = await memberToken(MEMBER_A, "a@example.com");

  const noId = await noticesDelete(authed("http://t/api/community-notices", "DELETE", token));
  assert.equal(noId.status, 400);

  const unknown = await noticesDelete(
    authed("http://t/api/community-notices?id=nope", "DELETE", token)
  );
  assert.equal(unknown.status, 404);
});
