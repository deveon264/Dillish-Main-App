import { requireAdmin } from "@/lib/adminAuth";
import {
  getPrivateDir,
  listObjects,
  deleteObject,
} from "@/lib/objectStorageServer";
import { sweepFolder, type SweepIO } from "@/app/api/exercise-cleanup+api";

// How old a meal-photo object must be before it is eligible for reclamation.
//
// Unlike exercise media (which is reconciled against the `exercises` table),
// meal photos can't be reference-counted server-side: calorie logs live on the
// user's device, never in Postgres, so the server has no way to know which
// `meal-photos/*` objects are still referenced by an active log. Instead we
// reclaim purely by age — an object older than this window is assumed orphaned
// (the user has long since deleted or replaced that log). The window is
// deliberately generous so a photo attached to a still-visible recent log is
// never removed out from under it.
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// Maintenance routine that reclaims meal-photo objects left behind in storage.
// When a user deletes a calorie log — or re-saves one and picks a different
// stock photo — the previously re-hosted `meal-photos/<uuid>` object is
// orphaned. Because those logs are device-local, there is no DB table to
// reconcile against, so this sweep simply deletes any meal-photo object older
// than MAX_AGE_MS.
//
// It is admin-gated, safe to run repeatedly (idempotent), and only deletes
// objects past the age window. Pass `?dryRun=1` to preview what would be
// deleted without removing anything.
export async function runMealPhotoCleanup(
  request: Request,
  io: SweepIO = { listObjects, deleteObject }
): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

    // No DB reconciliation is possible (logs are device-local), so nothing is
    // ever "referenced" — every object is judged purely by age. Reusing the
    // exercise sweep with an empty referenced set turns it into an age-only
    // sweep: an object is an orphan when it is older than the cutoff.
    const cutoff = Date.now() - MAX_AGE_MS;
    const referenced = new Set<string>();
    const photos = await sweepFolder(
      `${getPrivateDir()}/meal-photos/`,
      referenced,
      cutoff,
      dryRun,
      io
    );

    // Log a one-line summary so a coach can confirm a run happened (and what it
    // did) from the deployment logs — important for the scheduled/cron trigger,
    // where there is no UI response to look at. Matches the exercise-cleanup
    // summary format.
    console.log(
      `meal-photo-cleanup ${dryRun ? "(dry run) " : ""}by ${email}: ` +
        `scanned=${photos.scanned} ` +
        `orphans=${photos.orphans} ` +
        `deleted=${photos.deleted} ` +
        `failed=${photos.failed} ` +
        `maxAgeDays=${MAX_AGE_MS / (24 * 60 * 60 * 1000)}`
    );

    return Response.json({
      dryRun,
      maxAgeDays: MAX_AGE_MS / (24 * 60 * 60 * 1000),
      scanned: photos.scanned,
      orphans: photos.orphans,
      deleted: photos.deleted,
      failed: photos.failed,
      orphanPaths: photos.orphanPaths,
    });
  } catch (e: any) {
    console.error("meal-photo-cleanup error:", e?.message ?? e);
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

// Expo Router route handler. Delegates to the testable core with the real
// storage IO; tests call `runMealPhotoCleanup` directly with an injected fake.
export const POST = (request: Request): Promise<Response> =>
  runMealPhotoCleanup(request);
