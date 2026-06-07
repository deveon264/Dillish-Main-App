import { verifySessionToken } from "@/lib/adminAuth";
import { getUserSubscription, setUserSubscription } from "@/lib/userStore";
import {
  type Subscription,
  isPlanKey,
  seededActiveSubscription,
  subscribeTo,
  switchPlan,
  cancelSubscription,
  resumeSubscription,
} from "@/lib/subscription";

async function requireSession(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return null;
  return verifySessionToken(m[1]);
}

// Returns the verified account's subscription. Accounts that have never had one
// are lazily seeded with a real, active (placeholder) subscription and that
// seed is persisted, so the Plan tab always shows a manageable plan rather than
// an empty state. A member who has explicitly canceled/lapsed keeps that state
// (it is a set record, so it is never re-seeded).
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    let sub = await getUserSubscription(session.sub);
    if (!sub) {
      const seeded = await setUserSubscription(session.sub, seededActiveSubscription());
      if (!seeded) return Response.json({ error: "Account not found" }, { status: 404 });
      sub = seeded;
    }
    return Response.json({ subscription: sub });
  } catch (e: any) {
    console.error("subscription GET error:", e?.message ?? e);
    return Response.json({ error: "Could not load subscription" }, { status: 500 });
  }
}

// Applies a subscription action for the verified account and returns the updated
// record. Actions: subscribe (with optional free trial), switch (change plan),
// cancel (stop renewing, keep access until period end), resume (undo cancel).
//
// The placeholder provider computes the next state locally. To wire a real
// gateway, call its SDK here (and let webhooks reconcile setUserSubscription).
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
    const action = body?.action;

    const current =
      (await getUserSubscription(session.sub)) ?? seededActiveSubscription();

    let next: Subscription;
    switch (action) {
      case "subscribe": {
        if (!isPlanKey(body?.planKey)) {
          return Response.json({ error: "Unknown plan" }, { status: 400 });
        }
        next = subscribeTo(current, body.planKey, { trial: !!body?.trial });
        break;
      }
      case "switch": {
        if (!isPlanKey(body?.planKey)) {
          return Response.json({ error: "Unknown plan" }, { status: 400 });
        }
        next = switchPlan(current, body.planKey);
        break;
      }
      case "cancel":
        next = cancelSubscription(current);
        break;
      case "resume":
        next = resumeSubscription(current);
        break;
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    const saved = await setUserSubscription(session.sub, next);
    if (!saved) return Response.json({ error: "Account not found" }, { status: 404 });
    return Response.json({ subscription: saved });
  } catch (e: any) {
    console.error("subscription POST error:", e?.message ?? e);
    return Response.json({ error: "Could not update subscription" }, { status: 500 });
  }
}
