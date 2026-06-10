import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { listPosts, getPost, toggleLike } from "@/lib/communityStore";

import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

// AUTHOR owns the post. FRIEND and BLOCKED each like and comment on it. VIEWER
// is the member reading the feed; in some tests VIEWER has blocked BLOCKED.
const VIEWER = "viewer-1";
const AUTHOR = "author-1";
const FRIEND = "friend-1";
const BLOCKED = "blocked-1";

function seedPostWithEngagement(): string {
  db.seedUser({ id: VIEWER, email: "viewer@example.com", name: "Vee" });
  db.seedUser({ id: AUTHOR, email: "author@example.com", name: "Ada" });
  db.seedUser({ id: FRIEND, email: "friend@example.com", name: "Fran" });
  db.seedUser({ id: BLOCKED, email: "blocked@example.com", name: "Boz" });

  const post = db.seedCommunityPost({ id: "post-1", author_id: AUTHOR, body: "leg day" });

  // Two likes and two comments: one each from FRIEND and BLOCKED.
  db.seedLike({ post_id: post.id, user_id: FRIEND });
  db.seedLike({ post_id: post.id, user_id: BLOCKED });
  db.seedComment({ post_id: post.id, author_id: FRIEND, body: "strong" });
  db.seedComment({ post_id: post.id, author_id: BLOCKED, body: "nice" });

  return post.id;
}

test("feed counts include everyone when the viewer has blocked no one", async () => {
  const id = seedPostWithEngagement();

  const [post] = await listPosts({ viewerId: VIEWER, limit: 20 });
  assert.equal(post.likeCount, 2);
  assert.equal(post.commentCount, 2);

  const detail = await getPost(id, VIEWER);
  assert.equal(detail?.likeCount, 2);
  assert.equal(detail?.commentCount, 2);
});

test("feed counts exclude a member the viewer has blocked", async () => {
  const id = seedPostWithEngagement();
  db.seedCommunityBlock({ blocker_id: VIEWER, blocked_id: BLOCKED });

  // The viewer no longer counts the blocked member's like or comment, matching
  // the comment list (which already hides the blocked member's comment).
  const [post] = await listPosts({ viewerId: VIEWER, limit: 20 });
  assert.equal(post.likeCount, 1);
  assert.equal(post.commentCount, 1);

  const detail = await getPost(id, VIEWER);
  assert.equal(detail?.likeCount, 1);
  assert.equal(detail?.commentCount, 1);
});

test("the block is per-viewer: another member still sees the full counts", async () => {
  seedPostWithEngagement();
  db.seedCommunityBlock({ blocker_id: VIEWER, blocked_id: BLOCKED });

  // FRIEND blocked no one, so their feed still counts the blocked member.
  const [post] = await listPosts({ viewerId: FRIEND, limit: 20 });
  assert.equal(post.likeCount, 2);
  assert.equal(post.commentCount, 2);
});

test("toggleLike returns a count that also excludes a blocked liker", async () => {
  const id = seedPostWithEngagement();
  db.seedCommunityBlock({ blocker_id: VIEWER, blocked_id: BLOCKED });

  // VIEWER likes the post: likers are now FRIEND, BLOCKED, VIEWER, but the
  // returned total drops BLOCKED, so the optimistic reconcile stays consistent
  // with the feed's like_count (FRIEND + VIEWER = 2).
  const res = await toggleLike({ postId: id, userId: VIEWER });
  assert.equal(res?.liked, true);
  assert.equal(res?.likeCount, 2);
});
