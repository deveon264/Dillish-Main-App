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

// Uploads bytes to a fresh object under the private exercise-videos folder via a
// signed PUT URL. Returns the full object path stored in the database.
export async function uploadExerciseVideo(buffer: Buffer, contentType: string): Promise<string> {
  const fullPath = `${getPrivateDir()}/exercise-videos/${uuid()}`;
  const putUrl = await signObjectURL(fullPath, "PUT", 900);
  const res = await fetch(putUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType || "video/mp4" },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Object upload failed (${res.status}) ${detail.slice(0, 200)}`);
  }
  return fullPath;
}

// Uploads a poster image under the private exercise-posters folder via a signed
// PUT URL. Returns the full object path stored in the database.
export async function uploadExercisePoster(buffer: Buffer, contentType: string): Promise<string> {
  const fullPath = `${getPrivateDir()}/exercise-posters/${uuid()}`;
  const putUrl = await signObjectURL(fullPath, "PUT", 900);
  const res = await fetch(putUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType || "image/jpeg" },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Poster upload failed (${res.status}) ${detail.slice(0, 200)}`);
  }
  return fullPath;
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
