import { getPool, ensureSchema } from "@/lib/db";
import { isAdminEmail } from "@/constants/admin";
import { uploadExerciseVideo, deleteObject } from "@/lib/objectStorageServer";

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
    createdAt: Number(r.created_at),
  };
}

export async function GET(): Promise<Response> {
  try {
    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, title, description, cues, category, level, duration, video_mime, video_size, created_by, created_at
       FROM exercises ORDER BY created_at DESC`
    );
    return Response.json({ items: rows.map(mapRow) });
  } catch (e: any) {
    console.error("exercises GET error:", e?.message ?? e);
    return Response.json({ error: "Failed to load exercises" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const email = request.headers.get("x-user-email");
    if (!isAdminEmail(email)) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    // Reject oversized uploads up front when the client declares the size.
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared && declared > MAX_BYTES + 1024 * 1024) {
      return Response.json({ error: "Video is too large (max 80MB)" }, { status: 413 });
    }

    const form: any = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const cues = String(form.get("cues") ?? "").trim();
    const duration = String(form.get("duration") ?? "").trim();
    let category = String(form.get("category") ?? "Strength").trim();
    let level = String(form.get("level") ?? "Beginner").trim();
    const file = form.get("video");

    if (!title) return Response.json({ error: "Title is required" }, { status: 400 });
    if (!(file instanceof Blob)) return Response.json({ error: "A video file is required" }, { status: 400 });
    if (!CATEGORIES.includes(category)) category = "Strength";
    if (!LEVELS.includes(level)) level = "Beginner";

    const mime = (file as any).type || "video/mp4";
    if (!mime.startsWith("video/")) {
      return Response.json({ error: "Uploaded file must be a video" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) return Response.json({ error: "The video file is empty" }, { status: 400 });
    if (buf.length > MAX_BYTES) {
      return Response.json({ error: "Video is too large (max 80MB)" }, { status: 413 });
    }

    // Store the bytes in object storage; keep only a reference in Postgres.
    const objectPath = await uploadExerciseVideo(buf, mime);

    const id = genId();
    const createdAt = Date.now();
    await ensureSchema();
    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO exercises
           (id, title, description, cues, category, level, duration, video_object_path, video_mime, video_size, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, title, description, cues, category, level, duration, objectPath, mime, buf.length, String(email).toLowerCase(), createdAt]
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
        videoSize: buf.length,
        createdAt,
      },
    });
  } catch (e: any) {
    console.error("exercises POST error:", e?.message ?? e);
    return Response.json({ error: "Failed to upload exercise" }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const email = request.headers.get("x-user-email");
    if (!isAdminEmail(email)) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    await ensureSchema();
    const pool = getPool();
    const { rows } = await pool.query(
      "DELETE FROM exercises WHERE id = $1 RETURNING video_object_path",
      [id]
    );
    if (rows.length === 0) {
      return Response.json({ error: "Exercise not found" }, { status: 404 });
    }
    await deleteObject(rows[0].video_object_path).catch((err) =>
      console.error("object delete failed:", err?.message ?? err)
    );
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("exercises DELETE error:", e?.message ?? e);
    return Response.json({ error: "Failed to delete exercise" }, { status: 500 });
  }
}
