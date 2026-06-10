import { requireSession } from "@/lib/adminAuth";
import { warnUser, withdrawWarnings } from "@/lib/communityStore";
import { sendModerationPush } from "@/lib/push";

const MAX_MESSAGE_CHARS = 500;

// Sends a member a warning notice from the reported-posts review queue. A
// warning is a lighter touch than a global block: the member keeps posting but
// sees a plain-language message the next time they open the feed. Admins
// only.
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });
    if (session.role !== "admin") {
      return Response.json({ error: "Admins only" }, { status: 403 });
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
      return Response.json({ error: "You can't warn yourself" }, { status: 400 });
    }

    let message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return Response.json({ error: "Please enter a warning message" }, { status: 400 });
    if (message.length > MAX_MESSAGE_CHARS) message = message.slice(0, MAX_MESSAGE_CHARS);

    await warnUser({ userId: authorId, message, warnedBy: session.sub });
    // Best-effort out-of-app nudge so the member sees the warning even if they
    // never open the app. Never blocks or fails the warning if push is down.
    await sendModerationPush({ userId: authorId, kind: "warning", message });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("community-author-warn POST error:", e?.message ?? e);
    return Response.json({ error: "Could not warn member" }, { status: 500 });
  }
}

// Withdraws every outstanding warning for a member (reversal). Admins
// only.
export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });
    if (session.role !== "admin") {
      return Response.json({ error: "Admins only" }, { status: 403 });
    }

    const authorId = new URL(request.url).searchParams.get("authorId");
    if (!authorId) return Response.json({ error: "Missing member id" }, { status: 400 });

    await withdrawWarnings(authorId);
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("community-author-warn DELETE error:", e?.message ?? e);
    return Response.json({ error: "Could not withdraw warning" }, { status: 500 });
  }
}
