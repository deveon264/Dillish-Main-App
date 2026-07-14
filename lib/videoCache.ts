// Phone-side cache for exercise clips. The first watch streams the remote URL
// (starts as fast as the connection allows) while a background download saves
// the clip to the app's cache directory; every later watch plays the local
// file instantly. The cache key includes the clip's byte size, so a replaced
// video (same row id, new file) re-downloads and the stale variant is evicted.
//
// File-system access is injected so this logic stays react-native-free and
// unit-testable (repo style); the workout screen supplies an expo-file-system
// implementation, and web callers simply never invoke it (browser caching).

export type VideoCacheFs = {
  // Directory URI the cache lives under, WITH a trailing slash
  // (e.g. FileSystem.cacheDirectory). Null/undefined disables caching.
  cacheDir: string | null | undefined;
  exists: (uri: string) => Promise<boolean>;
  makeDir: (uri: string) => Promise<void>;
  download: (url: string, toUri: string) => Promise<void>;
  move: (fromUri: string, toUri: string) => Promise<void>;
  remove: (uri: string) => Promise<void>;
  list: (dirUri: string) => Promise<string[]>;
};

const CLIP_DIR = "exercise-videos";

// Keep ids filesystem-safe; DB ids are uuid-ish but never trust them blindly.
function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function clipFileName(videoId: string, size: number): string {
  const sizeToken = Number.isFinite(size) && size > 0 ? Math.floor(size) : 0;
  return `${sanitize(videoId)}-${sizeToken}.mp4`;
}

// One in-flight download per target file, so a set replay or re-render can't
// start a second full download of the same clip.
const inFlight = new Map<string, Promise<void>>();

async function downloadInBackground(
  fs: VideoCacheFs,
  dirUri: string,
  fileName: string,
  remoteUrl: string,
  videoId: string
): Promise<void> {
  const finalUri = dirUri + fileName;
  const tmpUri = finalUri + ".tmp";
  try {
    await fs.makeDir(dirUri);
    // Download to a temp name and move into place only on success, so a
    // partial file can never be picked up as a playable clip.
    await fs.download(remoteUrl, tmpUri);
    await fs.move(tmpUri, finalUri);
    // Evict older variants of the same clip (the video was replaced).
    const prefix = `${sanitize(videoId)}-`;
    for (const name of await fs.list(dirUri)) {
      if (name.startsWith(prefix) && name.endsWith(".mp4") && name !== fileName) {
        await fs.remove(dirUri + name).catch(() => {});
      }
    }
  } catch {
    // Best effort: clean the temp file and stream remotely again next time.
    await fs.remove(tmpUri).catch(() => {});
  }
}

// Resolves what the player should load for a clip: the cached local file when
// present, otherwise the remote URL right away (streaming starts immediately)
// while the download fills the cache for next time.
export async function resolveClipSource(
  fs: VideoCacheFs,
  videoId: string,
  size: number | undefined,
  remoteUrl: string
): Promise<string> {
  if (!fs.cacheDir) return remoteUrl;
  const dirUri = fs.cacheDir + CLIP_DIR + "/";
  const fileName = clipFileName(videoId, size ?? 0);
  const finalUri = dirUri + fileName;

  try {
    if (await fs.exists(finalUri)) return finalUri;
  } catch {
    return remoteUrl;
  }

  if (!inFlight.has(finalUri)) {
    const task = downloadInBackground(fs, dirUri, fileName, remoteUrl, videoId).finally(() => {
      inFlight.delete(finalUri);
    });
    inFlight.set(finalUri, task);
  }
  return remoteUrl;
}
