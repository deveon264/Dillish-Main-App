import { thankYouVideoExists, thankYouVideoUrl } from "@/lib/thankYouVideo";

// Source for the paywall "Watch Preview" button.
//
// Paste the hosted preview clip URL below when it's ready (a plain mp4/HLS URL,
// or an endpoint that streams one). Until then this stays null and the preview
// falls back to the coach's welcome/"thank you" video WHEN one is configured, so
// the button is never a dead end. When nothing resolves the modal shows a
// graceful "coming soon" state instead of a black screen.
//
// TODO(florish): replace null with the real preview video URL.
export const PREVIEW_VIDEO_URL: string | null = null;

export type PreviewSource = { url: string } | null;

// Resolves the best available preview source at the moment the modal opens.
// Returns null when there is nothing to play (button stays visible per the
// design, but the modal degrades gracefully).
export async function resolvePreviewSource(): Promise<PreviewSource> {
  if (PREVIEW_VIDEO_URL) return { url: PREVIEW_VIDEO_URL };
  try {
    if (await thankYouVideoExists()) return { url: thankYouVideoUrl() };
  } catch {
    // offline / transient — treat as no preview available.
  }
  return null;
}
