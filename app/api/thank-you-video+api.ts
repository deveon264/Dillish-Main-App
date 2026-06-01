import { getSetting, setSetting } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import {
  uploadThankYouVideoStream,
  getVideoSignedUrl,
  deleteObject,
} from "@/lib/objectStorageServer";

// One global "thank you" video the coach uploads to play once between the
// onboarding paywall and the dashboard. It is intentionally kept separate from
// the per-exercise/workout videos: the bytes live in object storage and only a
// path/mime pair is recorded in app_settings (no schema change needed).
const PATH_KEY = "thank_you_video_path";
const MIME_KEY = "thank_you_video_mime";

const MAX_BYTES = 80 * 1024 * 1024; // 80MB

// GET serves the video. With `?check=1` it returns small JSON describing
// whether a video has been set (used by the upload screen and the playback
// screen to decide whether to play or skip straight to the dashboard).
// Otherwise it resolves the stored object to a short-lived signed GCS URL and
// 302-redirects there, mirroring the exercise-video endpoint so the player gets
// native HTTP Range support.
export async function GET(request: Request): Promise<Response> {
  try {
    const check = new URL(request.url).searchParams.get("check");
    const path = await getSetting(PATH_KEY);

    if (check) {
      return Response.json({ exists: !!path });
    }

    if (!path) return new Response("Not found", { status: 404 });

    const url = await getVideoSignedUrl(path, 3600);
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("thank-you-video GET error:", e?.message ?? e);
    return new Response("Failed to stream video", { status: 500 });
  }
}

// Uploads (or replaces) the single global thank-you video. The bytes arrive as
// the raw request body so the server can stream them straight to storage and
// enforce the size limit from Content-Length before reading the body. Any
// previously stored object is deleted after the new one is saved.
export async function POST(request: Request): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim() || "video/mp4";
    if (!mime.startsWith("video/")) {
      return Response.json({ error: "Uploaded file must be a video" }, { status: 400 });
    }

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

    // Abort the upload the instant the body crosses the limit instead of
    // buffering it, in case the declared length understated the real size.
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

    let objectPath: string;
    try {
      objectPath = await uploadThankYouVideoStream(limited, mime, contentLength);
    } catch (e: any) {
      if (String(e?.message).includes("VIDEO_TOO_LARGE")) {
        return Response.json({ error: "Video is too large (max 80MB)" }, { status: 413 });
      }
      throw e;
    }

    const previous = await getSetting(PATH_KEY);
    await setSetting(PATH_KEY, objectPath);
    await setSetting(MIME_KEY, mime);

    // Clean up the replaced object so old uploads don't linger in storage. A
    // failure here must not fail the (already saved) replacement.
    if (previous && previous !== objectPath) {
      await deleteObject(previous).catch((err) =>
        console.error("thank-you-video old object delete failed:", err?.message ?? err)
      );
    }

    return Response.json({ ok: true, videoMime: mime, videoSize: contentLength });
  } catch (e: any) {
    console.error("thank-you-video POST error:", e?.message ?? e);
    return Response.json({ error: "Failed to upload video" }, { status: 500 });
  }
}

// Removes the thank-you video so onboarding skips straight to the dashboard.
export async function DELETE(request: Request): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }
    const path = await getSetting(PATH_KEY);
    if (path) {
      await deleteObject(path).catch((err) =>
        console.error("thank-you-video object delete failed:", err?.message ?? err)
      );
    }
    await setSetting(PATH_KEY, "");
    await setSetting(MIME_KEY, "");
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("thank-you-video DELETE error:", e?.message ?? e);
    return Response.json({ error: "Failed to delete video" }, { status: 500 });
  }
}
