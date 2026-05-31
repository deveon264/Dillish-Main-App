import { Platform } from "react-native";
import type { PosterAsset } from "@/lib/exercises";

// Tries to capture a representative frame from a freshly picked video so every
// upload gets a poster without the coach having to choose one. Returns null when
// generation isn't possible (the upload then just ships without a poster).
export async function generatePosterFromVideo(videoUri: string): Promise<PosterAsset | null> {
  try {
    if (Platform.OS === "web") {
      return await generateOnWeb(videoUri);
    }
    const VideoThumbnails = await import("expo-video-thumbnails");
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 1000,
      quality: 0.8,
    });
    return { uri, mimeType: "image/jpeg" };
  } catch {
    return null;
  }
}

// Draws an early frame of the video onto a canvas and exports it as a JPEG data
// URL. Picker URIs are blob:/data: same-origin, so the canvas isn't tainted.
function generateOnWeb(videoUri: string): Promise<PosterAsset | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.muted = true;
      (video as any).playsInline = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";

      let settled = false;
      const finish = (result: PosterAsset | null) => {
        if (settled) return;
        settled = true;
        video.removeAttribute("src");
        try {
          video.load();
        } catch {
          // ignore
        }
        resolve(result);
      };

      const capture = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (!ctx) return finish(null);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          finish({ uri: canvas.toDataURL("image/jpeg", 0.8), mimeType: "image/jpeg" });
        } catch {
          finish(null);
        }
      };

      video.onseeked = capture;
      video.onloadeddata = () => {
        const target = Math.min(1, (video.duration || 2) / 2);
        try {
          video.currentTime = target;
        } catch {
          capture();
        }
      };
      video.onerror = () => finish(null);

      // Safety valve so a stuck decode never hangs the upload flow.
      setTimeout(() => finish(null), 8000);

      video.src = videoUri;
    } catch {
      resolve(null);
    }
  });
}
