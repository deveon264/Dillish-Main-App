import { Platform } from "react-native";
import { createUploadTask, FileSystemUploadType, getInfoAsync } from "expo-file-system/legacy";
import { getApiUrl } from "@/lib/api";

// Reports upload progress as (bytesSent, bytesTotal). `total` may be 0 when the
// platform can't report an expected size, in which case callers show an
// indeterminate state.
export type UploadProgress = (sent: number, total: number) => void;

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
  workoutId?: string | null;
  workoutExerciseId?: string | null;
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

// Returns the uploaded videos tied to a specific workout, newest first, so the
// workout player can map each exercise to its own video.
export async function listWorkoutExercises(workoutId: string): Promise<UploadedExercise[]> {
  const resp = await fetch(
    `${getApiUrl()}/api/exercises?workoutId=${encodeURIComponent(workoutId)}`
  );
  if (!resp.ok) throw new Error("Could not load workout videos");
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
  token: string,
  onProgress?: UploadProgress
): Promise<{ status: number; body: string }> {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    // XMLHttpRequest is the only browser API that exposes upload progress; fall
    // back to a plain fetch when no progress consumer is interested.
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
  // Native streams the file from disk; createUploadTask surfaces byte-level
  // progress that uploadAsync alone does not.
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

// Native-only: PUTs the file at `uri` straight to a signed object-storage URL,
// bypassing the app server so the bytes make a single hop. createUploadTask
// streams from disk and surfaces byte-level progress just like the proxy path.
async function putBinaryDirect(
  uploadUrl: string,
  uri: string,
  contentType: string,
  onProgress?: UploadProgress
): Promise<number> {
  const task = createUploadTask(
    uploadUrl,
    uri,
    {
      httpMethod: "PUT",
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": contentType },
    },
    onProgress
      ? (data) => onProgress(data.totalBytesSent, data.totalBytesExpectedToSend)
      : undefined
  );
  const result = await task.uploadAsync();
  if (!result) throw new Error("Upload was cancelled");
  return result.status;
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

// Which step of the native direct-to-storage upload failed, so the UI can tell
// the coach whether the bytes ever left the device and whether a retry is safe:
//   "start"   — couldn't even request a storage slot (nothing uploaded yet)
//   "upload"  — the bytes were interrupted mid-transfer
//   "confirm" — bytes reached storage but the server never saved the row
export type UploadStage = "start" | "upload" | "confirm";

export class UploadError extends Error {
  stage: UploadStage;
  constructor(stage: UploadStage, message: string) {
    super(message);
    this.name = "UploadError";
    this.stage = stage;
  }
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
  workoutId?: string | null;
  workoutExerciseId?: string | null;
  token: string;
  onProgress?: UploadProgress;
}): Promise<UploadedExercise> {
  const {
    title,
    description,
    cues,
    category,
    level,
    duration,
    asset,
    poster,
    workoutId,
    workoutExerciseId,
    token,
    onProgress,
  } = params;
  const type = asset.mimeType || "video/mp4";

  let item: UploadedExercise;
  if (Platform.OS === "web") {
    // Web stays on the proxy path: the GCS bucket's CORS policy is Replit-managed
    // and can't be changed, so the browser can't PUT to storage directly.
    // Metadata travels in query params so the video can be sent as the raw
    // request body, letting the server stream bytes straight to storage and
    // reject oversized uploads from Content-Length before reading the body.
    // `filename` lets the server derive a clean title when none is provided.
    const qs = new URLSearchParams({
      title,
      description,
      cues,
      category,
      level,
      duration,
      filename: asset.fileName ?? "",
      workoutId: workoutId ?? "",
      exerciseId: workoutExerciseId ?? "",
    }).toString();

    const { status, body } = await postBinary(
      `${getApiUrl()}/api/exercises?${qs}`,
      asset.uri,
      type,
      token,
      onProgress
    );
    if (status < 200 || status >= 300) {
      throw new Error(errorFrom(body, "Upload failed"));
    }
    item = (JSON.parse(body) as { item: UploadedExercise }).item;
  } else {
    // Native uploads the video bytes straight to object storage (one hop instead
    // of relaying through the app server) in three steps, each with its own
    // failure mode so the UI can guide the coach.
    // 1) Request a signed storage slot. A failure here means nothing has left
    //    the device yet, so a retry is completely clean.
    let slotResp: Response;
    try {
      slotResp = await fetch(`${getApiUrl()}/api/exercise-upload-url`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      throw new UploadError(
        "start",
        "We couldn't reach storage to start the upload. Check your connection and try again."
      );
    }
    if (!slotResp.ok) {
      throw new UploadError("start", errorFrom(await slotResp.text(), "We couldn't start the upload."));
    }
    const { uploadUrl, objectPath } = (await slotResp.json()) as {
      uploadUrl: string;
      objectPath: string;
    };

    // 2) Stream the bytes straight to storage. If the network drops here the
    //    transfer is incomplete, so the coach just needs to send it again.
    let putStatus: number;
    try {
      putStatus = await putBinaryDirect(uploadUrl, asset.uri, type, onProgress);
    } catch (e: any) {
      // Cancellation is a deliberate user action, not a failure — let it pass
      // through untouched.
      if (e?.message === "Upload was cancelled") throw e;
      throw new UploadError(
        "upload",
        "The video upload was interrupted before it finished. Check your connection and try again."
      );
    }
    if (putStatus < 200 || putStatus >= 300) {
      throw new UploadError("upload", "The video upload didn't complete. Please try again.");
    }

    // The byte count drives the stored video_size and the server's size check.
    const info = await getInfoAsync(asset.uri);
    const videoSize = info.exists && typeof info.size === "number" ? info.size : 0;

    // 3) Confirm so the server writes the row. The bytes are already in storage
    //    by now; if this step fails the upload "almost" succeeded and a retry
    //    safely re-runs the whole flow (the orphaned object is reclaimed later).
    let confirmResp: Response;
    try {
      confirmResp = await fetch(`${getApiUrl()}/api/exercise-confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          objectPath,
          title,
          description,
          cues,
          category,
          level,
          duration,
          filename: asset.fileName ?? "",
          workoutId: workoutId ?? "",
          exerciseId: workoutExerciseId ?? "",
          videoMime: type,
          videoSize,
        }),
      });
    } catch {
      throw new UploadError(
        "confirm",
        "Your video uploaded, but saving its details was interrupted. Tap Retry to finish."
      );
    }
    if (!confirmResp.ok) {
      throw new UploadError(
        "confirm",
        errorFrom(await confirmResp.text(), "Your video uploaded, but we couldn't save its details.")
      );
    }
    item = (JSON.parse(await confirmResp.text()) as { item: UploadedExercise }).item;
  }

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

// Replaces the poster for an existing exercise. Reuses the same streaming
// poster endpoint the upload flow uses (raw body, keyed by id) so the server can
// stream straight to storage and swap/clean up the old poster object.
export async function updateExercisePoster(params: {
  id: string;
  poster: PosterAsset;
  token: string;
}): Promise<void> {
  const { id, poster, token } = params;
  const posterType = poster.mimeType || "image/jpeg";
  const { status, body } = await postBinary(
    `${getApiUrl()}/api/exercise-poster?id=${encodeURIComponent(id)}`,
    poster.uri,
    posterType,
    token
  );
  if (status < 200 || status >= 300) {
    throw new Error(errorFrom(body, "Could not update poster"));
  }
}

// Updates the text metadata of an existing exercise (no video/poster re-upload).
// The fields travel as a small JSON body to the PATCH handler, which saves them
// to the existing row so the changes are reflected for all members.
export async function updateExercise(params: {
  id: string;
  title: string;
  description: string;
  cues: string;
  category: string;
  level: string;
  duration: string;
  token: string;
}): Promise<UploadedExercise> {
  const { id, token, ...fields } = params;
  const resp = await fetch(`${getApiUrl()}/api/exercises?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!resp.ok) {
    throw new Error(errorFrom(await resp.text(), "Could not save changes"));
  }
  return (JSON.parse(await resp.text()) as { item: UploadedExercise }).item;
}

export async function deleteExercise(id: string, token: string): Promise<void> {
  const resp = await fetch(`${getApiUrl()}/api/exercises?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error("Could not delete exercise");
}
