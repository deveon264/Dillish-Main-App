import { mintSessionToken } from "@/lib/adminAuth";
import { verifyPassword } from "@/lib/userAuth";
import { getUserByEmail, toPublicUser } from "@/lib/userStore";

// Verifies email + password against the server-side account store and, on
// success, issues a signed session token. The same generic error is returned
// whether the email is unknown or the password is wrong, so neither is leaked.
export async function POST(request: Request): Promise<Response> {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    if (!email || !password) {
      return Response.json({ error: "Incorrect email or password" }, { status: 401 });
    }

    const user = await getUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return Response.json({ error: "Incorrect email or password" }, { status: 401 });
    }

    const { token, expiresAt } = await mintSessionToken({
      sub: user.id,
      email: user.email,
      isAdmin: user.is_admin,
    });
    return Response.json({ user: toPublicUser(user), token, expiresAt });
  } catch (e: any) {
    console.error("login error:", e?.message ?? e);
    return Response.json({ error: "Could not sign in" }, { status: 500 });
  }
}
