import { requireSession } from "@/lib/adminAuth";
import { dismissReport, listReports } from "@/lib/communityStore";

const PAGE_SIZE = 100;

// GET -> the moderation queue: every reported post, newest first, with the
// reporter and reason. Admin (coach) only: a member's session token is rejected
// even though it is otherwise valid.
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

// DELETE ?id=<reportId> -> dismiss a single report, leaving the post in place.
// Admin (coach) only.
export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });
    if (session.role !== "admin") {
      return Response.json({ error: "Admins only" }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Missing report id" }, { status: 400 });

    const ok = await dismissReport(id);
    if (!ok) return Response.json({ error: "Report not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("community-reports DELETE error:", e?.message ?? e);
    return Response.json({ error: "Could not dismiss report" }, { status: 500 });
  }
}
