import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-session-secret-please-ignore";

import { ADMIN_EMAIL } from "@/constants/admin";
import { mintSessionToken } from "@/lib/adminAuth";
import { listActiveToday, listPinned, listPosts, setPinned } from "@/lib/communityStore";
import { GET as activeTodayGet } from "@/app/api/community-active-today+api";
import { POST as pinPost } from "@/app/api/community-pin+api";

import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

const ADMIN_ID = "admin-1";
const VIEWER = "viewer-1";
const A = "member-a";
const B = "member-b";
const BLOCKED = "blocked-1";
const ADMIN_BLOCKED = "admin-blocked-1";

function seedMembers() {
  db.seedUser({ id: ADMIN_ID, email: ADMIN_EMAIL, name: "Dillish", is_admin: true });
  db.seedUser({ id: VIEWER, email: "viewer@example.com", name: "Viewer" });
  db.seedUser({ id: A, email: "a@example.com", name: "Aja" });
  db.seedUser({ id: B, email: "b@example.com", name: "Bex" });
  db.seedUser({ id: BLOCKED, email: "blocked@example.com", name: "Bea" });
  db.seedUser({ id: ADMIN_BLOCKED, email: "admin-blocked@example.com", name: "Ada" });
}

async function adminToken(): Promise<string> {
  const { token } = await mintSessionToken({ sub: ADMIN_ID, email: ADMIN_EMAIL, isAdmin: true });
  return token;
}

async function memberToken(sub = VIEWER, email = "viewer@example.com"): Promise<string> {
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

test("pin endpoint requires an admin token", async () => {
  seedMembers();
  db.seedCommunityPost({ id: "post-1", author_id: ADMIN_ID, body: "hello" });

  const member = await memberToken();
  const res = await pinPost(authed("http://t/api/community-pin", "POST", member, { postId: "post-1" }));

  assert.equal(res.status, 403);
  assert.equal(db.communityPosts.find((p) => p.id === "post-1")?.pinned, false);
});

test("pinning one post unpins the previous highlight", async () => {
  seedMembers();
  db.seedCommunityPost({ id: "post-1", author_id: ADMIN_ID, body: "first", created_at: 1000 });
  db.seedCommunityPost({ id: "post-2", author_id: ADMIN_ID, body: "second", created_at: 2000 });

  const token = await adminToken();
  assert.equal((await pinPost(authed("http://t/api/community-pin", "POST", token, { postId: "post-1" }))).status, 200);
  assert.equal((await pinPost(authed("http://t/api/community-pin", "POST", token, { postId: "post-2" }))).status, 200);

  assert.equal(db.communityPosts.find((p) => p.id === "post-1")?.pinned, false);
  assert.equal(db.communityPosts.find((p) => p.id === "post-2")?.pinned, true);
});

test("pinned posts are returned separately and excluded from the normal feed", async () => {
  seedMembers();
  db.seedCommunityPost({ id: "regular", author_id: A, body: "normal", created_at: 3000 });
  db.seedCommunityPost({ id: "pinned", author_id: ADMIN_ID, body: "trainer note", created_at: 2000, pinned: true });

  const feed = await listPosts({ viewerId: VIEWER, limit: 20 });
  const pinned = await listPinned(VIEWER);

  assert.deepEqual(feed.map((p) => p.id), ["regular"]);
  assert.deepEqual(pinned.map((p) => p.id), ["pinned"]);
  assert.equal(pinned[0].pinned, true);
});

test("setPinned returns false for a missing post without clearing the existing pin", async () => {
  seedMembers();
  db.seedCommunityPost({ id: "pinned", author_id: ADMIN_ID, body: "trainer note", pinned: true });

  assert.equal(await setPinned({ id: "missing", pinned: true }), false);
  assert.equal(db.communityPosts.find((p) => p.id === "pinned")?.pinned, true);
});

test("active today counts distinct visible members only", async () => {
  seedMembers();
  db.seedCommunityBlock({ blocker_id: VIEWER, blocked_id: BLOCKED });
  db.seedAdminBlock({ user_id: ADMIN_BLOCKED });

  db.seedCommunityPost({ id: "a-post", author_id: A, created_at: 2000 });
  db.seedLike({ post_id: "a-post", user_id: B, created_at: 2500 });
  db.seedComment({ post_id: "a-post", author_id: B, created_at: 3500 });
  db.seedCommunityPost({ id: "viewer-post", author_id: VIEWER, created_at: 4000 });
  db.seedCommunityPost({ id: "blocked-post", author_id: BLOCKED, created_at: 4500 });
  db.seedCommunityPost({ id: "admin-blocked-post", author_id: ADMIN_BLOCKED, created_at: 5000 });
  db.seedCommunityPost({ id: "old-post", author_id: ADMIN_ID, created_at: 500 });

  const active = await listActiveToday({ viewerId: VIEWER, sinceMs: 1000, avatarLimit: 5 });

  assert.equal(active.count, 2);
  assert.deepEqual(active.members.map((m) => m.id), [B, A]);
});

test("active today endpoint requires an authenticated member", async () => {
  const res = await activeTodayGet(authed("http://t/api/community-active-today", "GET", null));
  assert.equal(res.status, 401);
});