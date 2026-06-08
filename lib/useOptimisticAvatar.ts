import { useEffect, useState } from "react";

// Warms a remote image URL so it is in cache before it is shown.
export type PrefetchFn = (url: string) => Promise<unknown>;

export type OptimisticAvatar = {
  // The URI the avatar should render from right now: the just-picked local
  // image if one is pending, otherwise the canonical object-storage URL (or
  // null, so the UI shows initials).
  avatarSource: string | null;
  // Show a freshly-picked local image instantly after a successful upload.
  showPicked: (uri: string) => void;
  // Drop any optimistic preview (e.g. on remove) so the avatar falls back to
  // the canonical URL or initials at once.
  clearPicked: () => void;
};

// Encapsulates the "instant profile photo" behavior:
// - after a successful upload the locally-picked URI is shown immediately;
// - in the background the canonical (object-storage) URL is prefetched and,
//   once warm, the local preview is cleared so every render reads the
//   canonical URL;
// - the preview never carries across accounts: it clears whenever the
//   signed-in user id changes;
// - clearPicked() drops the preview instantly (used on remove).
export function useOptimisticAvatar(
  canonicalAvatar: string | null,
  userId: string | null | undefined,
  prefetch: PrefetchFn
): OptimisticAvatar {
  // Local URI of the just-picked image. Shown instantly after a successful
  // upload so the new photo appears with no round-trip, until the canonical
  // image has been warmed and we swap back to it.
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  // Never carry an optimistic preview across accounts: clear it whenever the
  // signed-in user changes.
  useEffect(() => {
    setLocalAvatar(null);
  }, [userId]);

  // Warm the canonical image in the background, then drop the local preview so
  // every render (and other screens) reads from the canonical URL.
  useEffect(() => {
    if (!localAvatar || !canonicalAvatar) return;
    let cancelled = false;
    (async () => {
      try {
        await prefetch(canonicalAvatar);
      } catch {
        // Even if warming fails, swap to the canonical URL so the displayed
        // image stays consistent with what other screens load.
      }
      if (!cancelled) setLocalAvatar(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [localAvatar, canonicalAvatar, prefetch]);

  // Prefer the just-picked local image right after an upload, then fall back to
  // the canonical object-storage URL once it has been warmed.
  const avatarSource = localAvatar ?? canonicalAvatar;

  return {
    avatarSource,
    showPicked: setLocalAvatar,
    clearPicked: () => setLocalAvatar(null),
  };
}
