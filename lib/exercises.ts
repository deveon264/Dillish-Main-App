import { Platform } from "react-native";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import { getApiUrl } from "@/lib/api";

export type UploadedExercise = {
  id: string;
  title: string;
  description: string;
  cues: string;
  category: string;
  level: string;
  duration: string;
  videoMime: string;
  videoSize: number;
  hasPoster: boolean;
  createdAt: number;
};

export type VideoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type PosterAsset = {
  uri: string;
  mimeType?: string | null;
};

export function videoUrl(id: string): string {
  return `${getApiUrl()}/api/exercise-video?id=${encodeURIComponent(id)}`;
}

export function posterUrl(id: string): string {
  return `${getApiUrl()}/api/exercise-poster?id=${encodeURIComponent(id)}`;
}

export async function listExercises(): Promise<UploadedExercise[]> {
  const resp = await fetch(`${getApiUrl()}/api/exercises`);
  if (!resp.ok) throw new Error("Could not load exercises");
  const data = (await resp.json()) as { items: UploadedExercise[] };
  return data.items ?? [];
}

// Sends the bytes at `uri` as a raw request body so the server can stream them
// straight to storage. On native the file streams from disk (never through JS
// memory); on web the blob/object URL is fetched and sent directly.
async function postBinary(
  endpoint: string,
  uri: string,
  contentType: string,
  token: string
): Promise<{ status: number; body: string }> {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
      body: blob,
    });
    return { status: resp.status, body: await resp.text() };
  }
  const result = await uploadAsync(endpoint, uri, {
    httpMethod: "POST",
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
  });
  return { status: result.status, body: result.body };
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

export async function uploadExercise(params: {
  title: string;
  description: string;
  cues: string;
  category: string;
  level: string;
  duration: string;
  asset: VideoAsset;
  poster?: PosterAsset | null;
  token: string;
}): Promise<UploadedExercise> {
  const { title, description, cues, category, level, duration, asset, poster, token } = params;
  const type = asset.mimeType || "video/mp4";

  // Metadata travels in query params so the video can be sent as the raw request
  // body. This lets the server stream the bytes straight to storage and reject
  // oversized uploads from the Content-Length header before reading the body.
  const qs = new URLSearchParams({
    title,
    description,
    cues,
    category,
    level,
    duration,
  }).toString();

  const { status, body } = await postBinary(
    `${getApiUrl()}/api/exercises?${qs}`,
    asset.uri,
    type,
    token
  );
  if (status < 200 || status >= 300) {
    throw new Error(errorFrom(body, "Upload failed"));
  }
  let item = (JSON.parse(body) as { item: UploadedExercise }).item;

  // The poster is optional and uploaded as a second request keyed by the new
  // exercise id. A poster failure must never fail the (already saved) video.
  if (poster?.uri) {
    try {
      const posterType = poster.mimeType || "image/jpeg";
      const pr = await postBinary(
        `${getApiUrl()}/api/exercise-poster?id=${encodeURIComponent(item.id)}`,
        poster.uri,
        posterType,
        token
      );
      if (pr.status >= 200 && pr.status < 300) {
        item = { ...item, hasPoster: true };
      }
    } catch {
      // poster optional; ignore
    }
  }

  return item;
}

export async function deleteExercise(id: string, token: string): Promise<void> {
  const resp = await fetch(`${getApiUrl()}/api/exercises?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error("Could not delete exercise");
}
