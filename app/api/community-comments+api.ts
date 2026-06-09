import { requireSession } from "@/lib/adminAuth";
import { addComment, listComments } from "@/lib/communityStore";

const MAX_COMMENT_CHARS = 1000;

// GET ?postId=<id> -> the post's comments, oldest first (comments from members
// the viewer blocked are hidden).
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const postId = new URL(request.url).searchParams.get("postId");
    if (!postId) return Response.json({ error: "Missing post id" }, { status: 400 });

    const comments = await listComments({ postId, viewerId: session.sub });
    return Response.json({ comments });
  } catch (e: any) {
    console.error("community-comments GET error:", e?.message ?? e);
    return Response.json({ error: "Could not load comments" }, { status: 500 });
  }
}

// Adds a comment to a post for the signed-in member. Answers 404 if the post no
// longer exists.
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

    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return Response.json({ error: "Write a comment first" }, { status: 400 });
    if (text.length > MAX_COMMENT_CHARS) {
      return Response.json({ error: "Your comment is a little too long" }, { status: 400 });
    }

    const comment = await addComment({ postId, authorId: session.sub, body: text });
    if (!comment) return Response.json({ error: "Post not found" }, { status: 404 });
    return Response.json({ comment }, { status: 201 });
  } catch (e: any) {
    console.error("community-comments POST error:", e?.message ?? e);
    return Response.json({ error: "Could not add comment" }, { status: 500 });
  }
}
