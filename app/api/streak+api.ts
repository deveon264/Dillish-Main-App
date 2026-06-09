import { verifySessionToken } from "@/lib/adminAuth";
import { getUserStreak, recordUserActiveDay } from "@/lib/userStore";
import { isDayKey } from "@/lib/streak";

async function requireSession(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return null;
  return verifySessionToken(m[1]);
}

// Returns the verified account's stored streak state, or `streak: null` if the
// account has never recorded an active day (so the client can fall back to its
// local cache and reconcile).
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });
    const streak = await getUserStreak(session.sub);
    return Response.json({ streak });
  } catch (e: any) {
    console.error("streak GET error:", e?.message ?? e);
    return Response.json({ error: "Could not load streak" }, { status: 500 });
  }
}

// Records today (the device's local day key) as an active day for the verified
// account and returns the updated streak state. The client also sends its local
// rolling window (`recentDays`) so days recorded offline reconcile here on the
// next successful sync. The day key is supplied by the client because only the
// device knows its own local calendar day (server time zone may differ).
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
    const day = body?.day;
    if (!isDayKey(day)) return Response.json({ error: "Invalid day" }, { status: 400 });

    const extraDays = Array.isArray(body?.recentDays)
      ? (body.recentDays as unknown[]).filter(isDayKey)
      : [];

    const saved = await recordUserActiveDay(session.sub, day, extraDays);
    if (!saved) return Response.json({ error: "Account not found" }, { status: 404 });
    return Response.json({ streak: saved });
  } catch (e: any) {
    console.error("streak POST error:", e?.message ?? e);
    return Response.json({ error: "Could not save streak" }, { status: 500 });
  }
}
