import { Platform } from "react-native";
import {
  createUploadTask,
  FileSystemUploadType,
  getInfoAsync,
} from "expo-file-system/legacy";
import { getApiUrl } from "@/lib/api";
import { avatarUri } from "@/lib/avatar";

// Client-side typed access to the shared community feed API. The server is the
// source of truth; these helpers just shape requests/responses. Types mirror
// the public shapes the routes return (kept in sync with lib/communityStore.ts,
// which is server-only and must never be imported from client code).

export type PostType = "progress" | "meal" | "tip" | "motivation";

export const POST_TYPES: PostType[] = ["progress", "meal", "tip", "motivation"];

export type CommunityAuthor = {
  id: string;
  name: string;
  avatar: string | null;
  avatarVersion: string | null;
};

export type CommunityPost = {
  id: string;
  type: PostType;
  body: string;
  photoKey: string | null;
  createdAt: number;
  author: CommunityAuthor;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export type CommunityComment = {
  id: string;
  postId: string;
  body: string;
  createdAt: number;
  author: CommunityAuthor;
};

export type FeedCursor = { createdAt: number; id: string };

type FeedResponse = { posts: CommunityPost[]; nextCursor: FeedCursor | null };

// Resolves the renderable URL for a post photo. The endpoint 302-redirects to a
// short-lived signed storage URL; an <Image> follows the redirect transparently
// on web and native. Unauthenticated (keyed by an unguessable id).
export function communityPhotoUri(key: string): string {
  return `${getApiUrl()}/api/community-photo?key=${encodeURIComponent(key)}`;
}

// The author's profile photo URL (reuses the avatar endpoint), or null when the
// member has no photo so the UI can fall back to initials.
export function authorAvatarUri(author: CommunityAuthor): string | null {
  return avatarUri(author);
}

// Compact relative time for feed/detail timestamps. Avoids em dashes per the
// project's copy rules.
export function timeAgo(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function errorFrom(data: any, fallback: string): string {
  if (data && typeof data.error === "string" && data.error.trim()) return data.error.trim();
  return fallback;
}

// Shared authed JSON request. Throws an Error carrying the server's message on a
// non-2xx response so callers can surface it directly.
async function authed<T>(
  path: string,
  opts: { token: string; method?: string; body?: unknown; fallback?: string }
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${opts.token}` };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let resp: Response;
  try {
    resp = await fetch(`${getApiUrl()}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON body
  }
  if (!resp.ok) throw new Error(errorFrom(data, opts.fallback ?? "Something went wrong. Please try again."));
  return data as T;
}

export async function fetchFeed(opts: {
  token: string;
  type?: PostType | null;
  cursor?: FeedCursor | null;
}): Promise<FeedResponse> {
  const params = new URLSearchParams();
  if (opts.type) params.set("type", opts.type);
  if (opts.cursor) {
    params.set("beforeCreatedAt", String(opts.cursor.createdAt));
    params.set("beforeId", opts.cursor.id);
  }
  const qs = params.toString();
  return authed<FeedResponse>(`/api/community-posts${qs ? `?${qs}` : ""}`, {
    token: opts.token,
    fallback: "Could not load the feed",
  });
}

export async function fetchPost(opts: { token: string; id: string }): Promise<CommunityPost> {
  const { post } = await authed<{ post: CommunityPost }>(
    `/api/community-posts?id=${encodeURIComponent(opts.id)}`,
    { token: opts.token, fallback: "Could not load this post" }
  );
  return post;
}

export async function createPost(opts: {
  token: string;
  type: PostType;
  text: string;
  photoKey?: string | null;
}): Promise<CommunityPost> {
  const { post } = await authed<{ post: CommunityPost }>(`/api/community-posts`, {
    token: opts.token,
    method: "POST",
    body: { type: opts.type, text: opts.text, ...(opts.photoKey ? { photoKey: opts.photoKey } : {}) },
    fallback: "Could not share your post",
  });
  return post;
}

// Edits an existing post. Omit photoKey/removePhoto to keep the current photo;
// pass a freshly uploaded photoKey to replace it, or removePhoto:true to clear.
export async function updatePost(opts: {
  token: string;
  id: string;
  type: PostType;
  text: string;
  photoKey?: string | null;
  removePhoto?: boolean;
}): Promise<CommunityPost> {
  const { post } = await authed<{ post: CommunityPost }>(
    `/api/community-posts?id=${encodeURIComponent(opts.id)}`,
    {
      token: opts.token,
      method: "PATCH",
      body: {
        type: opts.type,
        text: opts.text,
        ...(opts.photoKey ? { photoKey: opts.photoKey } : {}),
        ...(opts.removePhoto ? { removePhoto: true } : {}),
      },
      fallback: "Could not update your post",
    }
  );
  return post;
}

export async function deletePost(opts: { token: string; id: string }): Promise<void> {
  await authed(`/api/community-posts?id=${encodeURIComponent(opts.id)}`, {
    token: opts.token,
    method: "DELETE",
    fallback: "Could not delete post",
  });
}

export async function fetchComments(opts: {
  token: string;
  postId: string;
}): Promise<CommunityComment[]> {
  const { comments } = await authed<{ comments: CommunityComment[] }>(
    `/api/community-comments?postId=${encodeURIComponent(opts.postId)}`,
    { token: opts.token, fallback: "Could not load comments" }
  );
  return comments;
}

export async function addComment(opts: {
  token: string;
  postId: string;
  text: string;
}): Promise<CommunityComment> {
  const { comment } = await authed<{ comment: CommunityComment }>(`/api/community-comments`, {
    token: opts.token,
    method: "POST",
    body: { postId: opts.postId, text: opts.text },
    fallback: "Could not add comment",
  });
  return comment;
}

export async function toggleLike(opts: {
  token: string;
  postId: string;
}): Promise<{ liked: boolean; likeCount: number }> {
  return authed<{ liked: boolean; likeCount: number }>(`/api/community-like`, {
    token: opts.token,
    method: "POST",
    body: { postId: opts.postId },
    fallback: "Could not update like",
  });
}

export async function reportPost(opts: {
  token: string;
  postId: string;
  reason?: string;
}): Promise<void> {
  await authed(`/api/community-report`, {
    token: opts.token,
    method: "POST",
    body: { postId: opts.postId, reason: opts.reason ?? "" },
    fallback: "Could not submit report",
  });
}

export type CommunityReport = {
  id: string;
  reason: string;
  createdAt: number;
  reporter: CommunityAuthor;
  post: CommunityPost;
};

// Admin-only: the moderation queue of reported posts, newest first.
export async function fetchReports(opts: { token: string }): Promise<CommunityReport[]> {
  const { reports } = await authed<{ reports: CommunityReport[] }>(`/api/community-reports`, {
    token: opts.token,
    fallback: "Could not load reports",
  });
  return reports;
}

// Admin-only: dismiss a report without touching the post.
export async function dismissReport(opts: { token: string; id: string }): Promise<void> {
  await authed(`/api/community-reports?id=${encodeURIComponent(opts.id)}`, {
    token: opts.token,
    method: "DELETE",
    fallback: "Could not dismiss report",
  });
}

export async function blockMember(opts: { token: string; blockedId: string }): Promise<void> {
  await authed(`/api/community-block`, {
    token: opts.token,
    method: "POST",
    body: { blockedId: opts.blockedId },
    fallback: "Could not block member",
  });
}

export async function unblockMember(opts: { token: string; blockedId: string }): Promise<void> {
  await authed(`/api/community-block?blockedId=${encodeURIComponent(opts.blockedId)}`, {
    token: opts.token,
    method: "DELETE",
    fallback: "Could not unblock member",
  });
}

// Uploads a post photo as the raw request body (mirrors lib/avatar.ts): on web
// the picked blob is sent directly; on native the file streams off disk with an
// explicit Content-Length. Returns the storage key to attach to a new post.
export async function uploadCommunityPhoto(
  uri: string,
  mimeType: string | null | undefined,
  token: string
): Promise<string> {
  const endpoint = `${getApiUrl()}/api/community-photo`;
  const contentType = mimeType || "image/jpeg";

  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
      body: blob,
    });
    const text = await resp.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // ignore
    }
    if (!resp.ok || !data?.key) throw new Error(errorFrom(data, "Couldn't add the photo."));
    return data.key as string;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": contentType,
  };
  try {
    const info = await getInfoAsync(uri);
    if (info.exists && typeof info.size === "number" && info.size > 0) {
      headers["Content-Length"] = String(info.size);
    }
  } catch {
    // fall back to whatever the upload task sends
  }

  const task = createUploadTask(endpoint, uri, {
    httpMethod: "POST",
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers,
  });
  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    let data: any = null;
    try {
      data = JSON.parse(result?.body ?? "");
    } catch {
      // ignore
    }
    throw new Error(errorFrom(data, "Couldn't add the photo."));
  }
  const data = JSON.parse(result.body) as { key?: string };
  if (!data.key) throw new Error("Couldn't add the photo.");
  return data.key;
}
