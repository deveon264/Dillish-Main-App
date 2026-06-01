import { verifyResetToken, resetTokenMatchesPassword, mintSessionToken } from "@/lib/adminAuth";
import { hashPassword } from "@/lib/userAuth";
import { getUserById, updateUserPassword, toPublicUser } from "@/lib/userStore";

// Completes a password reset. Given a valid reset token and a new password, it
// sets the new password and issues a fresh session token so the member is
// signed straight in. The token is single-use: it's bound to the account's
// previous password hash, so once the password changes the same token (and any
// older one) no longer verifies.
export async function POST(request: Request): Promise<Response> {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const token = String(body?.token ?? "");
    const password = String(body?.password ?? "");
    if (password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const verified = await verifyResetToken(token);
    if (!verified) {
      return Response.json({ error: "This reset link is invalid or has expired" }, { status: 400 });
    }

    const user = await getUserById(verified.sub);
    if (!user) {
      return Response.json({ error: "This reset link is invalid or has expired" }, { status: 400 });
    }

    // Reject a token whose fingerprint no longer matches the current password
    // (already used, or superseded by a newer reset).
    if (!(await resetTokenMatchesPassword(verified.fp, user.password_hash))) {
      return Response.json({ error: "This reset link has already been used" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const updated = await updateUserPassword(user.id, passwordHash);
    if (!updated) {
      return Response.json({ error: "Could not reset password" }, { status: 500 });
    }

    const { token: session, expiresAt } = await mintSessionToken({
      sub: updated.id,
      email: updated.email,
      isAdmin: updated.is_admin,
    });
    return Response.json({ user: toPublicUser(updated), token: session, expiresAt });
  } catch (e: any) {
    console.error("password-reset-complete error:", e?.message ?? e);
    return Response.json({ error: "Could not reset password" }, { status: 500 });
  }
}
