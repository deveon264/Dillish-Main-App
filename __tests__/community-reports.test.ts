import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  listReports,
  dismissReportsForPost,
  reportPost,
} from "@/lib/communityStore";
import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

// The moderation queue collapses every report of a post into one review item
// (listReports), orders groups and the reporters within them newest-first, and
// dismisses all of a post's reports at once (dismissReportsForPost). These tests
// exercise that JS grouping/ordering against an in-memory pool whose rows mirror
// the real INNER JOINs (post + author + reporter) the query relies on.

const ADMIN_ID = "admin-1";

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

test("several reports of one post collapse into a single group, newest first", async () => {
  db.seedUser({ id: "author", email: "author@example.com", name: "Author" });
  db.seedUser({ id: "rep-a", email: "a@example.com", name: "Reporter A" });
  db.seedUser({ id: "rep-b", email: "b@example.com", name: "Reporter B" });
  db.seedUser({ id: "rep-c", email: "c@example.com", name: "Reporter C" });
  db.seedCommunityPost({ id: "post-x", author_id: "author", body: "hi" });

  // Three reports of the SAME post, filed at increasing times. Seeded out of
  // order to prove the result is sorted by time, not insertion order.
  db.seedReport({ id: "r-mid", post_id: "post-x", reporter_id: "rep-b", created_at: 200 });
  db.seedReport({ id: "r-old", post_id: "post-x", reporter_id: "rep-a", created_at: 100 });
  db.seedReport({ id: "r-new", post_id: "post-x", reporter_id: "rep-c", created_at: 300 });

  const groups = await listReports({ viewerId: ADMIN_ID, limit: 100 });

  assert.equal(groups.length, 1, "all reports of one post form one group");
  const g = groups[0];
  assert.equal(g.post.id, "post-x");
  assert.equal(g.reportCount, 3);
  assert.equal(g.latestCreatedAt, 300, "labelled by the newest report time");
  assert.equal(g.authorReportCount, 3);

  // Reporters within the group are newest-first.
  assert.deepEqual(
    g.reports.map((r) => r.reporter.id),
    ["rep-c", "rep-b", "rep-a"]
  );
  assert.deepEqual(
    g.reports.map((r) => r.createdAt),
    [300, 200, 100]
  );
});

test("groups for different posts are ordered by their newest report", async () => {
  db.seedUser({ id: "author", email: "author@example.com", name: "Author" });
  db.seedUser({ id: "rep-a", email: "a@example.com", name: "Reporter A" });
  db.seedUser({ id: "rep-b", email: "b@example.com", name: "Reporter B" });
  db.seedCommunityPost({ id: "post-old", author_id: "author", body: "old" });
  db.seedCommunityPost({ id: "post-new", author_id: "author", body: "new" });

  // post-old's freshest report (150) is still older than post-new's (250), so
  // post-new must lead even though post-old also has an older report.
  db.seedReport({ post_id: "post-old", reporter_id: "rep-a", created_at: 50 });
  db.seedReport({ post_id: "post-old", reporter_id: "rep-b", created_at: 150 });
  db.seedReport({ post_id: "post-new", reporter_id: "rep-a", created_at: 250 });

  const groups = await listReports({ viewerId: ADMIN_ID, limit: 100 });

  assert.deepEqual(
    groups.map((g) => g.post.id),
    ["post-new", "post-old"]
  );
  assert.equal(groups[0].reportCount, 1);
  assert.equal(groups[1].reportCount, 2);
  assert.equal(groups[1].latestCreatedAt, 150);
});

test("dismissReportsForPost removes every report for the post and returns the count", async () => {
  db.seedUser({ id: "author", email: "author@example.com", name: "Author" });
  db.seedUser({ id: "rep-a", email: "a@example.com", name: "Reporter A" });
  db.seedUser({ id: "rep-b", email: "b@example.com", name: "Reporter B" });
  db.seedCommunityPost({ id: "post-x", author_id: "author", body: "target" });
  db.seedCommunityPost({ id: "post-y", author_id: "author", body: "other" });

  db.seedReport({ post_id: "post-x", reporter_id: "rep-a", created_at: 100 });
  db.seedReport({ post_id: "post-x", reporter_id: "rep-b", created_at: 200 });
  db.seedReport({ post_id: "post-y", reporter_id: "rep-a", created_at: 300 });

  const dismissed = await dismissReportsForPost("post-x");

  assert.equal(dismissed, 2, "both reports of post-x were cleared");
  // The post itself is untouched.
  assert.equal(db.communityPosts.some((p) => p.id === "post-x"), true);
  // Only post-x's reports are gone; post-y's report survives.
  assert.deepEqual(
    db.communityReports.map((r) => r.post_id),
    ["post-y"]
  );

  // The queue now shows only post-y.
  const groups = await listReports({ viewerId: ADMIN_ID, limit: 100 });
  assert.deepEqual(
    groups.map((g) => g.post.id),
    ["post-y"]
  );
});

test("dismissReportsForPost returns 0 when the post has no reports", async () => {
  db.seedUser({ id: "author", email: "author@example.com", name: "Author" });
  db.seedCommunityPost({ id: "post-x", author_id: "author", body: "clean" });

  const dismissed = await dismissReportsForPost("post-x");
  assert.equal(dismissed, 0);
});

test("authorReportCount sums an author's reports across all their posts", async () => {
  db.seedUser({ id: "author", email: "author@example.com", name: "Author" });
  db.seedUser({ id: "clean", email: "clean@example.com", name: "Clean Author" });
  db.seedUser({ id: "rep-a", email: "a@example.com", name: "Reporter A" });
  db.seedUser({ id: "rep-b", email: "b@example.com", name: "Reporter B" });

  // "author" has two reported posts; "clean" has one.
  db.seedCommunityPost({ id: "post-1", author_id: "author", body: "one" });
  db.seedCommunityPost({ id: "post-2", author_id: "author", body: "two" });
  db.seedCommunityPost({ id: "post-3", author_id: "clean", body: "three" });

  // post-1: two reports, post-2: one report -> author has 3 reports total.
  db.seedReport({ post_id: "post-1", reporter_id: "rep-a", created_at: 100 });
  db.seedReport({ post_id: "post-1", reporter_id: "rep-b", created_at: 200 });
  db.seedReport({ post_id: "post-2", reporter_id: "rep-a", created_at: 300 });
  // post-3 (different author): one report -> that author has 1.
  db.seedReport({ post_id: "post-3", reporter_id: "rep-b", created_at: 400 });

  const groups = await listReports({ viewerId: ADMIN_ID, limit: 100 });
  const byPost = new Map(groups.map((g) => [g.post.id, g]));

  // Every group for "author" reports the author-wide total (3), not just the
  // count of reports grouped under that single post.
  assert.equal(byPost.get("post-1")!.reportCount, 2);
  assert.equal(byPost.get("post-1")!.authorReportCount, 3);
  assert.equal(byPost.get("post-2")!.reportCount, 1);
  assert.equal(byPost.get("post-2")!.authorReportCount, 3);
  // The other author's count is scoped to their own posts only.
  assert.equal(byPost.get("post-3")!.authorReportCount, 1);
});

test("authorBlocked reflects a global admin block on the post's author", async () => {
  db.seedUser({ id: "blocked", email: "blocked@example.com", name: "Blocked" });
  db.seedUser({ id: "ok", email: "ok@example.com", name: "OK" });
  db.seedUser({ id: "rep-a", email: "a@example.com", name: "Reporter A" });
  db.seedCommunityPost({ id: "post-blocked", author_id: "blocked", body: "x" });
  db.seedCommunityPost({ id: "post-ok", author_id: "ok", body: "y" });
  db.seedReport({ post_id: "post-blocked", reporter_id: "rep-a", created_at: 100 });
  db.seedReport({ post_id: "post-ok", reporter_id: "rep-a", created_at: 200 });

  // A global admin block exists only for "blocked".
  db.seedAdminBlock({ user_id: "blocked", blocked_by: ADMIN_ID, created_at: 50 });

  const groups = await listReports({ viewerId: ADMIN_ID, limit: 100 });
  const byPost = new Map(groups.map((g) => [g.post.id, g]));

  assert.equal(byPost.get("post-blocked")!.authorBlocked, true);
  assert.equal(byPost.get("post-ok")!.authorBlocked, false);
});

test("authorWarned is true only while a warning is unacknowledged", async () => {
  db.seedUser({ id: "warned", email: "warned@example.com", name: "Warned" });
  db.seedUser({ id: "acked", email: "acked@example.com", name: "Acked" });
  db.seedUser({ id: "clean", email: "clean@example.com", name: "Clean" });
  db.seedUser({ id: "rep-a", email: "a@example.com", name: "Reporter A" });
  db.seedCommunityPost({ id: "post-warned", author_id: "warned", body: "x" });
  db.seedCommunityPost({ id: "post-acked", author_id: "acked", body: "y" });
  db.seedCommunityPost({ id: "post-clean", author_id: "clean", body: "z" });
  db.seedReport({ post_id: "post-warned", reporter_id: "rep-a", created_at: 100 });
  db.seedReport({ post_id: "post-acked", reporter_id: "rep-a", created_at: 200 });
  db.seedReport({ post_id: "post-clean", reporter_id: "rep-a", created_at: 300 });

  // "warned" has an outstanding warning; "acked" already acknowledged theirs;
  // "clean" has none.
  db.seedNotice({ user_id: "warned", kind: "warning", acknowledged_at: null });
  db.seedNotice({ user_id: "acked", kind: "warning", acknowledged_at: 999 });

  const groups = await listReports({ viewerId: ADMIN_ID, limit: 100 });
  const byPost = new Map(groups.map((g) => [g.post.id, g]));

  assert.equal(byPost.get("post-warned")!.authorWarned, true);
  assert.equal(byPost.get("post-acked")!.authorWarned, false);
  assert.equal(byPost.get("post-clean")!.authorWarned, false);
});

test("reportPost records a report only when the post exists", async () => {
  db.seedUser({ id: "author", email: "author@example.com", name: "Author" });
  db.seedUser({ id: "rep-a", email: "a@example.com", name: "Reporter A" });
  db.seedCommunityPost({ id: "post-x", author_id: "author", body: "real" });

  const ok = await reportPost({ postId: "post-x", reporterId: "rep-a", reason: "spam" });
  assert.equal(ok, true);
  assert.equal(db.communityReports.length, 1);

  const missing = await reportPost({
    postId: "ghost",
    reporterId: "rep-a",
    reason: "spam",
  });
  assert.equal(missing, false, "a report against a missing post is dropped");
  assert.equal(db.communityReports.length, 1);
});
