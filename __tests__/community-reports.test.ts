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
