import { getPool, ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import {
  getPrivateDir,
  listObjects,
  deleteObject,
} from "@/lib/objectStorageServer";
import { sweepFolder, type SweepIO } from "@/app/api/exercise-cleanup+api";

// Objects younger than this are never deleted, so an avatar that is still being
// saved (object written, `users.avatar_object_path` not yet updated) is never
// mistaken for an orphan and removed out from under itself.
const GRACE_MS = 60 * 60 * 1000; // 1 hour

// Maintenance routine that removes profile-avatar objects left behind in
// storage with no `users` row pointing at them. When a member replaces their
// avatar, the new object is written before `users.avatar_object_path` is
// updated and the old object is deleted inline, so a crash or cut-off request
// between those steps can orphan either object (the inline cleanup only covers
// errors that are actually caught). Like exercise media and community photos,
// avatars live in Postgres, so this sweep reconciles the profile-avatars folder
// against the `users.avatar_object_path` column.
//
// It is admin-gated, safe to run repeatedly (idempotent), and only deletes
// objects older than GRACE_MS. Pass `?dryRun=1` to preview what would be deleted
// without removing anything.
export async function runProfileAvatarCleanup(
  request: Request,
  io: SweepIO = { listObjects, deleteObject }
): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

    // Every avatar path currently referenced by a user. `avatar_object_path` is
    // nullable (members who never uploaded a photo, or who use the legacy inline
    // `avatar`), so skip null rows so a null is never added to the set where it
    // could match a stray value.
    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query<{ avatar_object_path: string | null }>(
      `SELECT avatar_object_path FROM users WHERE avatar_object_path IS NOT NULL`
    );
    const referenced = new Set(
      rows
        .map((r) => r.avatar_object_path)
        .filter((p): p is string => p != null)
    );

    const cutoff = Date.now() - GRACE_MS;
    const avatars = await sweepFolder(
      `${getPrivateDir()}/profile-avatars/`,
      referenced,
      cutoff,
      dryRun,
      io
    );

    // Log a one-line summary so an admin can confirm a run happened (and what it
    // did) from the deployment logs - important for the scheduled/cron trigger,
    // where there is no UI response to look at. Matches the exercise-cleanup
    // summary format.
    console.log(
      `profile-avatar-cleanup ${dryRun ? "(dry run) " : ""}by ${email}: ` +
        `scanned=${avatars.scanned} ` +
        `referenced=${referenced.size} ` +
        `orphans=${avatars.orphans} ` +
        `deleted=${avatars.deleted} ` +
        `failed=${avatars.failed}`
    );

    return Response.json({
      dryRun,
      scanned: avatars.scanned,
      referenced: referenced.size,
      orphans: avatars.orphans,
      deleted: avatars.deleted,
      failed: avatars.failed,
      orphanPaths: avatars.orphanPaths,
    });
  } catch (e: any) {
    console.error("profile-avatar-cleanup error:", e?.message ?? e);
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

// Expo Router route handler. Delegates to the testable core with the real
// storage IO; tests call `runProfileAvatarCleanup` directly with an injected
// fake.
export const POST = (request: Request): Promise<Response> =>
  runProfileAvatarCleanup(request);
