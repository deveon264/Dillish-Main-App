import { requireSession } from "@/lib/adminAuth";
import { listActiveToday } from "@/lib/communityStore";

const AVATAR_LIMIT = 5;

// Members active in the community today (posted, liked, or commented since the
// start of the day). Powers the "N members were active today" strip above the
// feed. Returns a total distinct count plus a few of the most-recently-active
// members for the avatar row.
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const { count, members } = await listActiveToday({
      viewerId: session.sub,
      sinceMs: start.getTime(),
      avatarLimit: AVATAR_LIMIT,
    });

    return Response.json({ count, members });
  } catch (e: any) {
    console.error("community-active-today error:", e?.message ?? e);
    return Response.json({ error: "Could not load activity" }, { status: 500 });
  }
}
