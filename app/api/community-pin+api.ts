import { requireAdmin } from "@/lib/adminAuth";
import { getPostMeta, setPinned } from "@/lib/communityStore";

// Admin-only pin/unpin. POST { postId } pins a post to the top of the feed;
// DELETE ?postId=<id> unpins it. Only the coach (admin token) may pin, so a
// member can't lift their own post above everyone else's.
export async function POST(request: Request): Promise<Response> {
  return setPin(request, true);
}

export async function DELETE(request: Request): Promise<Response> {
  return setPin(request, false);
}

async function setPin(request: Request, pinned: boolean): Promise<Response> {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return Response.json({ error: "Not authorized" }, { status: 403 });

    let postId: string | null = null;
    if (pinned) {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid request body" }, { status: 400 });
      }
      postId = typeof body?.postId === "string" ? body.postId : null;
    } else {
      postId = new URL(request.url).searchParams.get("postId");
    }
    if (!postId) return Response.json({ error: "Missing post id" }, { status: 400 });

    const meta = await getPostMeta(postId);
    if (!meta) return Response.json({ error: "Post not found" }, { status: 404 });

    const ok = await setPinned({ id: postId, pinned });
    if (!ok) return Response.json({ error: "Could not update pin" }, { status: 500 });
    return Response.json({ ok: true, pinned });
  } catch (e: any) {
    console.error("community-pin error:", e?.message ?? e);
    return Response.json({ error: "Could not update pin" }, { status: 500 });
  }
}
