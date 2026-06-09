import { getPool, ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import {
  getPrivateDir,
  listObjects,
  deleteObject,
} from "@/lib/objectStorageServer";
import { sweepFolder, type SweepIO } from "@/app/api/exercise-cleanup+api";

// Objects younger than this are never deleted, so a photo that is still being
// turned into a post (object written, `community_posts` row not yet inserted) is
// never mistaken for an orphan and removed out from under itself.
const GRACE_MS = 60 * 60 * 1000; // 1 hour

// Maintenance routine that removes community-photo objects left behind in
// storage with no `community_posts` row pointing at them. A post photo is
// uploaded to storage before the post row is created, so a member who cancels
// the post (or a request that fails after the upload) orphans the object. Unlike
// meal photos (which are device-local and reclaimed purely by age), community
// posts live in Postgres, so this sweep reconciles the community-photos folder
// against the `community_posts.photo_object_path` column.
//
// It is admin-gated, safe to run repeatedly (idempotent), and only deletes
// objects older than GRACE_MS. Pass `?dryRun=1` to preview what would be deleted
// without removing anything.
export async function runCommunityPhotoCleanup(
  request: Request,
  io: SweepIO = { listObjects, deleteObject }
): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

    // Every photo path currently referenced by a community post.
    // `photo_object_path` is nullable (text-only posts), so skip null rows so a
    // null is never added to the set where it could match a stray value.
    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query<{ photo_object_path: string | null }>(
      `SELECT photo_object_path FROM community_posts WHERE photo_object_path IS NOT NULL`
    );
    const referenced = new Set(
      rows
        .map((r) => r.photo_object_path)
        .filter((p): p is string => p != null)
    );

    const cutoff = Date.now() - GRACE_MS;
    const photos = await sweepFolder(
      `${getPrivateDir()}/community-photos/`,
      referenced,
      cutoff,
      dryRun,
      io
    );

    // Log a one-line summary so a coach can confirm a run happened (and what it
    // did) from the deployment logs - important for the scheduled/cron trigger,
    // where there is no UI response to look at. Matches the exercise-cleanup
    // summary format.
    console.log(
      `community-photo-cleanup ${dryRun ? "(dry run) " : ""}by ${email}: ` +
        `scanned=${photos.scanned} ` +
        `referenced=${referenced.size} ` +
        `orphans=${photos.orphans} ` +
        `deleted=${photos.deleted} ` +
        `failed=${photos.failed}`
    );

    return Response.json({
      dryRun,
      scanned: photos.scanned,
      referenced: referenced.size,
      orphans: photos.orphans,
      deleted: photos.deleted,
      failed: photos.failed,
      orphanPaths: photos.orphanPaths,
    });
  } catch (e: any) {
    console.error("community-photo-cleanup error:", e?.message ?? e);
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

// Expo Router route handler. Delegates to the testable core with the real
// storage IO; tests call `runCommunityPhotoCleanup` directly with an injected
// fake.
export const POST = (request: Request): Promise<Response> =>
  runCommunityPhotoCleanup(request);
