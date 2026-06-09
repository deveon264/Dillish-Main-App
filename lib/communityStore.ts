import { getPool, ensureSchema } from "@/lib/db";

// Server-side persistence for the shared community feed. Author identity is NOT
// snapshotted onto posts/comments: every read JOINs the live `users` row so a
// member's current name and photo always show, and the photo is served by the
// existing avatar endpoint keyed by author id. Post photos live in object
// storage; only the object path is stored here.

export type PostType = "progress" | "meal" | "tip" | "motivation";

export const POST_TYPES: PostType[] = ["progress", "meal", "tip", "motivation"];

export function isPostType(v: unknown): v is PostType {
  return typeof v === "string" && (POST_TYPES as string[]).includes(v);
}

export type CommunityAuthor = {
  id: string;
  name: string;
  // Legacy inline data-URI photo (older accounts); null once a photo lives in
  // object storage, in which case `avatarVersion` is set and the client renders
  // via GET /api/avatar?id=<id>&v=<avatarVersion>.
  avatar: string | null;
  avatarVersion: string | null;
};

export type CommunityPost = {
  id: string;
  type: PostType;
  body: string;
  // Unguessable lookup key for GET /api/community-photo?key=, or null when the
  // post has no photo.
  photoKey: string | null;
  createdAt: number;
  author: CommunityAuthor;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export type CommunityComment = {
  id: string;
  postId: string;
  body: string;
  createdAt: number;
  author: CommunityAuthor;
};

function uuid(): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// The stored object path ends in a fresh uuid; that trailing segment is the
// lookup key the client uses (matching the avatar/meal-photo pattern).
function keyFromPath(p: string | null): string | null {
  if (!p) return null;
  const parts = p.split("/");
  return parts[parts.length - 1] || null;
}

// Author identity columns, shared by the post and comment reads. The legacy
// `avatar` data-URI column can be large, so it is only selected when the account
// has no object-storage photo, keeping feed payloads small.
const AUTHOR_SELECT = `
  u.id AS author_id,
  u.name AS author_name,
  CASE WHEN u.avatar_object_path IS NULL THEN u.avatar ELSE NULL END AS author_avatar,
  u.avatar_object_path AS author_avatar_path`;

function mapAuthor(r: any): CommunityAuthor {
  return {
    id: r.author_id,
    name: r.author_name,
    avatar: r.author_avatar ?? null,
    avatarVersion: keyFromPath(r.author_avatar_path ?? null),
  };
}

function mapPost(r: any): CommunityPost {
  return {
    id: r.id,
    type: r.type,
    body: r.body,
    photoKey: keyFromPath(r.photo_object_path ?? null),
    createdAt: Number(r.created_at),
    author: mapAuthor(r),
    likeCount: Number(r.like_count),
    commentCount: Number(r.comment_count),
    likedByMe: !!r.liked_by_me,
  };
}

function mapComment(r: any): CommunityComment {
  return {
    id: r.id,
    postId: r.post_id,
    body: r.body,
    createdAt: Number(r.created_at),
    author: mapAuthor(r),
  };
}

// $1 is always the viewer id (drives liked_by_me). Counts come from scalar
// subqueries so the whole feed is one round-trip with no N+1.
const POST_SELECT = `
  SELECT p.id, p.type, p.body, p.photo_object_path, p.created_at,
    ${AUTHOR_SELECT},
    (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id) AS comment_count,
    EXISTS (SELECT 1 FROM community_likes l2 WHERE l2.post_id = p.id AND l2.user_id = $1) AS liked_by_me
  FROM community_posts p
  JOIN users u ON u.id = p.author_id`;

// Newest-first feed with keyset pagination. The viewer never sees posts from
// members they have blocked. `type` narrows to one post type when set.
export async function listPosts(opts: {
  viewerId: string;
  type?: PostType | null;
  beforeCreatedAt?: number | null;
  beforeId?: string | null;
  limit: number;
}): Promise<CommunityPost[]> {
  await ensureSchema();
  const vals: any[] = [opts.viewerId];
  const where: string[] = [
    `NOT EXISTS (SELECT 1 FROM community_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = p.author_id)`,
  ];
  if (opts.type) {
    vals.push(opts.type);
    where.push(`p.type = $${vals.length}`);
  }
  if (opts.beforeCreatedAt != null && opts.beforeId != null) {
    vals.push(opts.beforeCreatedAt);
    const ca = vals.length;
    vals.push(opts.beforeId);
    const ci = vals.length;
    // Keyset cursor over the (created_at DESC, id DESC) order.
    where.push(`(p.created_at < $${ca} OR (p.created_at = $${ca} AND p.id < $${ci}))`);
  }
  vals.push(Math.max(1, Math.min(50, opts.limit)));
  const limitIdx = vals.length;
  const sql = `${POST_SELECT}
    WHERE ${where.join(" AND ")}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT $${limitIdx}`;
  const { rows } = await getPool().query(sql, vals);
  return rows.map(mapPost);
}

export async function getPost(id: string, viewerId: string): Promise<CommunityPost | null> {
  await ensureSchema();
  const { rows } = await getPool().query(`${POST_SELECT} WHERE p.id = $2`, [viewerId, id]);
  return rows[0] ? mapPost(rows[0]) : null;
}

export async function createPost(input: {
  authorId: string;
  type: PostType;
  body: string;
  photoObjectPath?: string | null;
}): Promise<CommunityPost | null> {
  await ensureSchema();
  const id = uuid();
  await getPool().query(
    `INSERT INTO community_posts (id, author_id, type, body, photo_object_path, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.authorId, input.type, input.body, input.photoObjectPath ?? null, Date.now()]
  );
  return getPost(id, input.authorId);
}

// Lightweight read for authorization + photo cleanup before a delete.
export async function getPostMeta(
  id: string
): Promise<{ id: string; authorId: string; photoObjectPath: string | null } | null> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT id, author_id, photo_object_path FROM community_posts WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    authorId: rows[0].author_id,
    photoObjectPath: rows[0].photo_object_path ?? null,
  };
}

// Hard-deletes a post and all of its dependent rows in one transaction. The
// schema has no FK constraints, so the related rows are removed explicitly. The
// caller deletes the stored photo object afterward (best effort).
export async function deletePostCascade(id: string): Promise<void> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM community_likes WHERE post_id = $1`, [id]);
    await client.query(`DELETE FROM community_comments WHERE post_id = $1`, [id]);
    await client.query(`DELETE FROM community_reports WHERE post_id = $1`, [id]);
    await client.query(`DELETE FROM community_posts WHERE id = $1`, [id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function getComment(id: string): Promise<CommunityComment | null> {
  const { rows } = await getPool().query(
    `SELECT c.id, c.post_id, c.body, c.created_at, ${AUTHOR_SELECT}
     FROM community_comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.id = $1`,
    [id]
  );
  return rows[0] ? mapComment(rows[0]) : null;
}

// Adds a comment only if the post still exists (no FK constraints). Returns null
// when the post is gone so the route can answer 404.
export async function addComment(input: {
  postId: string;
  authorId: string;
  body: string;
}): Promise<CommunityComment | null> {
  await ensureSchema();
  const id = uuid();
  const { rowCount } = await getPool().query(
    `INSERT INTO community_comments (id, post_id, author_id, body, created_at)
     SELECT $1, $2, $3, $4, $5
     WHERE EXISTS (SELECT 1 FROM community_posts WHERE id = $2)`,
    [id, input.postId, input.authorId, input.body, Date.now()]
  );
  if (!rowCount) return null;
  return getComment(id);
}

// Comments oldest-first; comments from members the viewer blocked are hidden,
// mirroring the feed.
export async function listComments(opts: {
  postId: string;
  viewerId: string;
}): Promise<CommunityComment[]> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT c.id, c.post_id, c.body, c.created_at, ${AUTHOR_SELECT}
     FROM community_comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.post_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM community_blocks b
         WHERE b.blocker_id = $2 AND b.blocked_id = c.author_id
       )
     ORDER BY c.created_at ASC, c.id ASC`,
    [opts.postId, opts.viewerId]
  );
  return rows.map(mapComment);
}

// Toggles the viewer's like on a post. Returns null when the post no longer
// exists. Liking your own post is allowed.
export async function toggleLike(input: {
  postId: string;
  userId: string;
}): Promise<{ liked: boolean; likeCount: number } | null> {
  await ensureSchema();
  const meta = await getPostMeta(input.postId);
  if (!meta) return null;
  const ins = await getPool().query(
    `INSERT INTO community_likes (post_id, user_id, created_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (post_id, user_id) DO NOTHING`,
    [input.postId, input.userId, Date.now()]
  );
  let liked: boolean;
  if (ins.rowCount && ins.rowCount > 0) {
    liked = true;
  } else {
    await getPool().query(`DELETE FROM community_likes WHERE post_id = $1 AND user_id = $2`, [
      input.postId,
      input.userId,
    ]);
    liked = false;
  }
  const { rows } = await getPool().query(
    `SELECT COUNT(*) AS n FROM community_likes WHERE post_id = $1`,
    [input.postId]
  );
  return { liked, likeCount: Number(rows[0].n) };
}

// Records a report against a post. Returns false when the post is gone.
export async function reportPost(input: {
  postId: string;
  reporterId: string;
  reason: string;
}): Promise<boolean> {
  await ensureSchema();
  const id = uuid();
  const { rowCount } = await getPool().query(
    `INSERT INTO community_reports (id, post_id, reporter_id, reason, created_at)
     SELECT $1, $2, $3, $4, $5
     WHERE EXISTS (SELECT 1 FROM community_posts WHERE id = $2)`,
    [id, input.postId, input.reporterId, input.reason, Date.now()]
  );
  return !!rowCount;
}

export async function blockUser(input: { blockerId: string; blockedId: string }): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO community_blocks (blocker_id, blocked_id, created_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
    [input.blockerId, input.blockedId, Date.now()]
  );
}

export async function unblockUser(input: { blockerId: string; blockedId: string }): Promise<void> {
  await ensureSchema();
  await getPool().query(`DELETE FROM community_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [
    input.blockerId,
    input.blockedId,
  ]);
}

export async function listBlockedIds(blockerId: string): Promise<string[]> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT blocked_id FROM community_blocks WHERE blocker_id = $1`,
    [blockerId]
  );
  return rows.map((r) => r.blocked_id as string);
}
