import { getPool, ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { getPrivateDir, listObjects, deleteObject } from "@/lib/objectStorageServer";

// Objects younger than this are never deleted, so an upload that is still
// in-flight (object written, DB row not yet inserted) is never mistaken for an
// orphan and removed out from under itself.
const GRACE_MS = 60 * 60 * 1000; // 1 hour

// Maintenance routine that removes exercise media objects left behind in
// storage with no `exercises` row pointing at them. Both videos and poster
// images are written to storage before their DB row/column is set, so a crash
// or cut-off request between the two writes can orphan the object (the inline
// cleanup only covers DB errors that are actually caught). This endpoint
// reconciles both the exercise-videos and exercise-posters folders against the
// database.
//
// It is admin-gated, safe to run repeatedly (idempotent), and only deletes
// objects older than GRACE_MS. Pass `?dryRun=1` to preview what would be deleted
// without removing anything.

// Storage IO the sweep depends on. Defaults to the real object-storage helpers;
// tests inject fakes so the reconciliation logic can be exercised without
// touching real storage.
export type SweepIO = {
  listObjects: typeof listObjects;
  deleteObject: typeof deleteObject;
};

// A single row's media paths as stored in the `exercises` table. The poster is
// nullable because posters were added after the initial release and older rows
// may not have one.
export type ExerciseMediaRow = {
  video_object_path: string;
  poster_object_path: string | null;
};

// Builds the sets of object paths the database still references. A row with a
// null `poster_object_path` contributes nothing to the poster set, so an
// unrelated poster object is never accidentally treated as referenced (and a
// null is never added to the set where it could match a stray value).
export function referencedPaths(rows: ExerciseMediaRow[]): {
  videos: Set<string>;
  posters: Set<string>;
} {
  return {
    videos: new Set(rows.map((r) => r.video_object_path)),
    posters: new Set(
      rows
        .map((r) => r.poster_object_path)
        .filter((p): p is string => p != null)
    ),
  };
}

// Reconciles a single storage folder against the set of paths the database
// still references, deleting any object that is orphaned and older than the
// grace window. Returns per-folder stats.
export async function sweepFolder(
  prefix: string,
  referenced: Set<string>,
  cutoff: number,
  dryRun: boolean,
  io: SweepIO = { listObjects, deleteObject }
): Promise<{
  scanned: number;
  orphans: number;
  deleted: number;
  failed: number;
  orphanPaths: string[];
}> {
  const objects = await io.listObjects(prefix);
  const orphans = objects.filter(
    (o) => !referenced.has(o.path) && o.createdAt > 0 && o.createdAt < cutoff
  );

  let deleted = 0;
  const failures: string[] = [];
  if (!dryRun) {
    for (const o of orphans) {
      try {
        await io.deleteObject(o.path);
        deleted++;
      } catch (err: any) {
        failures.push(o.path);
        console.error("orphan delete failed:", o.path, err?.message ?? err);
      }
    }
  }

  return {
    scanned: objects.length,
    orphans: orphans.length,
    deleted,
    failed: failures.length,
    orphanPaths: orphans.map((o) => o.path),
  };
}

// Testable core. The sweep only ever reconciles the exercise-videos and
// exercise-posters folders against the `exercises` table; the onboarding
// thank-you video lives under its own `thank-you-videos/` prefix and is
// deliberately never listed or deleted here. `io` defaults to the real storage
// helpers; tests inject a fake to assert exactly which folders are swept.
export async function runCleanup(
  request: Request,
  io: SweepIO = { listObjects, deleteObject }
): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

    // Every video and poster path currently referenced by the database.
    // `poster_object_path` is nullable, so skip rows without a poster.
    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query<ExerciseMediaRow>(
      `SELECT video_object_path, poster_object_path FROM exercises`
    );
    const { videos: referencedVideos, posters: referencedPosters } =
      referencedPaths(rows);

    const cutoff = Date.now() - GRACE_MS;
    const videos = await sweepFolder(
      `${getPrivateDir()}/exercise-videos/`,
      referencedVideos,
      cutoff,
      dryRun,
      io
    );
    const posters = await sweepFolder(
      `${getPrivateDir()}/exercise-posters/`,
      referencedPosters,
      cutoff,
      dryRun,
      io
    );

    // Log a one-line summary so a coach can confirm a run happened (and what it
    // did) from the deployment logs — important for the scheduled/cron trigger,
    // where there is no UI response to look at.
    console.log(
      `exercise-cleanup ${dryRun ? "(dry run) " : ""}by ${email}: ` +
        `scanned=${videos.scanned + posters.scanned} ` +
        `referenced=${referencedVideos.size + referencedPosters.size} ` +
        `orphans=${videos.orphans + posters.orphans} ` +
        `deleted=${videos.deleted + posters.deleted} ` +
        `failed=${videos.failed + posters.failed}`
    );

    return Response.json({
      dryRun,
      scanned: videos.scanned + posters.scanned,
      referenced: referencedVideos.size + referencedPosters.size,
      orphans: videos.orphans + posters.orphans,
      deleted: videos.deleted + posters.deleted,
      failed: videos.failed + posters.failed,
      orphanPaths: [...videos.orphanPaths, ...posters.orphanPaths],
      videos,
      posters,
    });
  } catch (e: any) {
    console.error("exercise-cleanup error:", e?.message ?? e);
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

// Expo Router route handler. Delegates to the testable core with the real
// storage IO; tests call `runCleanup` directly with an injected fake.
export const POST = (request: Request): Promise<Response> => runCleanup(request);
