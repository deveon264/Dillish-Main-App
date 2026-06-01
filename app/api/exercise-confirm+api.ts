import { getPool, ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { deleteObject, isExerciseVideoPath } from "@/lib/objectStorageServer";

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 11);
}

// Derives a clean, human-friendly title from an uploaded video's filename:
// strips the directory and extension, turns underscores/hyphens into spaces,
// collapses whitespace, and title-cases each word. Returns "" when there's
// nothing usable so callers can fall back to a timestamped name.
function titleFromFilename(filename: string | null): string {
  if (!filename) return "";
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const withoutExt = base.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const MAX_BYTES = 80 * 1024 * 1024; // 80MB
const CATEGORIES = ["Pilates", "Yoga", "Strength", "HIIT", "Mobility", "Cardio"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

// Records the exercise row for a video that the client has already uploaded
// straight to object storage via the signed URL from /api/exercise-upload-url.
// This is the DB-write half of the native direct-upload flow; the web proxy
// flow (POST /api/exercises) still writes its own row. Coach-only. The metadata
// arrives as a small JSON body. If the row can't be written the just-uploaded
// object is deleted so an abandoned upload never lingers.
export async function POST(request: Request): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const objectPath = String(body?.objectPath ?? "").trim();
    if (!objectPath || !isExerciseVideoPath(objectPath)) {
      return Response.json({ error: "Invalid object path" }, { status: 400 });
    }

    const description = String(body?.description ?? "").trim();
    const cues = String(body?.cues ?? "").trim();
    const duration = String(body?.duration ?? "").trim();
    let category = String(body?.category ?? "Strength").trim();
    let level = String(body?.level ?? "Beginner").trim();
    // When the upload comes from the per-exercise button inside a workout, these
    // tie the video to that exact exercise. Empty for generic library uploads.
    const workoutId = String(body?.workoutId ?? "").trim() || null;
    const workoutExerciseId = String(body?.exerciseId ?? "").trim() || null;

    // Title is optional: when the coach doesn't provide one, derive a clean
    // title from the uploaded video's filename, falling back to a timestamp.
    const title =
      String(body?.title ?? "").trim() ||
      titleFromFilename(String(body?.filename ?? "") || null) ||
      `Exercise ${Date.now()}`;

    if (!CATEGORIES.includes(category)) category = "Strength";
    if (!LEVELS.includes(level)) level = "Beginner";

    const mime = String(body?.videoMime ?? "").split(";")[0].trim() || "video/mp4";
    if (!mime.startsWith("video/")) {
      return Response.json({ error: "Uploaded file must be a video" }, { status: 400 });
    }

    const videoSize = Number(body?.videoSize ?? 0);
    if (!videoSize || !Number.isFinite(videoSize) || videoSize <= 0) {
      return Response.json({ error: "A video file is required" }, { status: 400 });
    }
    if (videoSize > MAX_BYTES) {
      // The bytes are already in storage; drop them rather than recording an
      // over-limit upload.
      await deleteObject(objectPath).catch(() => {});
      return Response.json({ error: "Video is too large (max 80MB)" }, { status: 413 });
    }

    const id = genId();
    const createdAt = Date.now();
    await ensureSchema();
    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO exercises
           (id, title, description, cues, category, level, duration, video_object_path, video_mime, video_size, workout_id, workout_exercise_id, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [id, title, description, cues, category, level, duration, objectPath, mime, videoSize, workoutId, workoutExerciseId, String(email).toLowerCase(), createdAt]
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
        videoSize,
        hasPoster: false,
        workoutId,
        workoutExerciseId,
        createdAt,
      },
    });
  } catch (e: any) {
    console.error("exercise-confirm error:", e?.message ?? e);
    return Response.json({ error: "Failed to save exercise" }, { status: 500 });
  }
}
