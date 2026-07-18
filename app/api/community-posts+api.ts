import { requireSession } from "@/lib/adminAuth";
import {
  createPost,
  deletePostCascade,
  getPost,
  getPostMeta,
  isPostType,
  listPinned,
  listPosts,
  updatePost,
} from "@/lib/communityStore";
import { deleteObject, getPrivateDir } from "@/lib/objectStorageServer";

const MAX_BODY_CHARS = 2000;
const PAGE_SIZE = 15;
const MAX_PHOTOS = 4;

// Same constraint the photo endpoint uses, so a client can't smuggle an
// arbitrary object path in as a post's photo key.
const KEY_RE = /^[a-f0-9-]{20,64}$/i;

// Resolves the incoming photo keys (new `photoKeys` array, or the legacy single
// `photoKey`) to ordered, de-duped object paths. Returns null when any key is
// malformed so the route can reject it. Caps at MAX_PHOTOS.
function resolvePhotoPaths(body: any): string[] | null {
  const raw: unknown[] = Array.isArray(body?.photoKeys)
    ? body.photoKeys
    : typeof body?.photoKey === "string" && body.photoKey.trim()
      ? [body.photoKey]
      : [];
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw.slice(0, MAX_PHOTOS)) {
    const key = typeof entry === "string" ? entry.trim() : "";
    if (!key) continue;
    if (!KEY_RE.test(key)) return null;
    if (seen.has(key)) continue;
    seen.add(key);
    paths.push(`${getPrivateDir()}/community-photos/${key}`);
  }
  return paths;
}

// GET ?id=<id>  -> a single post.
// GET (feed)    -> a page of posts, newest first, with an optional ?type filter
//                  and ?beforeCreatedAt/?beforeId keyset cursor.
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const post = await getPost(id, session.sub);
      if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
      return Response.json({ post });
    }

    const typeParam = url.searchParams.get("type");
    const type = isPostType(typeParam) ? typeParam : null;

    const beforeCreatedAtRaw = url.searchParams.get("beforeCreatedAt");
    const beforeId = url.searchParams.get("beforeId");
    const beforeCreatedAt =
      beforeCreatedAtRaw != null && /^\d+$/.test(beforeCreatedAtRaw)
        ? Number(beforeCreatedAtRaw)
        : null;

    const posts = await listPosts({
      viewerId: session.sub,
      type,
      beforeCreatedAt,
      beforeId: beforeCreatedAt != null ? beforeId : null,
      limit: PAGE_SIZE,
    });

    // A full page means there may be more; hand back the cursor for the next
    // request. A short page means the end of the feed.
    const nextCursor =
      posts.length === PAGE_SIZE
        ? { createdAt: posts[posts.length - 1].createdAt, id: posts[posts.length - 1].id }
        : null;

    // Pinned posts ride along only on the first page (no cursor) of the
    // unfiltered feed, so they show once at the very top and don't repeat as
    // the member pages down or narrows to a type.
    const isFirstUnfilteredPage = beforeCreatedAt == null && !type;
    const pinned = isFirstUnfilteredPage ? await listPinned(session.sub) : [];

    return Response.json({ posts, nextCursor, pinned });
  } catch (e: any) {
    console.error("community-posts GET error:", e?.message ?? e);
    return Response.json({ error: "Could not load the feed" }, { status: 500 });
  }
}

// Creates a post for the signed-in member. Text is required; type must be a
// known post type; a photo is optional and referenced by the key returned from
// the community-photo upload endpoint.
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const type = body?.type;
    if (!isPostType(type)) {
      return Response.json({ error: "Choose a post type" }, { status: 400 });
    }

    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return Response.json({ error: "Write something to share" }, { status: 400 });
    }
    if (text.length > MAX_BODY_CHARS) {
      return Response.json({ error: "Your post is a little too long" }, { status: 400 });
    }

    const photoObjectPaths = resolvePhotoPaths(body);
    if (photoObjectPaths === null) {
      return Response.json({ error: "That photo could not be attached" }, { status: 400 });
    }

    const post = await createPost({
      authorId: session.sub,
      type,
      body: text,
      photoObjectPaths,
    });
    if (!post) return Response.json({ error: "Could not create post" }, { status: 500 });
    return Response.json({ post }, { status: 201 });
  } catch (e: any) {
    console.error("community-posts POST error:", e?.message ?? e);
    return Response.json({ error: "Could not create post" }, { status: 500 });
  }
}

// Edits a post. Only the author can edit their own post (not even an admin
// rewrites a member's words). Type and text are required, same as creating. The
// photo can be left as-is, replaced with a freshly uploaded key, or cleared via
// `removePhoto`; a replaced/cleared object is deleted best-effort afterward.
export async function PATCH(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Missing post id" }, { status: 400 });

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const meta = await getPostMeta(id);
    if (!meta) return Response.json({ error: "Post not found" }, { status: 404 });
    if (meta.authorId !== session.sub) {
      return Response.json({ error: "You can only edit your own posts" }, { status: 403 });
    }

    const type = body?.type;
    if (!isPostType(type)) {
      return Response.json({ error: "Choose a post type" }, { status: 400 });
    }

    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return Response.json({ error: "Write something to share" }, { status: 400 });
    }
    if (text.length > MAX_BODY_CHARS) {
      return Response.json({ error: "Your post is a little too long" }, { status: 400 });
    }

    // Resolve the photo change, if any. `photoKeys` (or the legacy single
    // `photoKey`) replaces the whole image set; `removePhoto` clears it; omitting
    // all of them leaves the existing images untouched.
    let photo: { objectPaths: string[] } | undefined;
    let toDelete: string[] = [];
    const hasKeysField = Array.isArray(body?.photoKeys);
    const hasLegacyKey = typeof body?.photoKey === "string" && body.photoKey.trim().length > 0;
    if (hasKeysField || hasLegacyKey || body?.removePhoto === true) {
      let newPaths: string[] = [];
      if (hasKeysField || hasLegacyKey) {
        const resolved = resolvePhotoPaths(body);
        if (resolved === null) {
          return Response.json({ error: "That photo could not be attached" }, { status: 400 });
        }
        newPaths = resolved;
      }
      photo = { objectPaths: newPaths };
      const keep = new Set(newPaths);
      toDelete = meta.photoObjectPaths.filter((p) => !keep.has(p));
    }

    const post = await updatePost({ id, viewerId: session.sub, type, body: text, photo });
    if (!post) return Response.json({ error: "Could not update post" }, { status: 500 });

    for (const path of toDelete) {
      await deleteObject(path).catch(() => {});
    }
    return Response.json({ post });
  } catch (e: any) {
    console.error("community-posts PATCH error:", e?.message ?? e);
    return Response.json({ error: "Could not update post" }, { status: 500 });
  }
}

// Deletes a post. The author can delete their own; an admin (coach) can delete
// anyone's. The stored photo object is removed best-effort afterward.
export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Missing post id" }, { status: 400 });

    const meta = await getPostMeta(id);
    if (!meta) return Response.json({ error: "Post not found" }, { status: 404 });

    const isAdmin = session.role === "admin";
    if (!isAdmin && meta.authorId !== session.sub) {
      return Response.json({ error: "You can only delete your own posts" }, { status: 403 });
    }

    await deletePostCascade(id);
    for (const path of meta.photoObjectPaths) {
      await deleteObject(path).catch(() => {});
    }
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("community-posts DELETE error:", e?.message ?? e);
    return Response.json({ error: "Could not delete post" }, { status: 500 });
  }
}
