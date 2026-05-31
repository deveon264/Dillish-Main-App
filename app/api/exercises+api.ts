import { getPool, ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { uploadExerciseVideoStream, deleteObject } from "@/lib/objectStorageServer";

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 11);
}

const MAX_BYTES = 80 * 1024 * 1024; // 80MB
const CATEGORIES = ["Pilates", "Yoga", "Strength", "HIIT", "Mobility", "Cardio"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

function mapRow(r: any) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    cues: r.cues,
    category: r.category,
    level: r.level,
    duration: r.duration,
    videoMime: r.video_mime,
    videoSize: Number(r.video_size),
    hasPoster: !!r.poster_object_path,
    createdAt: Number(r.created_at),
  };
}

export async function GET(): Promise<Response> {
  try {
    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, title, description, cues, category, level, duration, video_mime, video_size, poster_object_path, created_by, created_at
       FROM exercises ORDER BY created_at DESC`
    );
    return Response.json({ items: rows.map(mapRow) });
  } catch (e: any) {
    console.error("exercises GET error:", e?.message ?? e);
    return Response.json({ error: "Failed to load exercises" }, { status: 500 });
  }
}

// The video is sent as the raw request body (not multipart), with the text
// metadata carried in query params. This lets the server enforce the size limit
// from the Content-Length header BEFORE touching the body, and stream the bytes
// straight to object storage without ever buffering the whole file in memory.
// The optional poster image is uploaded separately to /api/exercise-poster
// (keyed by the id returned here), since the body is reserved for the video.
export async function POST(request: Request): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const params = new URL(request.url).searchParams;
    const title = (params.get("title") ?? "").trim();
    const description = (params.get("description") ?? "").trim();
    const cues = (params.get("cues") ?? "").trim();
    const duration = (params.get("duration") ?? "").trim();
    let category = (params.get("category") ?? "Strength").trim();
    let level = (params.get("level") ?? "Beginner").trim();

    if (!title) return Response.json({ error: "Title is required" }, { status: 400 });
    if (!CATEGORIES.includes(category)) category = "Strength";
    if (!LEVELS.includes(level)) level = "Beginner";

    const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim() || "video/mp4";
    if (!mime.startsWith("video/")) {
      return Response.json({ error: "Uploaded file must be a video" }, { status: 400 });
    }

    // Enforce the size limit from the declared length up front, before reading
    // any of the body into memory.
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (!contentLength || !Number.isFinite(contentLength)) {
      return Response.json({ error: "A video file is required" }, { status: 411 });
    }
    if (contentLength > MAX_BYTES) {
      return Response.json({ error: "Video is too large (max 80MB)" }, { status: 413 });
    }
    if (!request.body) {
      return Response.json({ error: "A video file is required" }, { status: 400 });
    }

    // Guard against a body that exceeds the declared length: abort the stream
    // (and the upload) the instant it crosses the limit instead of buffering it.
    let seen = 0;
    const limited = request.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          seen += chunk.byteLength;
          if (seen > MAX_BYTES) {
            controller.error(new Error("VIDEO_TOO_LARGE"));
            return;
          }
          controller.enqueue(chunk);
        },
      })
    );

    // Stream the bytes straight to object storage; keep only a reference in Postgres.
    let objectPath: string;
    try {
      objectPath = await uploadExerciseVideoStream(limited, mime, contentLength);
    } catch (e: any) {
      if (String(e?.message).includes("VIDEO_TOO_LARGE")) {
        return Response.json({ error: "Video is too large (max 80MB)" }, { status: 413 });
      }
      throw e;
    }

    const id = genId();
    const createdAt = Date.now();
    await ensureSchema();
    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO exercises
           (id, title, description, cues, category, level, duration, video_object_path, video_mime, video_size, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, title, description, cues, category, level, duration, objectPath, mime, contentLength, String(email).toLowerCase(), createdAt]
      );
    } catch (dbErr) {
      // Don't leave orphaned objects if the DB write fails.
      await deleteObject(objectPath).catch(() => {});
      throw dbErr;
    }

    return Response.json({
      item: {
        id,
        title,
        description,
        cues,
        category,
        level,
        duration,
        videoMime: mime,
        videoSize: contentLength,
        hasPoster: false,
        createdAt,
      },
    });
  } catch (e: any) {
    console.error("exercises POST error:", e?.message ?? e);
    return Response.json({ error: "Failed to upload exercise" }, { status: 500 });
  }
}

// Updates only the text metadata of an existing exercise (title, description,
// cues, duration, category, level). The video bytes and poster are untouched —
// the fields arrive as a small JSON body so coaches can fix typos or tweak cues
// without re-uploading the video. Poster swaps stay on /api/exercise-poster.
export async function PATCH(request: Request): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const title = String(body?.title ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const cues = String(body?.cues ?? "").trim();
    const duration = String(body?.duration ?? "").trim();
    let category = String(body?.category ?? "Strength").trim();
    let level = String(body?.level ?? "Beginner").trim();

    if (!title) return Response.json({ error: "Title is required" }, { status: 400 });
    if (!CATEGORIES.includes(category)) category = "Strength";
    if (!LEVELS.includes(level)) level = "Beginner";

    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE exercises
         SET title = $1, description = $2, cues = $3, category = $4, level = $5, duration = $6
       WHERE id = $7
       RETURNING id, title, description, cues, category, level, duration, video_mime, video_size, poster_object_path, created_at`,
      [title, description, cues, category, level, duration, id]
    );
    if (rows.length === 0) {
      return Response.json({ error: "Exercise not found" }, { status: 404 });
    }
    return Response.json({ item: mapRow(rows[0]) });
  } catch (e: any) {
    console.error("exercises PATCH error:", e?.message ?? e);
    return Response.json({ error: "Failed to update exercise" }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query(
      "DELETE FROM exercises WHERE id = $1 RETURNING video_object_path, poster_object_path",
      [id]
    );
    if (rows.length === 0) {
      return Response.json({ error: "Exercise not found" }, { status: 404 });
    }
    await deleteObject(rows[0].video_object_path).catch((err) =>
      console.error("object delete failed:", err?.message ?? err)
    );
    if (rows[0].poster_object_path) {
      await deleteObject(rows[0].poster_object_path).catch((err) =>
        console.error("poster delete failed:", err?.message ?? err)
      );
    }
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("exercises DELETE error:", e?.message ?? e);
    return Response.json({ error: "Failed to delete exercise" }, { status: 500 });
  }
}
