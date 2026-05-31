import { getPool } from "@/lib/db";
import { isAdminEmail } from "@/constants/admin";

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 11);
}

const MAX_BYTES = 80 * 1024 * 1024; // 80MB
const CATEGORIES = ["Pilates", "Yoga", "Strength", "HIIT", "Mobility", "Cardio"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

export async function GET(): Promise<Response> {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, title, description, category, level, video_mime, video_size, created_by, created_at
       FROM exercise_uploads ORDER BY created_at DESC`
    );
    const items = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      level: r.level,
      videoMime: r.video_mime,
      videoSize: r.video_size,
      createdAt: new Date(r.created_at).getTime(),
    }));
    return Response.json({ items });
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

    const form: any = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
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

    const id = genId();
    const pool = getPool();
    await pool.query(
      `INSERT INTO exercise_uploads (id, title, description, category, level, video_mime, video_size, video_data, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, title, description, category, level, mime, buf.length, buf, String(email).toLowerCase()]
    );

    return Response.json({
      item: {
        id,
        title,
        description,
        category,
        level,
        videoMime: mime,
        videoSize: buf.length,
        createdAt: Date.now(),
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
    const pool = getPool();
    await pool.query("DELETE FROM exercise_uploads WHERE id = $1", [id]);
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("exercises DELETE error:", e?.message ?? e);
    return Response.json({ error: "Failed to delete exercise" }, { status: 500 });
  }
}
