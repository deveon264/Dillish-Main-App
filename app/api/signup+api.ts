import { isAdminEmail } from "@/constants/admin";
import { verifyPasscode, mintSessionToken } from "@/lib/adminAuth";
import { hashPassword } from "@/lib/userAuth";
import { createUser, emailTaken, toPublicUser } from "@/lib/userStore";

function logAuthError(scope: string, e: any) {
  const code = e?.code ? ` code=${e.code}` : "";
  const message = e?.message ?? String(e);
  console.error(`${scope}:${code} ${message}`);
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 11);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Registers a real, server-verified account and returns a signed session token.
// The account flagged is_admin is the coach. Claiming the coach email requires
// the server-only ADMIN_PASSCODE, so a member can't become admin by simply
// signing up with that email.
export async function POST(request: Request): Promise<Response> {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const passcode = typeof body?.passcode === "string" ? body.passcode : "";

    if (!name) return Response.json({ error: "Please enter your name" }, { status: 400 });
    if (!EMAIL_RE.test(email)) return Response.json({ error: "Enter a valid email" }, { status: 400 });
    if (password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const admin = isAdminEmail(email);
    if (admin && !(await verifyPasscode(passcode))) {
      return Response.json(
        { error: "Admin passcode required to use this email" },
        { status: 403 }
      );
    }

    if (await emailTaken(email)) {
      return Response.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await createUser({ id: genId(), name, email, passwordHash, isAdmin: admin });
    } catch (e: any) {
      if (String(e?.code) === "23505") {
        return Response.json({ error: "An account with this email already exists" }, { status: 409 });
      }
      throw e;
    }

    const { token, expiresAt } = await mintSessionToken({
      sub: user.id,
      email: user.email,
      isAdmin: user.is_admin,
    });
    return Response.json({ user: toPublicUser(user), token, expiresAt });
  } catch (e: any) {
    logAuthError("signup error", e);
    return Response.json({ error: "Could not create account" }, { status: 500 });
  }
}
