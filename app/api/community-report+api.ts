import { requireSession } from "@/lib/adminAuth";
import { reportPost } from "@/lib/communityStore";

const MAX_REASON_CHARS = 500;

// Records a report against a post for the signed-in member. Answers 404 if the
// post no longer exists.
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

    let reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (reason.length > MAX_REASON_CHARS) reason = reason.slice(0, MAX_REASON_CHARS);

    const ok = await reportPost({ postId, reporterId: session.sub, reason });
    if (!ok) return Response.json({ error: "Post not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("community-report POST error:", e?.message ?? e);
    return Response.json({ error: "Could not submit report" }, { status: 500 });
  }
}
