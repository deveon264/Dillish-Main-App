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
  notices: Row[];
  adminBlocks: Map<string, Row>;
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
  seedNotice: (n: Partial<Row> & { user_id: string }) => Row;
  seedAdminBlock: (b: Partial<Row> & { user_id: string }) => Row;
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
  const notices: Row[] = [];
  const adminBlocks = new Map<string, Row>();

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
          like_count: 0,
          comment_count: 0,
          liked_by_me: false,
          author_report_count: authorReportCount,
          author_blocked: false,
          author_warned: false,
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
  let noticeSeq = 0;
  return {
    users,
    settings,
    exercises,
    communityPosts,
    communityReports,
    notices,
    adminBlocks,
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
  };
}

// Restores the default (real) pool resolution so a fake never leaks across files.
export function uninstallFakeDb(): void {
  __setPoolForTests(null);
}
