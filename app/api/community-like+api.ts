import { requireSession } from "@/lib/adminAuth";
import { notifyPostAuthor, toggleLike } from "@/lib/communityStore";

// Toggles the signed-in member's like on a post and returns the new state and
// total. Answers 404 if the post no longer exists.
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

    const postId = typeof body?.postId === "string" ? body.postId : "";
    if (!postId) return Response.json({ error: "Missing post id" }, { status: 400 });

    const result = await toggleLike({ postId, userId: session.sub });
    if (!result) return Response.json({ error: "Post not found" }, { status: 404 });

    // Notify the post's author when the like is toggled on (never on un-like,
    // and never for liking your own post). Best-effort: a failure here must not
    // fail the like itself.
    if (result.liked) {
      try {
        await notifyPostAuthor({ postId, actorId: session.sub, type: "like" });
      } catch (e: any) {
        console.error("community-like notify error:", e?.message ?? e);
      }
    }

    return Response.json(result);
  } catch (e: any) {
    console.error("community-like POST error:", e?.message ?? e);
    return Response.json({ error: "Could not update like" }, { status: 500 });
  }
}
