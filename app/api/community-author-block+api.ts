import { requireSession } from "@/lib/adminAuth";
import { adminBlockUser, adminUnblockUser } from "@/lib/communityStore";

// Global moderation block, applied by an admin (coach) from the reported-posts
// review queue. Unlike /api/community-block (a per-viewer mute), a block here
// hides the member's posts from everyone's feed. Admin (coach) only: a member's
// session token is rejected even though it is otherwise valid.
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });
    if (session.role !== "admin") {
      return Response.json({ error: "Coaches only" }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const authorId = typeof body?.authorId === "string" ? body.authorId : "";
    if (!authorId) return Response.json({ error: "Missing member id" }, { status: 400 });
    if (authorId === session.sub) {
      return Response.json({ error: "You can't block yourself" }, { status: 400 });
    }

    await adminBlockUser({ userId: authorId, blockedBy: session.sub });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("community-author-block POST error:", e?.message ?? e);
    return Response.json({ error: "Could not block member" }, { status: 500 });
  }
}

// Reverses the global block (unblock). Admin (coach) only.
export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });
    if (session.role !== "admin") {
      return Response.json({ error: "Coaches only" }, { status: 403 });
    }

    const authorId = new URL(request.url).searchParams.get("authorId");
    if (!authorId) return Response.json({ error: "Missing member id" }, { status: 400 });

    await adminUnblockUser(authorId);
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("community-author-block DELETE error:", e?.message ?? e);
    return Response.json({ error: "Could not unblock member" }, { status: 500 });
  }
}
