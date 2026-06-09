import { requireSession } from "@/lib/adminAuth";
import { blockUser, unblockUser } from "@/lib/communityStore";

// Blocks a member for the signed-in viewer: their posts and comments stop
// appearing in the viewer's feed. Blocking yourself is rejected.
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

    const blockedId = typeof body?.blockedId === "string" ? body.blockedId : "";
    if (!blockedId) return Response.json({ error: "Missing member id" }, { status: 400 });
    if (blockedId === session.sub) {
      return Response.json({ error: "You can't block yourself" }, { status: 400 });
    }

    await blockUser({ blockerId: session.sub, blockedId });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("community-block POST error:", e?.message ?? e);
    return Response.json({ error: "Could not block member" }, { status: 500 });
  }
}

// Unblocks a member for the signed-in viewer.
export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const blockedId = new URL(request.url).searchParams.get("blockedId");
    if (!blockedId) return Response.json({ error: "Missing member id" }, { status: 400 });

    await unblockUser({ blockerId: session.sub, blockedId });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("community-block DELETE error:", e?.message ?? e);
    return Response.json({ error: "Could not unblock member" }, { status: 500 });
  }
}
