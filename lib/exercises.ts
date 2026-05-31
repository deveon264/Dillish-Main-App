import { Platform } from "react-native";
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
  createdAt: number;
};

export type VideoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export function videoUrl(id: string): string {
  return `${getApiUrl()}/api/exercise-video?id=${encodeURIComponent(id)}`;
}

export async function listExercises(): Promise<UploadedExercise[]> {
  const resp = await fetch(`${getApiUrl()}/api/exercises`);
  if (!resp.ok) throw new Error("Could not load exercises");
  const data = (await resp.json()) as { items: UploadedExercise[] };
  return data.items ?? [];
}

export async function uploadExercise(params: {
  title: string;
  description: string;
  cues: string;
  category: string;
  level: string;
  duration: string;
  asset: VideoAsset;
  token: string;
}): Promise<UploadedExercise> {
  const { title, description, cues, category, level, duration, asset, token } = params;
  const name = asset.fileName || `exercise-${Date.now()}.mp4`;
  const type = asset.mimeType || "video/mp4";

  const form = new FormData();
  form.append("title", title);
  form.append("description", description);
  form.append("cues", cues);
  form.append("category", category);
  form.append("level", level);
  form.append("duration", duration);

  if (Platform.OS === "web") {
    const blob = await (await fetch(asset.uri)).blob();
    form.append("video", blob, name);
  } else {
    // React Native FormData accepts a file descriptor object.
    form.append("video", { uri: asset.uri, name, type } as any);
  }

  const resp = await fetch(`${getApiUrl()}/api/exercises`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!resp.ok) {
    let msg = "Upload failed";
    try {
      const j = await resp.json();
      if (j?.error) msg = j.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const data = (await resp.json()) as { item: UploadedExercise };
  return data.item;
}

export async function deleteExercise(id: string, token: string): Promise<void> {
  const resp = await fetch(`${getApiUrl()}/api/exercises?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error("Could not delete exercise");
}
