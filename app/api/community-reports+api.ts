import { requireSession } from "@/lib/adminAuth";
import { dismissReportsForPost, listReports } from "@/lib/communityStore";

const PAGE_SIZE = 100;

// GET -> the moderation queue: each reported post once, grouped with all of its
// reporters/reasons and a report count, newest report first. Admin (coach) only:
// a member's session token is rejected even though it is otherwise valid.
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });
    if (session.role !== "admin") {
      return Response.json({ error: "Admins only" }, { status: 403 });
    }

    const reports = await listReports({ viewerId: session.sub, limit: PAGE_SIZE });
    return Response.json({ reports });
  } catch (e: any) {
    console.error("community-reports GET error:", e?.message ?? e);
    return Response.json({ error: "Could not load reports" }, { status: 500 });
  }
}

// DELETE ?postId=<postId> -> dismiss every report against a post at once,
// leaving the post in place. Admin (coach) only.
export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });
    if (session.role !== "admin") {
      return Response.json({ error: "Admins only" }, { status: 403 });
    }

    const postId = new URL(request.url).searchParams.get("postId");
    if (!postId) return Response.json({ error: "Missing post id" }, { status: 400 });

    const dismissed = await dismissReportsForPost(postId);
    if (!dismissed) return Response.json({ error: "No reports found" }, { status: 404 });
    return Response.json({ ok: true, dismissed });
  } catch (e: any) {
    console.error("community-reports DELETE error:", e?.message ?? e);
    return Response.json({ error: "Could not dismiss reports" }, { status: 500 });
  }
}
