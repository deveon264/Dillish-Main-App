import { verifySessionToken } from "@/lib/adminAuth";
import {
  getUserById,
  setUserAvatar,
  clearUserAvatar,
  toPublicUser,
} from "@/lib/userStore";
import {
  getVideoSignedUrl,
  uploadAvatarStream,
  deleteObject,
} from "@/lib/objectStorageServer";

const MAX_AVATAR_BYTES = 8 * 1024 * 1024; // 8MB

// The object-storage operations the handlers depend on, grouped behind a small
// seam so tests can inject fakes (the real ones talk to the storage sidecar over
// the network). Production always uses `defaultStorage`.
export type AvatarStorage = {
  uploadAvatarStream: (
    body: ReadableStream<Uint8Array>,
    contentType: string,
    contentLength: number
  ) => Promise<string>;
  deleteObject: (objectPath: string) => Promise<void>;
  getVideoSignedUrl: (objectPath: string, ttlSec?: number) => Promise<string>;
};

const defaultStorage: AvatarStorage = {
  uploadAvatarStream,
  deleteObject,
  getVideoSignedUrl,
};

async function requireSession(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return null;
  return verifySessionToken(m[1]);
}

// Resolves a member id to a short-lived signed object-storage URL for their
// profile photo and redirects the client there. Returns 404 when the account
// has no stored photo so the client can fall back to initials. Mirrors the
// poster endpoint: the redirect itself is unauthenticated (the photo is keyed by
// an unguessable account id), and the bytes are served by storage.
export async function avatarGet(
  request: Request,
  storage: AvatarStorage = defaultStorage
): Promise<Response> {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const user = await getUserById(id);
    if (!user || !user.avatar_object_path) {
      return new Response("Not found", { status: 404 });
    }

    const url = await storage.getVideoSignedUrl(user.avatar_object_path, 3600);
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        // The URL carries a per-upload version token, so a longer cache is safe:
        // a new photo produces a new object path (new token) and a fresh URL.
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (e: any) {
    console.error("avatar GET error:", e?.message ?? e);
    return new Response("Failed to load photo", { status: 500 });
  }
}

// Uploads (or replaces) the signed-in member's own profile photo. The image is
// sent as the raw request body and streamed straight to object storage, with the
// size enforced from Content-Length before the body is read. Only a key/mime is
// kept on the account; the previously stored photo object is deleted.
export async function avatarPost(
  request: Request,
  storage: AvatarStorage = defaultStorage
): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const mime =
      (request.headers.get("content-type") ?? "").split(";")[0].trim() || "image/jpeg";
    if (!mime.startsWith("image/")) {
      return Response.json({ error: "Photo must be an image" }, { status: 400 });
    }

    // Only trust Content-Length when the client actually sends a positive,
    // finite value. Some native upload clients omit it, so we must not reject
    // those outright — the streaming byte-counter below still caps the size.
    const contentLengthHeader = request.headers.get("content-length");
    const parsedLength = Number(contentLengthHeader ?? "");
    const knownLength =
      contentLengthHeader != null && Number.isFinite(parsedLength) && parsedLength > 0
        ? parsedLength
        : 0;
    if (knownLength > MAX_AVATAR_BYTES) {
      return Response.json({ error: "Photo is too large (max 8MB)" }, { status: 413 });
    }
    if (!request.body) {
      return Response.json({ error: "A photo is required" }, { status: 400 });
    }

    const existing = await getUserById(session.sub);
    if (!existing) return Response.json({ error: "Account not found" }, { status: 404 });
    const previous = existing.avatar_object_path;

    // Abort the stream the instant it crosses the limit instead of buffering it.
    let seen = 0;
    const limited = request.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          seen += chunk.byteLength;
          if (seen > MAX_AVATAR_BYTES) {
            controller.error(new Error("AVATAR_TOO_LARGE"));
            return;
          }
          controller.enqueue(chunk);
        },
      })
    );

    let objectPath: string;
    try {
      objectPath = await storage.uploadAvatarStream(limited, mime, knownLength);
    } catch (e: any) {
      if (String(e?.message).includes("AVATAR_TOO_LARGE")) {
        return Response.json({ error: "Photo is too large (max 8MB)" }, { status: 413 });
      }
      throw e;
    }

    let user;
    try {
      user = await setUserAvatar(session.sub, objectPath, mime);
    } catch (dbErr) {
      await storage.deleteObject(objectPath).catch(() => {});
      throw dbErr;
    }
    if (!user) {
      await storage.deleteObject(objectPath).catch(() => {});
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    // Best-effort cleanup of the photo we just replaced.
    if (previous) await storage.deleteObject(previous).catch(() => {});

    return Response.json({ user: toPublicUser(user) });
  } catch (e: any) {
    console.error("avatar POST error:", e?.message ?? e);
    return Response.json({ error: "Failed to upload photo" }, { status: 500 });
  }
}

// Removes the signed-in member's profile photo and deletes the stored object.
export async function avatarDelete(
  request: Request,
  storage: AvatarStorage = defaultStorage
): Promise<Response> {
  try {
    const session = await requireSession(request);
    if (!session) return Response.json({ error: "Not authorized" }, { status: 401 });

    const existing = await getUserById(session.sub);
    if (!existing) return Response.json({ error: "Account not found" }, { status: 404 });
    const previous = existing.avatar_object_path;

    const user = await clearUserAvatar(session.sub);
    if (!user) return Response.json({ error: "Account not found" }, { status: 404 });

    if (previous) await storage.deleteObject(previous).catch(() => {});

    return Response.json({ user: toPublicUser(user) });
  } catch (e: any) {
    console.error("avatar DELETE error:", e?.message ?? e);
    return Response.json({ error: "Failed to remove photo" }, { status: 500 });
  }
}

// Expo Router route handlers. They delegate to the testable core functions above
// with the real storage implementation; tests call the core functions directly
// with an injected fake storage seam.
export const GET = (request: Request): Promise<Response> => avatarGet(request);
export const POST = (request: Request): Promise<Response> => avatarPost(request);
export const DELETE = (request: Request): Promise<Response> => avatarDelete(request);
