import { getPool, ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { getVideoSignedUrl, signedObjectResponse, uploadExercisePosterStream, deleteObject } from "@/lib/objectStorageServer";

const MAX_POSTER_BYTES = 8 * 1024 * 1024; // 8MB

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
    // Posters are static once uploaded; let clients cache the response.
    return signedObjectResponse(url, request, "private, max-age=600");
  } catch (e: any) {
    console.error("exercise-poster error:", e?.message ?? e);
    return new Response("Failed to load poster", { status: 500 });
  }
}

// Attaches (or replaces) the poster image for an existing exercise. The image
// is sent as the raw request body and streamed straight to object storage, with
// the size enforced from Content-Length before the body is read. Coach-only.
export async function POST(request: Request): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim() || "image/jpeg";
    if (!mime.startsWith("image/")) {
      return Response.json({ error: "Poster must be an image" }, { status: 400 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (!contentLength || !Number.isFinite(contentLength)) {
      return Response.json({ error: "A poster image is required" }, { status: 411 });
    }
    if (contentLength > MAX_POSTER_BYTES) {
      return Response.json({ error: "Poster is too large (max 8MB)" }, { status: 413 });
    }
    if (!request.body) {
      return Response.json({ error: "A poster image is required" }, { status: 400 });
    }

    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT poster_object_path FROM exercises WHERE id = $1",
      [id]
    );
    if (rows.length === 0) {
      return Response.json({ error: "Exercise not found" }, { status: 404 });
    }
    const previousPoster = rows[0].poster_object_path as string | null;

    // Abort the stream the instant it crosses the limit instead of buffering it.
    let seen = 0;
    const limited = request.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          seen += chunk.byteLength;
          if (seen > MAX_POSTER_BYTES) {
            controller.error(new Error("POSTER_TOO_LARGE"));
            return;
          }
          controller.enqueue(chunk);
        },
      })
    );

    let posterPath: string;
    try {
      posterPath = await uploadExercisePosterStream(limited, mime, contentLength);
    } catch (e: any) {
      if (String(e?.message).includes("POSTER_TOO_LARGE")) {
        return Response.json({ error: "Poster is too large (max 8MB)" }, { status: 413 });
      }
      throw e;
    }

    try {
      await pool.query(
        "UPDATE exercises SET poster_object_path = $1, poster_mime = $2 WHERE id = $3",
        [posterPath, mime, id]
      );
    } catch (dbErr) {
      await deleteObject(posterPath).catch(() => {});
      throw dbErr;
    }

    // Best-effort cleanup of the poster we just replaced.
    if (previousPoster) await deleteObject(previousPoster).catch(() => {});

    return Response.json({ ok: true, hasPoster: true });
  } catch (e: any) {
    console.error("exercise-poster POST error:", e?.message ?? e);
    return Response.json({ error: "Failed to upload poster" }, { status: 500 });
  }
}
