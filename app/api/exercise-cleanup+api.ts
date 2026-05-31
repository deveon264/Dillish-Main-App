import { getPool, ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { getPrivateDir, listObjects, deleteObject } from "@/lib/objectStorageServer";

// Objects younger than this are never deleted, so an upload that is still
// in-flight (object written, DB row not yet inserted) is never mistaken for an
// orphan and removed out from under itself.
const GRACE_MS = 60 * 60 * 1000; // 1 hour

// Maintenance routine that removes exercise-video objects left behind in
// storage with no `exercises` row pointing at them. An object is created before
// its DB row, so a crash or cut-off request between the two writes can orphan
// the object (the inline cleanup only covers DB errors that are actually
// caught). This endpoint reconciles storage against the database.
//
// It is admin-gated, safe to run repeatedly (idempotent), and only deletes
// objects older than GRACE_MS. Pass `?dryRun=1` to preview what would be deleted
// without removing anything.
export async function POST(request: Request): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

    // Every video path currently referenced by the database.
    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query<{ video_object_path: string }>(
      `SELECT video_object_path FROM exercises`
    );
    const referenced = new Set(rows.map((r) => r.video_object_path));

    // Every object actually present under the exercise-videos folder.
    const prefix = `${getPrivateDir()}/exercise-videos/`;
    const objects = await listObjects(prefix);

    const cutoff = Date.now() - GRACE_MS;
    const orphans = objects.filter(
      (o) => !referenced.has(o.path) && o.createdAt > 0 && o.createdAt < cutoff
    );

    let deleted = 0;
    const failures: string[] = [];
    if (!dryRun) {
      for (const o of orphans) {
        try {
          await deleteObject(o.path);
          deleted++;
        } catch (err: any) {
          failures.push(o.path);
          console.error("orphan delete failed:", o.path, err?.message ?? err);
        }
      }
    }

    return Response.json({
      dryRun,
      scanned: objects.length,
      referenced: referenced.size,
      orphans: orphans.length,
      deleted,
      failed: failures.length,
      orphanPaths: orphans.map((o) => o.path),
    });
  } catch (e: any) {
    console.error("exercise-cleanup error:", e?.message ?? e);
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
