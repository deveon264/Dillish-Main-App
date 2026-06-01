import { mintResetToken } from "@/lib/adminAuth";
import { getUserByEmail } from "@/lib/userStore";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Starts a password reset. Given an email, it mints a short-lived, single-use
// reset token (HMAC-signed with the existing SESSION_SECRET) for the matching
// account.
//
// SECURITY NOTE: a real reset token must reach only the account owner, normally
// via an email link. This app has no email channel yet, so the token is returned
// directly to the client to keep the in-app reset flow functional. Until email
// delivery is wired up, treat this as a prototype: anyone who knows an email
// could reset that account. The response is otherwise generic so it never
// confirms whether an email is registered.
export async function POST(request: Request): Promise<Response> {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: "Enter a valid email" }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    // Generic acknowledgement either way so the endpoint can't be used to probe
    // which emails have accounts.
    const generic = {
      ok: true,
      message: "If an account exists for that email, you can now set a new password.",
    };
    if (!user) return Response.json(generic);

    const { token, expiresAt } = await mintResetToken({
      sub: user.id,
      passwordHash: user.password_hash,
    });
    return Response.json({ ...generic, token, expiresAt });
  } catch (e: any) {
    console.error("password-reset-request error:", e?.message ?? e);
    return Response.json({ error: "Could not start password reset" }, { status: 500 });
  }
}
