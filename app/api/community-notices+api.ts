import { requireSession } from "@/lib/adminAuth";
import { acknowledgeNotice, listNoticesForMember } from "@/lib/communityStore";

// Returns the moderation notices the signed-in member should see: a block
// notice (derived live from the admin block) and any warnings they have not
// dismissed yet. Any verified member can read their own notices.
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const notices = await listNoticesForMember(session.sub);
    return Response.json({ notices });
  } catch (e: any) {
    console.error("community-notices GET error:", e?.message ?? e);
    return Response.json({ error: "Could not load notices" }, { status: 500 });
  }
}

// Dismisses (acknowledges) one of the member's own warning notices so it stops
// showing. Scoped to the session's member id, so a member can only dismiss
// their own notices. The block notice is not dismissable (it clears only when
// an admin unblocks the member).
export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Missing notice id" }, { status: 400 });

    const ok = await acknowledgeNotice({ userId: session.sub, id });
    if (!ok) return Response.json({ error: "Notice not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("community-notices DELETE error:", e?.message ?? e);
    return Response.json({ error: "Could not dismiss notice" }, { status: 500 });
  }
}
