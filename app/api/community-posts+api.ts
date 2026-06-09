import { requireSession } from "@/lib/adminAuth";
import {
  createPost,
  deletePostCascade,
  getPost,
  getPostMeta,
  isPostType,
  listPosts,
  updatePost,
} from "@/lib/communityStore";
import { deleteObject, getPrivateDir } from "@/lib/objectStorageServer";

const MAX_BODY_CHARS = 2000;
const PAGE_SIZE = 15;

// Same constraint the photo endpoint uses, so a client can't smuggle an
// arbitrary object path in as a post's photo key.
const KEY_RE = /^[a-f0-9-]{20,64}$/i;

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

    return Response.json({ posts, nextCursor });
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

    let photoObjectPath: string | null = null;
    const photoKey = typeof body?.photoKey === "string" ? body.photoKey.trim() : "";
    if (photoKey) {
      if (!KEY_RE.test(photoKey)) {
        return Response.json({ error: "That photo could not be attached" }, { status: 400 });
      }
      photoObjectPath = `${getPrivateDir()}/community-photos/${photoKey}`;
    }

    const post = await createPost({
      authorId: session.sub,
      type,
      body: text,
      photoObjectPath,
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

    // Resolve the photo change, if any. A new key replaces the photo; an explicit
    // removePhoto clears it; omitting both leaves the existing photo untouched.
    let photo: { objectPath: string | null } | undefined;
    let oldToDelete: string | null = null;
    const newKey = typeof body?.photoKey === "string" ? body.photoKey.trim() : "";
    if (newKey) {
      if (!KEY_RE.test(newKey)) {
        return Response.json({ error: "That photo could not be attached" }, { status: 400 });
      }
      const newPath = `${getPrivateDir()}/community-photos/${newKey}`;
      photo = { objectPath: newPath };
      if (meta.photoObjectPath && meta.photoObjectPath !== newPath) {
        oldToDelete = meta.photoObjectPath;
      }
    } else if (body?.removePhoto === true) {
      photo = { objectPath: null };
      oldToDelete = meta.photoObjectPath;
    }

    const post = await updatePost({ id, viewerId: session.sub, type, body: text, photo });
    if (!post) return Response.json({ error: "Could not update post" }, { status: 500 });

    if (oldToDelete) {
      await deleteObject(oldToDelete).catch(() => {});
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
    if (meta.photoObjectPath) {
      await deleteObject(meta.photoObjectPath).catch(() => {});
    }
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("community-posts DELETE error:", e?.message ?? e);
    return Response.json({ error: "Could not delete post" }, { status: 500 });
  }
}
