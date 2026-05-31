import { getPool, ensureSchema } from "@/lib/db";
import { getVideoSignedUrl } from "@/lib/objectStorageServer";

// Resolves an exercise id to a short-lived signed object-storage URL and
// redirects the client there. Google Cloud Storage serves the bytes with
// native HTTP Range support, which iOS/Safari require for <video> playback.
export async function GET(request: Request): Promise<Response> {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT video_object_path FROM exercises WHERE id = $1",
      [id]
    );
    if (rows.length === 0) return new Response("Not found", { status: 404 });

    const url = await getVideoSignedUrl(rows[0].video_object_path, 3600);
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("exercise-video error:", e?.message ?? e);
    return new Response("Failed to stream video", { status: 500 });
  }
}
