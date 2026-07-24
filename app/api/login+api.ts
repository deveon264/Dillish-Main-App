import { mintSessionToken } from "@/lib/adminAuth";
import { verifyPassword } from "@/lib/userAuth";
import { getUserByEmail, toPublicUser } from "@/lib/userStore";
import { rateLimit, clientIp, tooMany } from "@/lib/rateLimit";

function logAuthError(scope: string, e: any) {
  const code = e?.code ? ` code=${e.code}` : "";
  const message = e?.message ?? String(e);
  console.error(`${scope}:${code} ${message}`);
}

// Verifies email + password against the server-side account store and, on
// success, issues a signed session token. The same generic error is returned
// whether the email is unknown or the password is wrong, so neither is leaked.
export async function POST(request: Request): Promise<Response> {
  try {
    // Generous per-IP cap so shared carrier/NAT addresses aren't locked out;
    // the tight per-email cap below is the real brute-force guard.
    const ipRl = await rateLimit(`login:ip:${clientIp(request)}`, { limit: 30, windowSec: 900 });
    if (!ipRl.ok) return tooMany(ipRl.retryAfterSec);

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

    // Counts every attempt (success or fail) against this specific account, so
    // guessing one account's password is throttled regardless of source IP.
    const emailRl = await rateLimit(`login:email:${email}`, { limit: 6, windowSec: 900 });
    if (!emailRl.ok) return tooMany(emailRl.retryAfterSec);

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
    logAuthError("login error", e);
    return Response.json({ error: "Could not sign in" }, { status: 500 });
  }
}
