import { getPool, ensureSchema } from "@/lib/db";
import { getVideoSignedUrl } from "@/lib/objectStorageServer";

// Resolves an exercise id to a short-lived signed object-storage URL for its
// poster image and redirects the client there. Returns 404 when the exercise
// has no poster so the client can fall back to a placeholder.
export async function GET(request: Request): Promise<Response> {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT poster_object_path FROM exercises WHERE id = $1",
      [id]
    );
    if (rows.length === 0 || !rows[0].poster_object_path) {
      return new Response("Not found", { status: 404 });
    }

    const url = await getVideoSignedUrl(rows[0].poster_object_path, 3600);
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        // Posters are static once uploaded; let clients cache the redirect.
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (e: any) {
    console.error("exercise-poster error:", e?.message ?? e);
    return new Response("Failed to load poster", { status: 500 });
  }
}
