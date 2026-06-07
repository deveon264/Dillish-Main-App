import {
  getPrivateDir,
  getVideoSignedUrl,
  uploadMealPhotoStream,
} from "@/lib/objectStorageServer";

const MAX_MEAL_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

// The lookup key is the unguessable uuid trailing segment of the stored object
// path. Constrain it to hex + dashes so a client can never coerce the GET
// handler into signing an arbitrary object path (path traversal / SSRF of our
// own bucket).
const KEY_RE = /^[a-f0-9-]{20,64}$/i;

// The object-storage + image-fetch operations the handlers depend on, grouped
// behind a small seam so tests can inject fakes (the real ones talk to the
// storage sidecar and Pexels over the network). Production uses `defaultDeps`.
export type MealPhotoDeps = {
  uploadMealPhotoStream: (
    body: ReadableStream<Uint8Array>,
    contentType: string,
    contentLength: number
  ) => Promise<string>;
  getVideoSignedUrl: (objectPath: string, ttlSec?: number) => Promise<string>;
  fetchImage: (url: string) => Promise<Response>;
};

const defaultDeps: MealPhotoDeps = {
  uploadMealPhotoStream,
  getVideoSignedUrl,
  fetchImage: (url) => fetch(url),
};

// Only Pexels-hosted https URLs may be re-hosted. The handler fetches this URL
// server-side, so an unrestricted allow-list would be an SSRF vector — restrict
// it to the one photo provider the app actually uses.
function allowedPhotoUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (host === "pexels.com" || host.endsWith(".pexels.com")) return u;
    return null;
  } catch {
    return null;
  }
}

// Resolves a stored meal-photo key to a short-lived signed object-storage URL
// and redirects the client there. The bytes are served by storage; this stays
// durable even if the original Pexels URL is removed or rehosted. Mirrors the
// avatar/poster GET handlers (unauthenticated read keyed by an unguessable id).
export async function mealPhotoGet(
  request: Request,
  deps: MealPhotoDeps = defaultDeps
): Promise<Response> {
  try {
    const key = new URL(request.url).searchParams.get("key");
    if (!key || !KEY_RE.test(key)) {
      return new Response("Missing key", { status: 400 });
    }

    const objectPath = `${getPrivateDir()}/meal-photos/${key}`;
    const url = await deps.getVideoSignedUrl(objectPath, 3600);
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        // The object is immutable once written (a new log re-hosts to a new
        // uuid), so the redirect target is safe to cache.
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (e: any) {
    console.error("meal-photo GET error:", e?.message ?? e);
    return new Response("Failed to load photo", { status: 500 });
  }
}

// Re-hosts a chosen Pexels stock photo into Object Storage so a saved meal log
// keeps its image even if the original URL stops working. The bytes are streamed
// straight from Pexels into storage (never buffered) with the size capped by a
// streaming counter. Returns `{ key }` the client stores; on any failure returns
// `{ key: null }` so the caller can fall back to the original URL.
export async function mealPhotoPost(
  request: Request,
  deps: MealPhotoDeps = defaultDeps
): Promise<Response> {
  try {
    const body = (await request.json()) as { url?: string };
    const raw = body.url?.trim();
    if (!raw) return Response.json({ error: "Missing url" }, { status: 400 });

    const allowed = allowedPhotoUrl(raw);
    if (!allowed) {
      return Response.json({ error: "Unsupported photo source" }, { status: 400 });
    }

    const resp = await deps.fetchImage(allowed.toString());
    if (!resp.ok || !resp.body) return Response.json({ key: null });

    const mime = (resp.headers.get("content-type") ?? "").split(";")[0].trim() || "image/jpeg";
    if (!mime.startsWith("image/")) return Response.json({ key: null });

    const lengthHeader = resp.headers.get("content-length");
    const parsedLength = Number(lengthHeader ?? "");
    const knownLength =
      lengthHeader != null && Number.isFinite(parsedLength) && parsedLength > 0
        ? parsedLength
        : 0;
    if (knownLength > MAX_MEAL_PHOTO_BYTES) return Response.json({ key: null });

    // Abort the stream the instant it crosses the limit instead of buffering it.
    let seen = 0;
    const limited = resp.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          seen += chunk.byteLength;
          if (seen > MAX_MEAL_PHOTO_BYTES) {
            controller.error(new Error("MEAL_PHOTO_TOO_LARGE"));
            return;
          }
          controller.enqueue(chunk);
        },
      })
    );

    let objectPath: string;
    try {
      objectPath = await deps.uploadMealPhotoStream(limited, mime, knownLength);
    } catch (e: any) {
      if (String(e?.message).includes("MEAL_PHOTO_TOO_LARGE")) {
        return Response.json({ key: null });
      }
      throw e;
    }

    const key = objectPath.split("/").pop() ?? null;
    return Response.json({ key });
  } catch (e: any) {
    console.error("meal-photo POST error:", e?.message ?? e);
    return Response.json({ key: null });
  }
}

// Expo Router route handlers. They delegate to the testable core functions above
// with the real dependencies; tests call the core functions directly with
// injected fakes.
export const GET = (request: Request): Promise<Response> => mealPhotoGet(request);
export const POST = (request: Request): Promise<Response> => mealPhotoPost(request);
