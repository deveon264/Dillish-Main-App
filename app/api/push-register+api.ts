import { requireSession } from "@/lib/adminAuth";
import { savePushToken, removePushToken } from "@/lib/pushStore";

// Registers (or de-registers) a device's Expo push token for the signed-in
// member, so a moderation action (warning/block) can reach them even when the
// app is closed. Any verified member can manage their own device tokens.
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

    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) return Response.json({ error: "Missing push token" }, { status: 400 });
    const platform = typeof body?.platform === "string" ? body.platform.slice(0, 32) : "";

    await savePushToken({ userId: session.sub, token, platform });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("push-register POST error:", e?.message ?? e);
    return Response.json({ error: "Could not register for notifications" }, { status: 500 });
  }
}

// Drops a device token on sign-out so a member stops receiving pushes on a
// device they have left. Scoped to the member's own id.
export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const token = new URL(request.url).searchParams.get("token");
    if (!token) return Response.json({ error: "Missing push token" }, { status: 400 });

    await removePushToken({ userId: session.sub, token });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("push-register DELETE error:", e?.message ?? e);
    return Response.json({ error: "Could not unregister notifications" }, { status: 500 });
  }
}
