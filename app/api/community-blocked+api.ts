import { requireSession } from "@/lib/adminAuth";
import { listAdminBlocked } from "@/lib/communityStore";

// GET -> every globally blocked member, newest block first. Unlike the report
// queue, this stays available after a member's reports are dismissed or their
// posts deleted, so a coach always has a way to restore them. Admin (coach)
// only: a member's session token is rejected even though it is otherwise valid.
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });
    if (session.role !== "admin") {
      return Response.json({ error: "Admins only" }, { status: 403 });
    }

    const blocked = await listAdminBlocked();
    return Response.json({ blocked });
  } catch (e: any) {
    console.error("community-blocked GET error:", e?.message ?? e);
    return Response.json({ error: "Could not load blocked members" }, { status: 500 });
  }
}
