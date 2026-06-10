import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads SESSION_SECRET lazily, so setting it before any handler runs
// is enough. A throwaway value for the test runtime.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";

import { mintSessionToken } from "@/lib/adminAuth";

import {
  notifyPostAuthor,
  listNotifications,
  countUnreadNotifications,
  markNotificationsRead,
} from "@/lib/communityStore";
import {
  GET as notificationsGet,
  PATCH as notificationsPatch,
} from "@/app/api/community-notifications+api";

import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

// Two members: AUTHOR owns the posts, ACTOR is the one liking/commenting.
const AUTHOR = "author-1";
const ACTOR = "actor-1";
const OTHER = "other-1";

function seedActors() {
  db.seedUser({ id: AUTHOR, email: "author@example.com", name: "Ada" });
  db.seedUser({ id: ACTOR, email: "actor@example.com", name: "Ben" });
  db.seedUser({ id: OTHER, email: "other@example.com", name: "Cleo" });
}

// 90-day soft cap mirrored from communityStore.
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

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

// --- store: notifyPostAuthor ----------------------------------------------

test("notifyPostAuthor records a notification for the post's author", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "my progress" });

  await notifyPostAuthor({ postId: post.id, actorId: ACTOR, type: "like" });

  assert.equal(db.communityNotifications.length, 1);
  const n = db.communityNotifications[0];
  assert.equal(n.recipient_id, AUTHOR);
  assert.equal(n.actor_id, ACTOR);
  assert.equal(n.post_id, post.id);
  assert.equal(n.type, "like");
  assert.equal(n.read, false);
});

test("notifyPostAuthor skips the author's own like/comment", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "my progress" });

  // The author liking and commenting on their own post never notifies.
  await notifyPostAuthor({ postId: post.id, actorId: AUTHOR, type: "like" });
  await notifyPostAuthor({ postId: post.id, actorId: AUTHOR, type: "comment" });

  assert.equal(db.communityNotifications.length, 0);
});

test("notifyPostAuthor is a no-op when the post no longer exists", async () => {
  seedActors();
  await notifyPostAuthor({ postId: "missing-post", actorId: ACTOR, type: "comment" });
  assert.equal(db.communityNotifications.length, 0);
});

// --- store: listNotifications (90-day cap, excerpt, ordering, JOINs) -------

test("listNotifications returns the member's notifications newest-first", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "hi" });
  const t = 2_000_000_000_000;
  db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id, type: "like", created_at: t });
  db.seedNotification({ recipient_id: AUTHOR, actor_id: OTHER, post_id: post.id, type: "comment", created_at: t + 1000 });

  const list = await listNotifications({ recipientId: AUTHOR, limit: 60 });
  assert.equal(list.length, 2);
  // Newest first.
  assert.equal(list[0].actor.id, OTHER);
  assert.equal(list[0].type, "comment");
  assert.equal(list[1].actor.id, ACTOR);
  assert.equal(list[1].type, "like");
  // Live actor identity is JOINed, not snapshotted.
  assert.equal(list[0].actor.name, "Cleo");
});

test("listNotifications excludes rows older than the 90-day cap", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "hi" });
  const now = Date.now();
  const fresh = db.seedNotification({
    recipient_id: AUTHOR,
    actor_id: ACTOR,
    post_id: post.id,
    created_at: now - 1000,
  });
  // One millisecond past the cap: must be excluded.
  db.seedNotification({
    recipient_id: AUTHOR,
    actor_id: ACTOR,
    post_id: post.id,
    created_at: now - MAX_AGE_MS - 1,
  });

  const list = await listNotifications({ recipientId: AUTHOR, limit: 60 });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, fresh.id);
});

test("listNotifications truncates the post excerpt to 140 chars with an ellipsis", async () => {
  seedActors();
  const longBody = "x".repeat(200);
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: longBody });
  db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id });

  const list = await listNotifications({ recipientId: AUTHOR, limit: 60 });
  // 140 chars of body plus the "..." marker.
  assert.equal(list[0].postExcerpt, "x".repeat(140) + "...");
});

test("listNotifications keeps a short excerpt intact and collapses whitespace", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "  hello   there\nworld  " });
  db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id });

  const list = await listNotifications({ recipientId: AUTHOR, limit: 60 });
  assert.equal(list[0].postExcerpt, "hello there world");
});

test("listNotifications drops a row whose actor or post no longer exists", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "hi" });
  // Actor account gone (JOIN users fails).
  db.seedNotification({ recipient_id: AUTHOR, actor_id: "ghost-actor", post_id: post.id });
  // Post gone (JOIN community_posts fails).
  db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: "ghost-post" });

  const list = await listNotifications({ recipientId: AUTHOR, limit: 60 });
  assert.equal(list.length, 0);
});

test("listNotifications is scoped to the recipient", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "hi" });
  db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id });
  db.seedNotification({ recipient_id: OTHER, actor_id: ACTOR, post_id: post.id });

  const mine = await listNotifications({ recipientId: AUTHOR, limit: 60 });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].actor.id, ACTOR);
});

// --- store: countUnreadNotifications --------------------------------------

test("countUnreadNotifications counts only the recipient's unread, in-window rows", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "hi" });
  const now = Date.now();
  db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id, read: false, created_at: now });
  db.seedNotification({ recipient_id: AUTHOR, actor_id: OTHER, post_id: post.id, read: false, created_at: now });
  // Already read: not counted.
  db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id, read: true, created_at: now });
  // Past the 90-day cap: not counted.
  db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id, read: false, created_at: now - MAX_AGE_MS - 1 });
  // Belongs to another member: not counted.
  db.seedNotification({ recipient_id: OTHER, actor_id: ACTOR, post_id: post.id, read: false, created_at: now });

  assert.equal(await countUnreadNotifications(AUTHOR), 2);
  assert.equal(await countUnreadNotifications(OTHER), 1);
});

test("countUnreadNotifications is zero when there is nothing", async () => {
  seedActors();
  assert.equal(await countUnreadNotifications(AUTHOR), 0);
});

// --- store: markNotificationsRead -----------------------------------------

test("markNotificationsRead marks the given rows read and returns the count", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "hi" });
  const a = db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id });
  const b = db.seedNotification({ recipient_id: AUTHOR, actor_id: OTHER, post_id: post.id });

  const changed = await markNotificationsRead({ recipientId: AUTHOR, ids: [a.id, b.id] });
  assert.equal(changed, 2);
  assert.equal(await countUnreadNotifications(AUTHOR), 0);
});

test("markNotificationsRead only touches the member's own rows", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "hi" });
  const mine = db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id });
  const theirs = db.seedNotification({ recipient_id: OTHER, actor_id: ACTOR, post_id: post.id });

  // AUTHOR tries to mark OTHER's notification read too: only their own changes.
  const changed = await markNotificationsRead({ recipientId: AUTHOR, ids: [mine.id, theirs.id] });
  assert.equal(changed, 1);
  assert.equal(db.communityNotifications.find((n) => n.id === mine.id)?.read, true);
  assert.equal(db.communityNotifications.find((n) => n.id === theirs.id)?.read, false);
});

test("markNotificationsRead is idempotent and returns 0 when nothing changes", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "hi" });
  const a = db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id });

  assert.equal(await markNotificationsRead({ recipientId: AUTHOR, ids: [a.id] }), 1);
  // Second pass: already read, so no rows change.
  assert.equal(await markNotificationsRead({ recipientId: AUTHOR, ids: [a.id] }), 0);
  // Empty / unknown ids change nothing.
  assert.equal(await markNotificationsRead({ recipientId: AUTHOR, ids: [] }), 0);
  assert.equal(await markNotificationsRead({ recipientId: AUTHOR, ids: ["nope"] }), 0);
});

// --- endpoint: GET /api/community-notifications ----------------------------

test("notifications endpoint: missing token is rejected (401)", async () => {
  const res = await notificationsGet(authed("http://t/api/community-notifications", "GET", null));
  assert.equal(res.status, 401);
});

test("notifications endpoint: a member sees their notifications and unread count", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "great session" });
  db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id, read: false });
  db.seedNotification({ recipient_id: AUTHOR, actor_id: OTHER, post_id: post.id, read: true });
  const token = await memberToken(AUTHOR, "author@example.com");

  const res = await notificationsGet(authed("http://t/api/community-notifications", "GET", token));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.notifications.length, 2);
  assert.equal(body.unreadCount, 1);
});

// --- endpoint: PATCH /api/community-notifications --------------------------

test("notifications endpoint: missing token is rejected (401)", async () => {
  const res = await notificationsPatch(
    authed("http://t/api/community-notifications", "PATCH", null, { ids: ["x"] })
  );
  assert.equal(res.status, 401);
});

test("notifications endpoint: PATCH marks rows read and returns the fresh unread count", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "hi" });
  const a = db.seedNotification({ recipient_id: AUTHOR, actor_id: ACTOR, post_id: post.id });
  db.seedNotification({ recipient_id: AUTHOR, actor_id: OTHER, post_id: post.id });
  const token = await memberToken(AUTHOR, "author@example.com");

  const res = await notificationsPatch(
    authed("http://t/api/community-notifications", "PATCH", token, { ids: [a.id] })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.unreadCount, 1); // one still unread
});

test("notifications endpoint: PATCH with no ids is a 400", async () => {
  seedActors();
  const token = await memberToken(AUTHOR, "author@example.com");

  const res = await notificationsPatch(
    authed("http://t/api/community-notifications", "PATCH", token, { ids: [] })
  );
  assert.equal(res.status, 400);
});

test("notifications endpoint: PATCH cannot mark another member's notification", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "hi" });
  const theirs = db.seedNotification({ recipient_id: OTHER, actor_id: ACTOR, post_id: post.id });
  const token = await memberToken(AUTHOR, "author@example.com");

  // AUTHOR is signed in but passes OTHER's notification id: scoped out, no change.
  const res = await notificationsPatch(
    authed("http://t/api/community-notifications", "PATCH", token, { ids: [theirs.id] })
  );
  assert.equal(res.status, 200);
  assert.equal(db.communityNotifications.find((n) => n.id === theirs.id)?.read, false);
});
