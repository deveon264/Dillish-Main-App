import { requireSession } from "@/lib/adminAuth";
import {
  getPrivateDir,
  getVideoSignedUrl,
  signedObjectResponse,
  uploadCommunityPhotoStream,
} from "@/lib/objectStorageServer";

const MAX_COMMUNITY_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

// The lookup key is the unguessable uuid trailing segment of the stored object
// path. Constrain it to hex + dashes so a client can never coerce the GET
// handler into signing an arbitrary object path (path traversal / SSRF of our
// own bucket).
const KEY_RE = /^[a-f0-9-]{20,64}$/i;

// Resolves a stored community-photo key to a short-lived signed object-storage
// URL and redirects the client there. Mirrors the avatar/meal-photo GET
// handlers: unauthenticated read keyed by an unguessable id, bytes served by
// storage.
export async function GET(request: Request): Promise<Response> {
  try {
    const key = new URL(request.url).searchParams.get("key");
    if (!key || !KEY_RE.test(key)) {
      return new Response("Missing key", { status: 400 });
    }
    const objectPath = `${getPrivateDir()}/community-photos/${key}`;
    const url = await getVideoSignedUrl(objectPath, 3600);
    // The object is immutable once written (each upload is a new uuid), so
    // the response is safe to cache.
    return signedObjectResponse(url, request, "private, max-age=600");
  } catch (e: any) {
    console.error("community-photo GET error:", e?.message ?? e);
    return new Response("Failed to load photo", { status: 500 });
  }
}

// Uploads a post photo for the signed-in member. The image is sent as the raw
// request body and streamed straight to object storage, with the size enforced
// from Content-Length up front and again by a streaming byte-counter. Returns
// `{ key }` the client attaches to the post it then creates.
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const mime =
      (request.headers.get("content-type") ?? "").split(";")[0].trim() || "image/jpeg";
    if (!mime.startsWith("image/")) {
      return Response.json({ error: "Photo must be an image" }, { status: 400 });
    }

    // Only trust Content-Length when the client sends a positive, finite value.
    // Some native upload clients omit it, so the streaming counter below still
    // caps the size.
    const contentLengthHeader = request.headers.get("content-length");
    const parsedLength = Number(contentLengthHeader ?? "");
    const knownLength =
      contentLengthHeader != null && Number.isFinite(parsedLength) && parsedLength > 0
        ? parsedLength
        : 0;
    if (knownLength > MAX_COMMUNITY_PHOTO_BYTES) {
      return Response.json({ error: "Photo is too large (max 8MB)" }, { status: 413 });
    }
    if (!request.body) {
      return Response.json({ error: "A photo is required" }, { status: 400 });
    }

    // Abort the stream the instant it crosses the limit instead of buffering it.
    let seen = 0;
    const limited = request.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          seen += chunk.byteLength;
          if (seen > MAX_COMMUNITY_PHOTO_BYTES) {
            controller.error(new Error("COMMUNITY_PHOTO_TOO_LARGE"));
            return;
          }
          controller.enqueue(chunk);
        },
      })
    );

    let objectPath: string;
    try {
      objectPath = await uploadCommunityPhotoStream(limited, mime, knownLength);
    } catch (e: any) {
      if (String(e?.message).includes("COMMUNITY_PHOTO_TOO_LARGE")) {
        return Response.json({ error: "Photo is too large (max 8MB)" }, { status: 413 });
      }
      throw e;
    }

    const key = objectPath.split("/").pop() ?? null;
    return Response.json({ key });
  } catch (e: any) {
    console.error("community-photo POST error:", e?.message ?? e);
    return Response.json({ error: "Failed to upload photo" }, { status: 500 });
  }
}
