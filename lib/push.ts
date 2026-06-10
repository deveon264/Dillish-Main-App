import { listPushTokensForUser, deletePushTokens } from "@/lib/pushStore";

// Server-side delivery of moderation push notifications via the Expo push
// service. A warning or block already creates an in-app notice; this adds an
// out-of-app nudge so a member who never opens the app still learns of it.
//
// Best-effort by design: every function here swallows its own errors and never
// throws to the caller, so a push failure can never fail the moderation action
// that triggered it.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Expo accepts up to 100 messages per request; a member won't have many devices
// but we chunk defensively so a busy account never exceeds the limit.
const MAX_PER_REQUEST = 100;

export type ModerationPushKind = "warning" | "block";

// The title is the same for both: a member sees this as "a note from the team".
const PUSH_TITLE = "A note from your admin";

// What a blocked member sees in the push. The full explanation lives in the
// in-app block notice; this just gets them to open the app. No em dashes per the
// project's copy rules.
const BLOCK_PUSH_BODY =
  "An admin has restricted your community access. Open the app to learn more.";

// Keeps a warning push body short enough to read on a lock screen; the full
// message is always visible in the feed.
const MAX_BODY_CHARS = 178;

function bodyFor(kind: ModerationPushKind, message: string): string {
  if (kind === "block") return BLOCK_PUSH_BODY;
  const text = (message ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "An admin sent you a message. Open the app to read it.";
  if (text.length <= MAX_BODY_CHARS) return text;
  return text.slice(0, MAX_BODY_CHARS).trimEnd() + "...";
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Sends a moderation push to every device a member is signed in on. The data
// payload carries the kind so the app can route the tap to the community feed
// (where the notice and acknowledge action live). Tokens Expo reports as
// DeviceNotRegistered are pruned so we stop delivering to dead devices.
export async function sendModerationPush(input: {
  userId: string;
  kind: ModerationPushKind;
  message?: string;
}): Promise<void> {
  try {
    const tokens = await listPushTokensForUser(input.userId);
    if (tokens.length === 0) return;

    const body = bodyFor(input.kind, input.message ?? "");
    const dead: string[] = [];

    for (const batch of chunk(tokens, MAX_PER_REQUEST)) {
      const messages = batch.map((to) => ({
        to,
        title: PUSH_TITLE,
        body,
        sound: "default" as const,
        // The app reads this on tap to open the community feed.
        data: { type: "moderation", kind: input.kind },
      }));

      let resp: Response;
      try {
        resp = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
        });
      } catch (e: any) {
        console.error("moderation push send failed:", e?.message ?? e);
        continue;
      }

      let json: any = null;
      try {
        json = await resp.json();
      } catch {
        // Non-JSON (e.g. a 5xx HTML error page): nothing to reconcile.
      }

      const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
      tickets.forEach((ticket, i) => {
        if (
          ticket?.status === "error" &&
          ticket?.details?.error === "DeviceNotRegistered" &&
          batch[i]
        ) {
          dead.push(batch[i]);
        }
      });
    }

    if (dead.length > 0) {
      await deletePushTokens(dead);
    }
  } catch (e: any) {
    // Never let a push problem bubble up into the moderation action.
    console.error("sendModerationPush error:", e?.message ?? e);
  }
}
