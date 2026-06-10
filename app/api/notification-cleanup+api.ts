import { requireAdmin } from "@/lib/adminAuth";
import {
  deleteOldNotifications,
  NOTIFICATION_MAX_AGE_MS,
} from "@/lib/communityStore";

// Maintenance routine that deletes `community_notifications` rows the inbox can
// no longer show. Unlike the storage sweeps (which reconcile object storage
// against a DB table), notifications live entirely in Postgres and are reclaimed
// purely by age: reads already hide rows older than NOTIFICATION_MAX_AGE_MS, so
// deleting them frees the row without changing anything a member can see. Without
// this sweep the table grows forever.
//
// It is admin-gated, safe to run repeatedly (idempotent), and only deletes rows
// past the age window. Pass `?dryRun=1` to preview the count without deleting.
export async function runNotificationCleanup(request: Request): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const { scanned, deleted } = await deleteOldNotifications({ dryRun });
    const maxAgeDays = NOTIFICATION_MAX_AGE_MS / (24 * 60 * 60 * 1000);

    // Log a one-line summary so an admin can confirm a run happened (and what it
    // did) from the deployment logs - important for the scheduled/cron trigger,
    // where there is no UI response to look at. Matches the storage-cleanup
    // summary format.
    console.log(
      `notification-cleanup ${dryRun ? "(dry run) " : ""}by ${email}: ` +
        `scanned=${scanned} ` +
        `deleted=${deleted} ` +
        `maxAgeDays=${maxAgeDays}`
    );

    return Response.json({ dryRun, maxAgeDays, scanned, deleted });
  } catch (e: any) {
    console.error("notification-cleanup error:", e?.message ?? e);
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

// Expo Router route handler. Delegates to the testable core; tests call
// `runNotificationCleanup` directly with an injected fake db.
export const POST = (request: Request): Promise<Response> =>
  runNotificationCleanup(request);
