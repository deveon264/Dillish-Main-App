import { Platform } from "react-native";
import { createUploadTask, FileSystemUploadType } from "expo-file-system/legacy";
import { getApiUrl } from "@/lib/api";

// Minimal shape needed to resolve a renderable photo URL. Matches the User type
// the AuthContext exposes without creating a circular import.
type AvatarSource = {
  id: string;
  avatar?: string | null;
  avatarVersion?: string | null;
};

// The public user returned by the avatar endpoints (and login/signup/me).
export type AvatarUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  avatarVersion?: string | null;
  isAdmin: boolean;
  onboardingComplete: boolean;
};

// Resolves the URI a member's profile photo should render from:
// - object-storage photos go through the avatar endpoint (keyed by id, with a
//   per-upload version token so a replaced photo isn't served from cache);
// - legacy data-URI photos (older accounts) render directly;
// - no photo returns null so the UI shows initials.
export function avatarUri(user: AvatarSource | null | undefined): string | null {
  if (!user) return null;
  if (user.avatarVersion) {
    return `${getApiUrl()}/api/avatar?id=${encodeURIComponent(user.id)}&v=${encodeURIComponent(
      user.avatarVersion
    )}`;
  }
  if (user.avatar) return user.avatar;
  return null;
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

// Uploads the image at `uri` as the raw request body so the server can stream it
// straight to object storage. On native the file streams from disk (never
// through JS memory); on web the blob/object URL is fetched and sent directly.
// Returns the updated public user (with the new avatarVersion).
export async function uploadAvatar(
  uri: string,
  mimeType: string | null | undefined,
  token: string
): Promise<AvatarUser> {
  const endpoint = `${getApiUrl()}/api/avatar`;
  const contentType = mimeType || "image/jpeg";

  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
      body: blob,
    });
    const body = await resp.text();
    if (!resp.ok) throw new Error(errorFrom(body, "Couldn't add the photo."));
    return (JSON.parse(body) as { user: AvatarUser }).user;
  }

  const task = createUploadTask(endpoint, uri, {
    httpMethod: "POST",
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
  });
  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(errorFrom(result?.body ?? "", "Couldn't add the photo."));
  }
  return (JSON.parse(result.body) as { user: AvatarUser }).user;
}

// Removes the member's profile photo and the stored object. Returns the updated
// public user (with no photo).
export async function removeAvatar(token: string): Promise<AvatarUser> {
  const resp = await fetch(`${getApiUrl()}/api/avatar`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await resp.text();
  if (!resp.ok) throw new Error(errorFrom(body, "Couldn't remove the photo."));
  return (JSON.parse(body) as { user: AvatarUser }).user;
}
