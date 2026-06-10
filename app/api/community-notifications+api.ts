import { requireSession } from "@/lib/adminAuth";
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
} from "@/lib/communityStore";

// Largest inbox page returned. Notifications are a soft-capped activity feed,
// not an audit log, so a single page is plenty.
const MAX_NOTIFICATIONS = 60;

// Returns the signed-in member's in-app notifications (likes/comments on their
// posts), newest first, plus the count still unread so the caller can drive the
// Circle tab badge in one round-trip.
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const [notifications, unreadCount] = await Promise.all([
      listNotifications({ recipientId: session.sub, limit: MAX_NOTIFICATIONS }),
      countUnreadNotifications(session.sub),
    ]);
    return Response.json({ notifications, unreadCount });
  } catch (e: any) {
    console.error("community-notifications GET error:", e?.message ?? e);
    return Response.json({ error: "Could not load notifications" }, { status: 500 });
  }
}

// Marks a list of the member's own notifications read. Scoped to the session's
// member id, so a member can only mark their own. Returns the updated unread
// count so the caller can refresh the badge without a second request.
export async function PATCH(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === "string")
      : [];
    if (ids.length === 0) {
      return Response.json({ error: "No notifications to mark" }, { status: 400 });
    }

    await markNotificationsRead({ recipientId: session.sub, ids });
    const unreadCount = await countUnreadNotifications(session.sub);
    return Response.json({ ok: true, unreadCount });
  } catch (e: any) {
    console.error("community-notifications PATCH error:", e?.message ?? e);
    return Response.json({ error: "Could not update notifications" }, { status: 500 });
  }
}
