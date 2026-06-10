// The race-safe exercise-clip loader, extracted from the workout screen so its
// monotonic load token and the `loadedVideoId` reset can be unit-tested without
// pulling in expo-video. The screen owns two refs (a monotonic `loadSeq` and the
// confirmed-loaded `loadedVideoId`) and supplies the real player/network calls as
// injected deps; this keeps the helper importable under the node:test + tsx suite.

// The two mutable refs the screen owns and the loader reads/writes. Modelled as
// `{ current }` boxes so a React `useRef` can be passed straight through.
export type ClipLoaderRefs = {
  // Monotonic token bumped at the START of every load. A load that finds the
  // token has moved on (a newer load started) is "stale" and bows out.
  loadSeq: { current: number };
  // The video id confirmed-loaded into the player, or null while a load is in
  // flight. A "playToEnd" only completes the current exercise when it matches.
  loadedVideoId: { current: string | null };
};

// Side dependencies the load needs, injected so the helper imports nothing from
// react-native / expo-video. The screen supplies the real implementations.
export type ClipLoaderDeps = {
  // The video mapped to the exercise now showing, or null/undefined when it has
  // no clip. The load reads its id once and judges staleness against that.
  currentVideo: { id: string } | null | undefined;
  // True on web, where the native range-probe is skipped.
  isWeb: boolean;
  // Builds the playable URL for a video id.
  videoUrl: (id: string) => string;
  // Native-only HEAD/Range probe that follows redirects and surfaces the final
  // URL. Throws / returns ok:false to abort the load (header image stays).
  probe?: (url: string) => Promise<{ ok: boolean; status: number; url: string }>;
  // Swaps the player's source. Called with null to clear it for a no-video
  // exercise, or the resolved URL to load the clip.
  replaceAsync: (src: string | null) => Promise<void>;
  // Starts playback (only when the session is already running, i.e. not paused).
  play: () => void;
  // Reads the live paused flag via a ref so the load reflects intent at the
  // moment it resolves, not when it started.
  isPaused: () => boolean;
  // Clears the live video position/length before the new clip loads.
  resetVideoProgress: () => void;
};

// Load the current exercise's clip into the player, race-safely. Bumps the load
// token, clears the confirmed-loaded id, then (for a real clip) probes, swaps the
// source and records the loaded id, bailing out the instant a newer load has
// started so a slow load can never apply (or auto-play) the wrong clip after the
// user has moved on.
export async function loadExerciseClip(
  refs: ClipLoaderRefs,
  deps: ClipLoaderDeps,
): Promise<void> {
  const seq = ++refs.loadSeq.current;
  const isStale = () => seq !== refs.loadSeq.current;
  deps.resetVideoProgress();
  // No clip confirmed-loaded until the swap below succeeds.
  refs.loadedVideoId.current = null;

  if (!deps.currentVideo) {
    try {
      await deps.replaceAsync(null);
    } catch {
      // ignore
    }
    return;
  }

  const videoId = deps.currentVideo.id;
  try {
    let finalUrl = deps.videoUrl(videoId);
    if (!deps.isWeb && deps.probe) {
      const resp = await deps.probe(finalUrl);
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      finalUrl = resp.url || finalUrl;
    }
    if (isStale()) return;
    await deps.replaceAsync(finalUrl);
    if (isStale()) return;
    refs.loadedVideoId.current = videoId;
    if (!deps.isPaused()) deps.play();
  } catch {
    // Leave the header image fallback in place if the video can't load.
  }
}
