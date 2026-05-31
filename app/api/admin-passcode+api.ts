import { requireAdmin, rotatePasscode } from "@/lib/adminAuth";

// Rotates the coach passcode. The caller must (1) present a valid admin token
// (proving an active coach session) and (2) supply the current passcode, which
// is re-verified before the new one is accepted. The new passcode is persisted
// server-side and overrides the ADMIN_PASSCODE env var going forward.
export async function POST(request: Request): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Coach session required" }, { status: 401 });
    }

    let current = "";
    let next = "";
    try {
      const body = (await request.json()) as { currentPasscode?: unknown; newPasscode?: unknown };
      current = typeof body?.currentPasscode === "string" ? body.currentPasscode : "";
      next = typeof body?.newPasscode === "string" ? body.newPasscode : "";
    } catch {
      current = "";
      next = "";
    }

    const result = await rotatePasscode(current, next);
    if (!result.ok) {
      return Response.json({ error: result.error ?? "Could not change passcode" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("admin-passcode error:", e?.message ?? e);
    return Response.json({ error: "Could not change passcode" }, { status: 500 });
  }
}
