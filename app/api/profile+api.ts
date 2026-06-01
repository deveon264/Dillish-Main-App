import { verifySessionToken } from "@/lib/adminAuth";
import { getUserProfile, patchUserProfile } from "@/lib/userStore";

async function requireSession(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return null;
  return verifySessionToken(m[1]);
}

// Returns the verified account's stored profile metrics, or `profile: null` if
// the account has never saved one (so the client can fall back / reconcile).
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });
    const profile = await getUserProfile(session.sub);
    return Response.json({ profile });
  } catch (e: any) {
    console.error("profile GET error:", e?.message ?? e);
    return Response.json({ error: "Could not load profile" }, { status: 500 });
  }
}

// Merges the patch over the account's existing profile (or the defaults for a
// first save), clamps every field server-side, persists it, and returns the
// stored profile. Used for onboarding writes, Profile-tab edits, and the
// one-time local→server reconciliation.
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
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const saved = await patchUserProfile(session.sub, body);
    if (!saved) return Response.json({ error: "Account not found" }, { status: 404 });
    return Response.json({ profile: saved });
  } catch (e: any) {
    console.error("profile PATCH error:", e?.message ?? e);
    return Response.json({ error: "Could not save profile" }, { status: 500 });
  }
}
