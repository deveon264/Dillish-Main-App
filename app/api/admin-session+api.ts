import { verifyPasscode, mintAdminToken } from "@/lib/adminAuth";

// Exchanges the coach's passcode for a short-lived, server-signed admin token.
// The passcode is verified against a server-only secret (ADMIN_PASSCODE); the
// client never receives it back. The returned token is what authorizes uploads
// and deletes — see lib/adminAuth.ts.
export async function POST(request: Request): Promise<Response> {
  try {
    let passcode = "";
    try {
      const body = (await request.json()) as { passcode?: unknown };
      passcode = typeof body?.passcode === "string" ? body.passcode : "";
    } catch {
      passcode = "";
    }

    if (!verifyPasscode(passcode)) {
      return Response.json({ error: "Incorrect coach passcode" }, { status: 401 });
    }

    const { token, expiresAt } = await mintAdminToken();
    return Response.json({ token, expiresAt });
  } catch (e: any) {
    console.error("admin-session error:", e?.message ?? e);
    return Response.json({ error: "Could not start coach session" }, { status: 500 });
  }
}
