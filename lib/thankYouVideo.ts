import { Platform } from "react-native";
import { createUploadTask, FileSystemUploadType } from "expo-file-system/legacy";
import { getApiUrl } from "@/lib/api";

// Reports upload progress as (bytesSent, bytesTotal). `total` may be 0 when the
// platform can't report an expected size, in which case callers show an
// indeterminate state.
export type UploadProgress = (sent: number, total: number) => void;

// The single global thank-you video lives behind one endpoint (no id): GET
// streams it (302 → signed GCS URL), POST replaces it, DELETE clears it.
export function thankYouVideoUrl(): string {
  return `${getApiUrl()}/api/thank-you-video`;
}

function errorFrom(body: string, fallback: string): string {
  try {
    const j = JSON.parse(body);
    if (j?.error) return j.error as string;
  } catch {
    // ignore
  }
  return fallback;
}

// Sends the bytes at `uri` as a raw request body so the server can stream them
// straight to storage. On native the file streams from disk; on web the
// blob/object URL is fetched and sent directly. Mirrors lib/exercises.ts.
async function postBinary(
  endpoint: string,
  uri: string,
  contentType: string,
  token: string,
  onProgress?: UploadProgress
): Promise<{ status: number; body: string }> {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    if (onProgress) {
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", endpoint);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded, e.total);
        };
        xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(blob);
      });
    }
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
      body: blob,
    });
    return { status: resp.status, body: await resp.text() };
  }
  const task = createUploadTask(
    endpoint,
    uri,
    {
      httpMethod: "POST",
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    },
    onProgress
      ? (data) => onProgress(data.totalBytesSent, data.totalBytesExpectedToSend)
      : undefined
  );
  const result = await task.uploadAsync();
  if (!result) throw new Error("Upload was cancelled");
  return { status: result.status, body: result.body };
}

// Uploads (or replaces) the global thank-you video.
export async function uploadThankYouVideo(params: {
  uri: string;
  mimeType?: string | null;
  token: string;
  onProgress?: UploadProgress;
}): Promise<void> {
  const type = params.mimeType || "video/mp4";
  const { status, body } = await postBinary(
    thankYouVideoUrl(),
    params.uri,
    type,
    params.token,
    params.onProgress
  );
  if (status < 200 || status >= 300) {
    throw new Error(errorFrom(body, "Upload failed"));
  }
}

export async function deleteThankYouVideo(token: string): Promise<void> {
  const resp = await fetch(thankYouVideoUrl(), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(errorFrom(await resp.text(), "Could not remove video"));
}

// Returns whether a thank-you video is currently set. Uses the lightweight
// `?check=1` JSON response so it works on both web and native without following
// the cross-origin 302 redirect to storage.
export async function thankYouVideoExists(): Promise<boolean> {
  try {
    const resp = await fetch(`${thankYouVideoUrl()}?check=1`);
    if (!resp.ok) return false;
    const data = (await resp.json()) as { exists?: boolean };
    return !!data.exists;
  } catch {
    return false;
  }
}
