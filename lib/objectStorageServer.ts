const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function uuid(): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getPrivateDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR is not set");
  return dir.endsWith("/") ? dir.slice(0, -1) : dir;
}

function parseObjectPath(fullPath: string): { bucketName: string; objectName: string } {
  const path = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  const parts = path.split("/");
  if (parts.length < 3) throw new Error("Invalid object path");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

// Asks the Replit object-storage sidecar to sign a URL for the given operation.
async function signObjectURL(
  objectPath: string,
  method: "GET" | "PUT" | "DELETE" | "HEAD",
  ttlSec: number
): Promise<string> {
  const { bucketName, objectName } = parseObjectPath(objectPath);
  const res = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to sign object URL (${res.status})`);
  }
  const { signed_url } = (await res.json()) as { signed_url: string };
  return signed_url;
}

// Streams a request body straight to a fresh object via a signed PUT URL — the
// bytes are never buffered in the server's memory. `contentLength` (the exact
// byte count) is forwarded so the storage backend receives a regular,
// non-chunked upload. Returns the full object path stored in the database. If
// the upload fails (including when a size-limiting stream aborts early), any
// partial object is cleaned up.
async function putObjectStream(
  fullPath: string,
  body: ReadableStream<Uint8Array>,
  contentType: string,
  contentLength: number,
  fallbackType: string
): Promise<string> {
  const putUrl = await signObjectURL(fullPath, "PUT", 900);
  try {
    const res = await fetch(putUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType || fallbackType,
        "Content-Length": String(contentLength),
      },
      body: body as any,
      // Required by undici when streaming a request body.
      duplex: "half",
    } as any);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Object upload failed (${res.status}) ${detail.slice(0, 200)}`);
    }
    return fullPath;
  } catch (err) {
    await deleteObject(fullPath).catch(() => {});
    throw err;
  }
}

// Streams an exercise video to the private exercise-videos folder.
export async function uploadExerciseVideoStream(
  body: ReadableStream<Uint8Array>,
  contentType: string,
  contentLength: number
): Promise<string> {
  return putObjectStream(
    `${getPrivateDir()}/exercise-videos/${uuid()}`,
    body,
    contentType,
    contentLength,
    "video/mp4"
  );
}

// Streams a poster image to the private exercise-posters folder.
export async function uploadExercisePosterStream(
  body: ReadableStream<Uint8Array>,
  contentType: string,
  contentLength: number
): Promise<string> {
  return putObjectStream(
    `${getPrivateDir()}/exercise-posters/${uuid()}`,
    body,
    contentType,
    contentLength,
    "image/jpeg"
  );
}

// Returns a short-lived signed GET URL clients can stream from (GCS supports Range).
export async function getVideoSignedUrl(objectPath: string, ttlSec = 3600): Promise<string> {
  return signObjectURL(objectPath, "GET", ttlSec);
}

export async function deleteObject(objectPath: string): Promise<void> {
  const delUrl = await signObjectURL(objectPath, "DELETE", 300);
  const res = await fetch(delUrl, { method: "DELETE" });
  // 404 is fine — object already gone.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Object delete failed (${res.status})`);
  }
}
