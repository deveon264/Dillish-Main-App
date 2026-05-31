import { getPool } from "@/lib/db";

export async function GET(request: Request): Promise<Response> {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const pool = getPool();
    const meta = await pool.query(
      "SELECT video_mime, video_size FROM exercise_uploads WHERE id = $1",
      [id]
    );
    if (meta.rowCount === 0) return new Response("Not found", { status: 404 });

    const mime: string = meta.rows[0].video_mime || "video/mp4";
    const total: number = meta.rows[0].video_size;
    const range = request.headers.get("range");

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      const unsatisfiable = () =>
        new Response("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${total}`, "Accept-Ranges": "bytes" },
        });

      // Reject multi-range and malformed range headers.
      if (!m || range.includes(",")) return unsatisfiable();

      const hasStart = m[1] !== "";
      const hasEnd = m[2] !== "";
      let start: number;
      let end: number;

      if (!hasStart) {
        // Suffix range: bytes=-N → last N bytes.
        if (!hasEnd) return unsatisfiable();
        const suffix = parseInt(m[2], 10);
        if (isNaN(suffix) || suffix <= 0) return unsatisfiable();
        start = Math.max(0, total - suffix);
        end = total - 1;
      } else {
        start = parseInt(m[1], 10);
        end = hasEnd ? parseInt(m[2], 10) : total - 1;
        if (isNaN(start) || isNaN(end)) return unsatisfiable();
        if (end >= total) end = total - 1;
        if (start > end || start >= total) return unsatisfiable();
      }
      const length = end - start + 1;

      // Postgres substring is 1-indexed.
      const chunk = await pool.query(
        "SELECT substring(video_data FROM $1 FOR $2) AS chunk FROM exercise_uploads WHERE id = $3",
        [start + 1, length, id]
      );
      const buf: Buffer = chunk.rows[0].chunk;
      return new Response(buf as any, {
        status: 206,
        headers: {
          "Content-Type": mime,
          "Content-Length": String(buf.length),
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const whole = await pool.query(
      "SELECT video_data AS chunk FROM exercise_uploads WHERE id = $1",
      [id]
    );
    const buf: Buffer = whole.rows[0].chunk;
    return new Response(buf as any, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e: any) {
    console.error("exercise-video error:", e?.message ?? e);
    return new Response("Failed to stream video", { status: 500 });
  }
}
