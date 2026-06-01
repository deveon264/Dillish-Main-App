import { ADMIN_EMAIL, isAdminEmail } from "@/constants/admin";
import { verifySessionToken } from "@/lib/adminAuth";
import { getUserById, updateUserRow, emailTaken, toPublicUser } from "@/lib/userStore";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function requireSession(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return null;
  return verifySessionToken(m[1]);
}

// Returns the verified account behind the session token. Used to restore the
// session on app launch and after login.
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });
    const user = await getUserById(session.sub);
    if (!user) return Response.json({ error: "Account not found" }, { status: 404 });
    return Response.json({ user: toPublicUser(user) });
  } catch (e: any) {
    console.error("me GET error:", e?.message ?? e);
    return Response.json({ error: "Could not load account" }, { status: 500 });
  }
}

// Updates mutable profile fields and onboarding state for the verified account.
// is_admin is never mutable here, and email changes can't be used to claim (or
// abandon) the coach identity.
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

    // Profile photos are handled by the dedicated /api/avatar endpoint (bytes go
    // to object storage), so they are intentionally not accepted here — this
    // keeps name/email/onboarding updates free of any image payload.
    const fields: { name?: string; email?: string; onboardingComplete?: boolean } = {};

    if (body?.name !== undefined) {
      const n = String(body.name).trim();
      if (!n) return Response.json({ error: "Please enter your name" }, { status: 400 });
      fields.name = n;
    }

    if (body?.email !== undefined) {
      const em = String(body.email).trim().toLowerCase();
      if (!EMAIL_RE.test(em)) return Response.json({ error: "Enter a valid email" }, { status: 400 });
      if (isAdminEmail(em) && session.role !== "admin") {
        return Response.json({ error: "This email is reserved" }, { status: 403 });
      }
      if (session.role === "admin" && em !== ADMIN_EMAIL) {
        return Response.json({ error: "The coach account email can't be changed" }, { status: 403 });
      }
      if (await emailTaken(em, session.sub)) {
        return Response.json({ error: "An account with this email already exists" }, { status: 409 });
      }
      fields.email = em;
    }

    if (body?.onboardingComplete !== undefined) {
      fields.onboardingComplete = !!body.onboardingComplete;
    }

    const user = await updateUserRow(session.sub, fields);
    if (!user) return Response.json({ error: "Account not found" }, { status: 404 });
    return Response.json({ user: toPublicUser(user) });
  } catch (e: any) {
    console.error("me PATCH error:", e?.message ?? e);
    return Response.json({ error: "Could not update account" }, { status: 500 });
  }
}
