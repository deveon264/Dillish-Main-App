import type { Pool } from "pg";

import { __setPoolForTests } from "@/lib/db";

// A tiny in-memory stand-in for the Postgres pool used by lib/userStore and the
// app_settings helpers. It understands only the handful of SQL statements those
// modules issue, so the auth routes can be exercised end-to-end without a real
// database. Installing a fake also marks the schema as ready (see
// __setPoolForTests), so no CREATE TABLE statements are needed here.

export type Row = Record<string, any>;

export type FakeDb = {
  users: Map<string, Row>;
  settings: Map<string, string>;
  exercises: Row[];
  communityPosts: Row[];
  communityReports: Row[];
  communityLikes: Row[];
  communityComments: Row[];
  communityBlocks: Row[];
  communityNotifications: Row[];
  notices: Row[];
  adminBlocks: Map<string, Row>;
  pushTokens: Map<string, Row>;
  seedUser: (u: Partial<Row> & { id: string; email: string }) => Row;
  seedExercise: (
    e: Partial<Row> & { video_object_path: string }
  ) => Row;
  seedCommunityPost: (
    p: Partial<Row> & { photo_object_path?: string | null }
  ) => Row;
  seedReport: (
    r: Partial<Row> & { post_id: string; reporter_id: string }
  ) => Row;
  seedLike: (l: Partial<Row> & { post_id: string; user_id: string }) => Row;
  seedComment: (
    c: Partial<Row> & { post_id: string; author_id: string }
  ) => Row;
  seedNotification: (
    n: Partial<Row> & { recipient_id: string }
  ) => Row;
  seedNotice: (n: Partial<Row> & { user_id: string }) => Row;
  seedAdminBlock: (b: Partial<Row> & { user_id: string }) => Row;
  seedCommunityBlock: (
    b: Partial<Row> & { blocker_id: string; blocked_id: string }
  ) => Row;
  seedPushToken: (p: Partial<Row> & { token: string; user_id: string }) => Row;
};

function dupKeyError(): Error & { code: string } {
  const e = new Error("duplicate key value violates unique constraint") as Error & {
    code: string;
  };
  e.code = "23505";
  return e;
}

// Parses the SET clause of an UPDATE into per-column assignments. Each column is
// set either from a positional parameter (`col = $n`) or to a literal NULL
// (`col = NULL`), so the avatar updates (which null out columns) apply correctly.
type SetAssignment =
  | { col: string; kind: "param"; idx: number }
  | { col: string; kind: "null" };

function setAssignments(text: string): SetAssignment[] {
  const setPart = text.split(/\bSET\b/i)[1].split(/\bWHERE\b/i)[0];
  return setPart.split(",").map((part) => {
    const m = /(\w+)\s*=\s*(\$(\d+)|NULL)/i.exec(part);
    if (!m) throw new Error(`fakeUserDb: cannot parse assignment: ${part.trim()}`);
    if (m[2].startsWith("$")) {
      return { col: m[1], kind: "param", idx: Number(m[3]) - 1 };
    }
    return { col: m[1], kind: "null" };
  });
}

// Builds a fresh in-memory db, installs it as the active pool, and returns
// handles so tests can seed and inspect rows.
export function installFakeDb(): FakeDb {
  const users = new Map<string, Row>();
  const settings = new Map<string, string>();
  const exercises: Row[] = [];
  const communityPosts: Row[] = [];
  const communityReports: Row[] = [];
  const communityLikes: Row[] = [];
  const communityComments: Row[] = [];
  const communityBlocks: Row[] = [];
  const communityNotifications: Row[] = [];
  const notices: Row[] = [];
  const adminBlocks = new Map<string, Row>();
  const pushTokens = new Map<string, Row>();

  async function query(
    text: string,
    params: any[] = []
  ): Promise<{ rows: Row[]; rowCount?: number }> {
    const sql = text.trim();

    // --- community_reports (moderation queue grouping + dismiss-by-post) -----
    // Insert mirrors reportPost(): the report is only recorded when its post
    // exists (INSERT ... SELECT ... WHERE EXISTS).
    if (/INSERT\s+INTO\s+community_reports/i.test(sql)) {
      const [id, postId, reporterId, reason, created_at] = params;
      if (!communityPosts.some((p) => p.id === postId)) return { rows: [], rowCount: 0 };
      communityReports.push({
        id,
        post_id: postId,
        reporter_id: reporterId,
        reason,
        created_at,
      });
      return { rows: [], rowCount: 1 };
    }
    // Dismiss-all-by-post: delete every report row for a post, report the count.
    if (/DELETE\s+FROM\s+community_reports/i.test(sql)) {
      const postId = params[0];
      const before = communityReports.length;
      for (let i = communityReports.length - 1; i >= 0; i--) {
        if (communityReports[i].post_id === postId) communityReports.splice(i, 1);
      }
      return { rows: [], rowCount: before - communityReports.length };
    }
    // The grouped moderation read. listReports JOINs each report to its live
    // post, the post's author, and the reporter (all INNER JOINs), ordered
    // newest report first (created_at DESC, id DESC). We mirror that shape so
    // the JS grouping/ordering in listReports is exercised verbatim.
    if (/FROM\s+community_reports\s+r/i.test(sql)) {
      const sorted = [...communityReports].sort((a, b) => {
        if (b.created_at !== a.created_at) return b.created_at - a.created_at;
        return a.id < b.id ? 1 : a.id > b.id ? -1 : 0; // id DESC
      });
      const rows: Row[] = [];
      for (const rep of sorted) {
        const post = communityPosts.find((p) => p.id === rep.post_id);
        if (!post) continue; // JOIN community_posts
        const author = users.get(post.author_id);
        const reporter = users.get(rep.reporter_id);
        if (!author || !reporter) continue; // JOIN users (author + reporter)
        const authorReportCount = communityReports.filter((r2) => {
          const p2 = communityPosts.find((p) => p.id === r2.post_id);
          return !!p2 && p2.author_id === post.author_id;
        }).length;
        // author_blocked / author_warned mirror the SQL subqueries: a global
        // admin block row for the author, and any outstanding (un-acknowledged)
        // 'warning' notice for the author.
        const authorBlocked = adminBlocks.has(post.author_id);
        const authorWarned = notices.some(
          (n) =>
            n.user_id === post.author_id &&
            n.kind === "warning" &&
            n.acknowledged_at == null
        );
        // like_count / comment_count / liked_by_me mirror the scalar subqueries
        // in listReports: counts over community_likes/community_comments for the
        // post, and whether the viewer ($1) is among the post's likers.
        const viewerId = params[0];
        const likeCount = communityLikes.filter((l) => l.post_id === post.id).length;
        const commentCount = communityComments.filter(
          (c) => c.post_id === post.id
        ).length;
        const likedByMe = communityLikes.some(
          (l) => l.post_id === post.id && l.user_id === viewerId
        );
        rows.push({
          report_id: rep.id,
          report_reason: rep.reason ?? null,
          report_created_at: rep.created_at,
          reporter_id: reporter.id,
          reporter_name: reporter.name,
          reporter_avatar:
            reporter.avatar_object_path == null ? (reporter.avatar ?? null) : null,
          reporter_avatar_path: reporter.avatar_object_path ?? null,
          id: post.id,
          type: post.type ?? "progress",
          body: post.body ?? "",
          photo_object_path: post.photo_object_path ?? null,
          created_at: post.created_at,
          author_id: author.id,
          author_name: author.name,
          author_avatar:
            author.avatar_object_path == null ? (author.avatar ?? null) : null,
          author_avatar_path: author.avatar_object_path ?? null,
          like_count: likeCount,
          comment_count: commentCount,
          liked_by_me: likedByMe,
          author_report_count: authorReportCount,
          author_blocked: authorBlocked,
          author_warned: authorWarned,
        });
      }
      return { rows };
    }

    // --- exercises (media paths the cleanup sweep reconciles against) -------
    if (/FROM\s+exercises/i.test(sql)) {
      return {
        rows: exercises.map((e) => ({
          video_object_path: e.video_object_path,
          poster_object_path: e.poster_object_path ?? null,
        })),
      };
    }

    // --- community_notifications (in-app like/comment inbox + age sweep) ----
    // Checked before the generic community_posts handler because the inbox read
    // JOINs community_posts, and before getPostMeta for the same reason. Also
    // serves the scheduled age-based cleanup (DELETE / COUNT on created_at < $1).
    if (/community_notifications/i.test(sql)) {
      if (/DELETE\s+FROM\s+community_notifications/i.test(sql)) {
        // scheduled age-based sweep: DELETE ... WHERE created_at < $1
        const cutoff = params[0];
        const before = communityNotifications.length;
        for (let i = communityNotifications.length - 1; i >= 0; i--) {
          if (communityNotifications[i].created_at < cutoff) {
            communityNotifications.splice(i, 1);
          }
        }
        return { rows: [], rowCount: before - communityNotifications.length };
      }
      if (/INSERT\s+INTO\s+community_notifications/i.test(sql)) {
        // notifyPostAuthor column order: id, recipient_id, actor_id, post_id,
        // type, created_at (read is the literal FALSE in the INSERT).
        const [id, recipient_id, actor_id, post_id, type, created_at] = params;
        communityNotifications.push({
          id,
          recipient_id,
          actor_id,
          post_id,
          type,
          read: false,
          created_at,
        });
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE\s+community_notifications/i.test(sql)) {
        // markNotificationsRead: SET read = TRUE
        //   WHERE recipient_id = $1 AND read = FALSE AND id = ANY($2::text[])
        const [recipientId, ids] = params as [string, string[]];
        let updated = 0;
        for (const n of communityNotifications) {
          if (n.recipient_id === recipientId && !n.read && ids.includes(n.id)) {
            n.read = true;
            updated++;
          }
        }
        return { rows: [], rowCount: updated };
      }
      if (/COUNT\(\*\)/i.test(sql)) {
        if (/recipient_id/i.test(sql)) {
          // countUnreadNotifications: recipient_id = $1 AND read = FALSE
          //   AND created_at >= $2 (the 90-day soft cap).
          const [recipientId, since] = params as [string, number];
          const n = communityNotifications.filter(
            (x) => x.recipient_id === recipientId && !x.read && x.created_at >= since
          ).length;
          return { rows: [{ n }] };
        }
        // scheduled age-based sweep dry run: COUNT(*) WHERE created_at < $1
        const cutoff = params[0];
        const n = communityNotifications.filter((r) => r.created_at < cutoff).length;
        return { rows: [{ n: String(n) }] };
      }
      // listNotifications: JOIN users (actor) + community_posts (body), drop a
      // row whose actor or post no longer exists, newest first, capped.
      const [recipientId, since, limit] = params as [string, number, number];
      const matching = communityNotifications.filter(
        (x) => x.recipient_id === recipientId && x.created_at >= since
      );
      const joined: { n: Row; actor: Row; post: Row }[] = [];
      for (const n of matching) {
        const actor = users.get(n.actor_id);
        const post = communityPosts.find((p) => p.id === n.post_id);
        if (!actor || !post) continue; // INNER JOINs
        joined.push({ n, actor, post });
      }
      joined.sort((a, b) => {
        if (b.n.created_at !== a.n.created_at) return b.n.created_at - a.n.created_at;
        return a.n.id < b.n.id ? 1 : a.n.id > b.n.id ? -1 : 0; // id DESC
      });
      const rows = joined.slice(0, limit).map(({ n, actor, post }) => ({
        id: n.id,
        type: n.type,
        post_id: n.post_id,
        read: n.read,
        created_at: n.created_at,
        author_id: actor.id,
        author_name: actor.name,
        author_avatar: actor.avatar_object_path == null ? (actor.avatar ?? null) : null,
        author_avatar_path: actor.avatar_object_path ?? null,
        post_body: post.body ?? "",
      }));
      return { rows };
    }

    // getPostMeta: a single post's id/author/photo, used by notifyPostAuthor
    // and toggleLike. Must precede the generic community_posts handler, which
    // ignores the WHERE id filter.
    if (/SELECT\s+id,\s*author_id,\s*photo_object_path\s+FROM\s+community_posts/i.test(sql)) {
      const post = communityPosts.find((p) => p.id === params[0]);
      return {
        rows: post
          ? [
              {
                id: post.id,
                author_id: post.author_id,
                photo_object_path: post.photo_object_path ?? null,
              },
            ]
          : [],
      };
    }

    // The member feed / single-post read (listPosts + getPost share POST_SELECT).
    // $1 is the viewer; like_count and comment_count exclude likes/comments from
    // members the viewer has blocked, mirroring the scalar subqueries. Must
    // precede the community_likes / community_comments handlers because those
    // subqueries name those tables. getPost adds `WHERE p.id = $2`; listPosts
    // drops blocked + admin-blocked authors, applies an optional type and keyset
    // cursor, orders newest-first, and limits.
    if (/FROM\s+community_posts\s+p\b/i.test(sql) && /liked_by_me/i.test(sql)) {
      const viewerId = params[0];
      const buildRow = (post: Row): Row => {
        const author = users.get(post.author_id)!;
        const likeCount = communityLikes.filter(
          (l) =>
            l.post_id === post.id &&
            !communityBlocks.some(
              (b) => b.blocker_id === viewerId && b.blocked_id === l.user_id
            )
        ).length;
        const commentCount = communityComments.filter(
          (c) =>
            c.post_id === post.id &&
            !communityBlocks.some(
              (b) => b.blocker_id === viewerId && b.blocked_id === c.author_id
            )
        ).length;
        const likedByMe = communityLikes.some(
          (l) => l.post_id === post.id && l.user_id === viewerId
        );
        return {
          id: post.id,
          type: post.type ?? "progress",
          body: post.body ?? "",
          photo_object_path: post.photo_object_path ?? null,
          created_at: post.created_at,
          author_id: author.id,
          author_name: author.name,
          author_avatar:
            author.avatar_object_path == null ? (author.avatar ?? null) : null,
          author_avatar_path: author.avatar_object_path ?? null,
          like_count: likeCount,
          comment_count: commentCount,
          liked_by_me: likedByMe,
        };
      };

      // getPost: WHERE p.id = $2 (returns the post regardless of blocks).
      if (/WHERE\s+p\.id\s*=\s*\$2/i.test(sql)) {
        const post = communityPosts.find((p) => p.id === params[1]);
        if (!post || !users.get(post.author_id)) return { rows: [] };
        return { rows: [buildRow(post)] };
      }

      // listPosts: drop posts whose author no longer exists (INNER JOIN users),
      // whose author the viewer blocked, or who is globally admin-blocked.
      let list = communityPosts.filter(
        (p) =>
          !!users.get(p.author_id) &&
          !communityBlocks.some(
            (b) => b.blocker_id === viewerId && b.blocked_id === p.author_id
          ) &&
          !adminBlocks.has(p.author_id)
      );
      const typeMatch = /p\.type\s*=\s*\$(\d+)/i.exec(sql);
      if (typeMatch) {
        const t = params[Number(typeMatch[1]) - 1];
        list = list.filter((p) => (p.type ?? "progress") === t);
      }
      const curMatch =
        /p\.created_at\s*<\s*\$(\d+)\s+OR\s+\(p\.created_at\s*=\s*\$\d+\s+AND\s+p\.id\s*<\s*\$(\d+)\)/i.exec(
          sql
        );
      if (curMatch) {
        const ca = params[Number(curMatch[1]) - 1];
        const ci = params[Number(curMatch[2]) - 1];
        list = list.filter(
          (p) => p.created_at < ca || (p.created_at === ca && p.id < ci)
        );
      }
      list.sort((a, b) => {
        if (b.created_at !== a.created_at) return b.created_at - a.created_at;
        return a.id < b.id ? 1 : a.id > b.id ? -1 : 0; // id DESC
      });
      const limit = Number(params[params.length - 1]);
      return { rows: list.slice(0, limit).map(buildRow) };
    }

    // --- community_likes (toggleLike: insert-or-delete + count) ------------
    // toggleLike inserts with ON CONFLICT DO NOTHING (rowCount 1 when newly
    // liked, 0 when already liked), then deletes on the un-like path, then
    // counts. deletePostCascade also deletes every like for a post.
    if (/community_likes/i.test(sql)) {
      if (/INSERT\s+INTO\s+community_likes/i.test(sql)) {
        const [post_id, user_id, created_at] = params;
        const exists = communityLikes.some(
          (l) => l.post_id === post_id && l.user_id === user_id
        );
        if (exists) return { rows: [], rowCount: 0 }; // ON CONFLICT DO NOTHING
        communityLikes.push({ post_id, user_id, created_at });
        return { rows: [], rowCount: 1 };
      }
      if (/DELETE\s+FROM\s+community_likes/i.test(sql)) {
        // un-like: WHERE post_id = $1 AND user_id = $2
        // cascade delete: WHERE post_id = $1 (no user filter)
        const byUser = /user_id\s*=\s*\$2/i.test(sql);
        const [postId, userId] = params;
        const before = communityLikes.length;
        for (let i = communityLikes.length - 1; i >= 0; i--) {
          const l = communityLikes[i];
          if (l.post_id === postId && (!byUser || l.user_id === userId)) {
            communityLikes.splice(i, 1);
          }
        }
        return { rows: [], rowCount: before - communityLikes.length };
      }
      // SELECT COUNT(*) AS n FROM community_likes l WHERE l.post_id = $1
      //   AND NOT EXISTS (community_blocks b WHERE b.blocker_id = $2
      //   AND b.blocked_id = l.user_id) — excludes likers the viewer blocked.
      const [countPostId, countViewerId] = params;
      const n = communityLikes.filter(
        (l) =>
          l.post_id === countPostId &&
          !communityBlocks.some(
            (b) => b.blocker_id === countViewerId && b.blocked_id === l.user_id
          )
      ).length;
      return { rows: [{ n: String(n) }] };
    }

    // --- community_comments (addComment INSERT...WHERE EXISTS + reads) ------
    if (/community_comments/i.test(sql)) {
      if (/INSERT\s+INTO\s+community_comments/i.test(sql)) {
        // addComment column order: id, post_id, author_id, body, created_at.
        // The INSERT ... SELECT ... WHERE EXISTS only records the row when the
        // post still exists.
        const [id, post_id, author_id, body, created_at] = params;
        if (!communityPosts.some((p) => p.id === post_id)) {
          return { rows: [], rowCount: 0 };
        }
        communityComments.push({ id, post_id, author_id, body, created_at });
        return { rows: [], rowCount: 1 };
      }
      if (/DELETE\s+FROM\s+community_comments/i.test(sql)) {
        // cascade delete: WHERE post_id = $1
        const postId = params[0];
        const before = communityComments.length;
        for (let i = communityComments.length - 1; i >= 0; i--) {
          if (communityComments[i].post_id === postId) communityComments.splice(i, 1);
        }
        return { rows: [], rowCount: before - communityComments.length };
      }
      // SELECT reads JOIN users (author). getComment filters WHERE c.id = $1;
      // listComments filters WHERE c.post_id = $1 (oldest first). Both drop a
      // comment whose author account no longer exists (INNER JOIN users).
      const byId = /WHERE\s+c\.id\s*=\s*\$1/i.test(sql);
      const key = params[0];
      const matching = communityComments.filter((c) =>
        byId ? c.id === key : c.post_id === key
      );
      const joined = matching
        .map((c) => ({ c, author: users.get(c.author_id) }))
        .filter((x): x is { c: Row; author: Row } => !!x.author);
      if (!byId) {
        joined.sort((a, b) => {
          if (a.c.created_at !== b.c.created_at) return a.c.created_at - b.c.created_at;
          return a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0; // id ASC
        });
      }
      const rows = joined.map(({ c, author }) => ({
        id: c.id,
        post_id: c.post_id,
        body: c.body ?? "",
        created_at: c.created_at,
        author_id: author.id,
        author_name: author.name,
        author_avatar: author.avatar_object_path == null ? (author.avatar ?? null) : null,
        author_avatar_path: author.avatar_object_path ?? null,
      }));
      return { rows };
    }

    // --- community_posts (photo paths the cleanup sweep reconciles against) -
    if (/FROM\s+community_posts/i.test(sql)) {
      const onlyWithPhoto = /photo_object_path\s+IS\s+NOT\s+NULL/i.test(sql);
      const rows = communityPosts
        .filter((p) => !onlyWithPhoto || p.photo_object_path != null)
        .map((p) => ({ photo_object_path: p.photo_object_path ?? null }));
      return { rows };
    }

    // --- community_admin_blocks (global admin block; drives the block notice) -
    if (/community_admin_blocks/i.test(sql)) {
      if (/INSERT\s+INTO\s+community_admin_blocks/i.test(sql)) {
        const [user_id, blocked_by, created_at] = params;
        if (!adminBlocks.has(user_id)) {
          adminBlocks.set(user_id, { user_id, blocked_by, created_at });
        }
        return { rows: [], rowCount: 1 };
      }
      if (/DELETE\s+FROM\s+community_admin_blocks/i.test(sql)) {
        const existed = adminBlocks.delete(params[0]);
        return { rows: [], rowCount: existed ? 1 : 0 };
      }
      // SELECT created_at FROM community_admin_blocks WHERE user_id = $1
      const row = adminBlocks.get(params[0]);
      return { rows: row ? [{ created_at: row.created_at }] : [] };
    }

    // --- community_notices (member-facing warnings) ------------------------
    if (/community_notices/i.test(sql)) {
      if (/INSERT\s+INTO\s+community_notices/i.test(sql)) {
        // warnUser column order: id, user_id, message, created_by, created_at
        // (kind is the literal 'warning' in the INSERT).
        const [id, user_id, message, created_by, created_at] = params;
        notices.push({
          id,
          user_id,
          kind: "warning",
          message,
          created_by,
          created_at,
          acknowledged_at: null,
        });
        return { rows: [], rowCount: 1 };
      }
      if (/DELETE\s+FROM\s+community_notices/i.test(sql)) {
        // withdrawWarnings: user_id = $1 AND kind = 'warning' AND acknowledged_at IS NULL
        const userId = params[0];
        let removed = 0;
        for (let i = notices.length - 1; i >= 0; i--) {
          const n = notices[i];
          if (n.user_id === userId && n.kind === "warning" && n.acknowledged_at == null) {
            notices.splice(i, 1);
            removed++;
          }
        }
        return { rows: [], rowCount: removed };
      }
      if (/UPDATE\s+community_notices/i.test(sql)) {
        // acknowledgeNotice: SET acknowledged_at = $3
        //   WHERE id = $1 AND user_id = $2 AND kind = 'warning' AND acknowledged_at IS NULL
        const [id, userId, ackAt] = params;
        let updated = 0;
        for (const n of notices) {
          if (
            n.id === id &&
            n.user_id === userId &&
            n.kind === "warning" &&
            n.acknowledged_at == null
          ) {
            n.acknowledged_at = ackAt;
            updated++;
          }
        }
        return { rows: [], rowCount: updated };
      }
      // SELECT paths (hasActiveWarning / listNoticesForMember warnings). Both
      // scope to outstanding (un-acknowledged) warnings for one member.
      const userId = params[0];
      const active = notices.filter(
        (n) => n.user_id === userId && n.kind === "warning" && n.acknowledged_at == null
      );
      if (/SELECT\s+1\s+FROM\s+community_notices/i.test(sql)) {
        // hasActiveWarning: LIMIT 1, presence-only.
        return { rows: active.slice(0, 1).map(() => ({ "?column?": 1 })) };
      }
      // listNoticesForMember: ORDER BY created_at DESC, id DESC.
      const ordered = active.slice().sort((a, b) => {
        if (b.created_at !== a.created_at) return b.created_at - a.created_at;
        return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
      });
      return {
        rows: ordered.map((n) => ({
          id: n.id,
          message: n.message,
          created_at: n.created_at,
        })),
      };
    }

    // --- push_tokens (device tokens a moderation push fans out to) ----------
    if (/push_tokens/i.test(sql)) {
      if (/INSERT\s+INTO\s+push_tokens/i.test(sql)) {
        // savePushToken: token, user_id, platform, updated_at (upsert on token)
        const [token, user_id, platform, updated_at] = params;
        pushTokens.set(token, { token, user_id, platform, updated_at });
        return { rows: [], rowCount: 1 };
      }
      if (/DELETE\s+FROM\s+push_tokens/i.test(sql)) {
        if (/token\s*=\s*ANY/i.test(sql)) {
          // deletePushTokens: token = ANY($1::text[])
          const list: string[] = params[0] ?? [];
          let removed = 0;
          for (const t of list) {
            if (pushTokens.delete(t)) removed++;
          }
          return { rows: [], rowCount: removed };
        }
        // removePushToken: token = $1 AND user_id = $2
        const [token, userId] = params;
        const row = pushTokens.get(token);
        if (row && row.user_id === userId) {
          pushTokens.delete(token);
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // listPushTokensForUser: SELECT token FROM push_tokens WHERE user_id = $1
      const userId = params[0];
      const rows = [...pushTokens.values()]
        .filter((r) => r.user_id === userId)
        .map((r) => ({ token: r.token }));
      return { rows };
    }

    // --- app_settings ------------------------------------------------------
    if (/FROM\s+app_settings/i.test(sql)) {
      const value = settings.get(params[0]);
      return { rows: value === undefined ? [] : [{ value }] };
    }
    if (/INSERT\s+INTO\s+app_settings/i.test(sql)) {
      settings.set(params[0], params[1]);
      return { rows: [] };
    }

    // --- users -------------------------------------------------------------
    if (/INSERT\s+INTO\s+users/i.test(sql)) {
      // Column order mirrors createUser():
      // id, name, email, password_hash, avatar, is_admin, [onboarding=FALSE], created_at
      const [id, name, email, password_hash, avatar, is_admin, created_at] = params;
      for (const u of users.values()) {
        if (u.email === email) throw dupKeyError();
      }
      const row: Row = {
        id,
        name,
        email,
        password_hash,
        avatar: avatar ?? null,
        is_admin: !!is_admin,
        onboarding_complete: false,
        created_at,
      };
      users.set(id, row);
      return { rows: [{ ...row }] };
    }

    // Atomic JSONB merge used by patchUserProfile:
    //   UPDATE users SET profile = COALESCE(profile,'{}'::jsonb) || $1::jsonb ...
    // Mirror Postgres' shallow `||` merge in JS over the stored object.
    if (/UPDATE\s+users\s+SET\s+profile\s*=\s*COALESCE/i.test(sql)) {
      const id = params[params.length - 1];
      const row = users.get(id);
      if (!row) return { rows: [] };
      const patch = JSON.parse(params[0]);
      const base =
        row.profile == null
          ? {}
          : typeof row.profile === "string"
            ? JSON.parse(row.profile)
            : row.profile;
      row.profile = { ...base, ...patch };
      return { rows: [{ profile: row.profile }] };
    }

    if (/UPDATE\s+users/i.test(sql)) {
      const assignments = setAssignments(sql);
      const id = params[params.length - 1];
      const row = users.get(id);
      if (!row) return { rows: [] };
      for (const a of assignments) {
        row[a.col] = a.kind === "null" ? null : params[a.idx];
      }
      return { rows: [{ ...row }] };
    }

    // --- users.avatar_object_path (paths the avatar cleanup reconciles) -----
    if (/avatar_object_path\s+FROM\s+users/i.test(sql)) {
      const onlyWithAvatar = /avatar_object_path\s+IS\s+NOT\s+NULL/i.test(sql);
      const rows = [...users.values()]
        .filter((u) => !onlyWithAvatar || u.avatar_object_path != null)
        .map((u) => ({ avatar_object_path: u.avatar_object_path ?? null }));
      return { rows };
    }

    if (/SELECT\s+1\s+FROM\s+users/i.test(sql)) {
      // emailTaken: optional "AND id <> $2" excludes the caller's own row.
      const email = params[0];
      const exceptId = /AND\s+id\s*<>/i.test(sql) ? params[1] : undefined;
      for (const u of users.values()) {
        if (u.email === email && u.id !== exceptId) return { rows: [{ "?column?": 1 }] };
      }
      return { rows: [] };
    }

    if (/FROM\s+users\s+WHERE\s+email/i.test(sql)) {
      const email = params[0];
      for (const u of users.values()) {
        if (u.email === email) return { rows: [{ ...u }] };
      }
      return { rows: [] };
    }

    if (/FROM\s+users\s+WHERE\s+id/i.test(sql)) {
      const row = users.get(params[0]);
      return { rows: row ? [{ ...row }] : [] };
    }

    throw new Error(`fakeUserDb: unhandled query: ${sql}`);
  }

  const fakePool = { query } as unknown as Pool;
  __setPoolForTests(fakePool);

  let exerciseSeq = 0;
  let postSeq = 0;
  let reportSeq = 0;
  let commentSeq = 0;
  let notificationSeq = 0;
  let noticeSeq = 0;
  return {
    users,
    settings,
    exercises,
    communityPosts,
    communityReports,
    communityLikes,
    communityComments,
    communityBlocks,
    communityNotifications,
    notices,
    adminBlocks,
    pushTokens,
    seedUser(u) {
      const row: Row = {
        id: u.id,
        name: u.name ?? "Seeded",
        email: u.email,
        password_hash: u.password_hash ?? "",
        avatar: u.avatar ?? null,
        avatar_object_path: u.avatar_object_path ?? null,
        avatar_mime: u.avatar_mime ?? null,
        is_admin: !!u.is_admin,
        onboarding_complete: !!u.onboarding_complete,
        created_at: u.created_at ?? Date.now(),
      };
      users.set(row.id, row);
      return row;
    },
    seedExercise(e) {
      const row: Row = {
        id: e.id ?? `ex-${++exerciseSeq}`,
        video_object_path: e.video_object_path,
        poster_object_path: e.poster_object_path ?? null,
      };
      exercises.push(row);
      return row;
    },
    seedCommunityPost(p) {
      const row: Row = {
        id: p.id ?? `post-${++postSeq}`,
        author_id: p.author_id ?? null,
        type: p.type ?? "progress",
        body: p.body ?? "",
        photo_object_path: p.photo_object_path ?? null,
        created_at: p.created_at ?? Date.now(),
      };
      communityPosts.push(row);
      return row;
    },
    seedReport(r) {
      const row: Row = {
        id: r.id ?? `report-${++reportSeq}`,
        post_id: r.post_id,
        reporter_id: r.reporter_id,
        reason: r.reason ?? "",
        created_at: r.created_at ?? Date.now(),
      };
      communityReports.push(row);
      return row;
    },
    seedLike(l) {
      const row: Row = {
        post_id: l.post_id,
        user_id: l.user_id,
        created_at: l.created_at ?? Date.now(),
      };
      communityLikes.push(row);
      return row;
    },
    seedComment(c) {
      const row: Row = {
        id: c.id ?? `comment-${++commentSeq}`,
        post_id: c.post_id,
        author_id: c.author_id,
        body: c.body ?? "",
        created_at: c.created_at ?? Date.now(),
      };
      communityComments.push(row);
      return row;
    },
    seedNotification(n) {
      const row: Row = {
        id: n.id ?? `notif-${++notificationSeq}`,
        recipient_id: n.recipient_id,
        actor_id: n.actor_id,
        post_id: n.post_id,
        type: n.type ?? "like",
        read: n.read ?? false,
        created_at: n.created_at ?? Date.now(),
      };
      communityNotifications.push(row);
      return row;
    },
    seedNotice(n) {
      const row: Row = {
        id: n.id ?? `notice-${++noticeSeq}`,
        user_id: n.user_id,
        kind: n.kind ?? "warning",
        message: n.message ?? "",
        created_by: n.created_by ?? "admin",
        created_at: n.created_at ?? Date.now(),
        acknowledged_at: n.acknowledged_at ?? null,
      };
      notices.push(row);
      return row;
    },
    seedAdminBlock(b) {
      const row: Row = {
        user_id: b.user_id,
        blocked_by: b.blocked_by ?? "admin",
        created_at: b.created_at ?? Date.now(),
      };
      adminBlocks.set(row.user_id, row);
      return row;
    },
    seedCommunityBlock(b) {
      const row: Row = {
        blocker_id: b.blocker_id,
        blocked_id: b.blocked_id,
        created_at: b.created_at ?? Date.now(),
      };
      communityBlocks.push(row);
      return row;
    },
    seedPushToken(p) {
      const row: Row = {
        token: p.token,
        user_id: p.user_id,
        platform: p.platform ?? "ios",
        updated_at: p.updated_at ?? Date.now(),
      };
      pushTokens.set(row.token, row);
      return row;
    },
  };
}

// Restores the default (real) pool resolution so a fake never leaks across files.
export function uninstallFakeDb(): void {
  __setPoolForTests(null);
}
