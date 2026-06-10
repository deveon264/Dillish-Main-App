import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads SESSION_SECRET lazily, so setting it before any handler runs
// is enough. A throwaway value for the test runtime.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";

import { mintSessionToken } from "@/lib/adminAuth";

import { POST as likePost } from "@/app/api/community-like+api";
import { POST as commentPost } from "@/app/api/community-comments+api";

import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

// AUTHOR owns the post; ACTOR is the member liking/commenting on it.
const AUTHOR = "author-1";
const ACTOR = "actor-1";

function seedActors() {
  db.seedUser({ id: AUTHOR, email: "author@example.com", name: "Ada" });
  db.seedUser({ id: ACTOR, email: "actor@example.com", name: "Ben" });
}

async function memberToken(sub: string, email: string): Promise<string> {
  const { token } = await mintSessionToken({ sub, email, isAdmin: false });
  return token;
}

function authed(url: string, token: string | null, body?: unknown): Request {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const init: RequestInit = { method: "POST", headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

// --- like endpoint fires a notification -----------------------------------

test("like endpoint notifies the post author with the liker as actor", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "leg day done" });
  const token = await memberToken(ACTOR, "actor@example.com");

  const res = await likePost(
    authed("http://t/api/community-like", token, { postId: post.id })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.liked, true);
  assert.equal(body.likeCount, 1);

  // Exactly one notification, addressed to the author, attributed to the actor.
  assert.equal(db.communityNotifications.length, 1);
  const n = db.communityNotifications[0];
  assert.equal(n.recipient_id, AUTHOR);
  assert.equal(n.actor_id, ACTOR);
  assert.equal(n.post_id, post.id);
  assert.equal(n.type, "like");
  assert.equal(n.read, false);
});

test("like endpoint does NOT notify when the author likes their own post", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "leg day done" });
  const token = await memberToken(AUTHOR, "author@example.com");

  const res = await likePost(
    authed("http://t/api/community-like", token, { postId: post.id })
  );
  assert.equal(res.status, 200);
  assert.equal((await res.json()).liked, true);

  assert.equal(db.communityNotifications.length, 0);
});

test("un-liking a post does NOT create a notification", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "leg day done" });
  const token = await memberToken(ACTOR, "actor@example.com");

  // First tap likes (one notification), second tap un-likes (no new one).
  await likePost(authed("http://t/api/community-like", token, { postId: post.id }));
  const res = await likePost(
    authed("http://t/api/community-like", token, { postId: post.id })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.liked, false);
  assert.equal(body.likeCount, 0);

  // The un-like added nothing: still exactly the one from the first like.
  assert.equal(db.communityNotifications.length, 1);
});

test("like endpoint requires a token (401, no notification)", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "leg day done" });

  const res = await likePost(
    authed("http://t/api/community-like", null, { postId: post.id })
  );
  assert.equal(res.status, 401);
  assert.equal(db.communityNotifications.length, 0);
});

// --- comment endpoint fires a notification --------------------------------

test("comment endpoint notifies the post author with the commenter as actor", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "leg day done" });
  const token = await memberToken(ACTOR, "actor@example.com");

  const res = await commentPost(
    authed("http://t/api/community-comments", token, { postId: post.id, text: "nice work!" })
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.comment.body, "nice work!");
  assert.equal(body.comment.author.id, ACTOR);

  assert.equal(db.communityNotifications.length, 1);
  const n = db.communityNotifications[0];
  assert.equal(n.recipient_id, AUTHOR);
  assert.equal(n.actor_id, ACTOR);
  assert.equal(n.post_id, post.id);
  assert.equal(n.type, "comment");
  assert.equal(n.read, false);
});

test("comment endpoint does NOT notify when the author comments on their own post", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "leg day done" });
  const token = await memberToken(AUTHOR, "author@example.com");

  const res = await commentPost(
    authed("http://t/api/community-comments", token, { postId: post.id, text: "thanks all" })
  );
  assert.equal(res.status, 201);

  assert.equal(db.communityNotifications.length, 0);
});

test("comment endpoint requires a token (401, no notification)", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "leg day done" });

  const res = await commentPost(
    authed("http://t/api/community-comments", null, { postId: post.id, text: "hi" })
  );
  assert.equal(res.status, 401);
  assert.equal(db.communityNotifications.length, 0);
});

test("comment on a missing post is a 404 and fires no notification", async () => {
  seedActors();
  const token = await memberToken(ACTOR, "actor@example.com");

  const res = await commentPost(
    authed("http://t/api/community-comments", token, { postId: "ghost-post", text: "hi" })
  );
  assert.equal(res.status, 404);
  assert.equal(db.communityNotifications.length, 0);
});

// --- both flows accumulate independent notifications ----------------------

test("a like and a comment from the same actor produce two distinct notifications", async () => {
  seedActors();
  const post = db.seedCommunityPost({ author_id: AUTHOR, body: "leg day done" });
  const token = await memberToken(ACTOR, "actor@example.com");

  await likePost(authed("http://t/api/community-like", token, { postId: post.id }));
  await commentPost(
    authed("http://t/api/community-comments", token, { postId: post.id, text: "great!" })
  );

  assert.equal(db.communityNotifications.length, 2);
  const types = db.communityNotifications.map((n) => n.type).sort();
  assert.deepEqual(types, ["comment", "like"]);
  // Both are addressed to the author and attributed to the actor.
  for (const n of db.communityNotifications) {
    assert.equal(n.recipient_id, AUTHOR);
    assert.equal(n.actor_id, ACTOR);
    assert.equal(n.post_id, post.id);
  }
});
