import { useCallback, useEffect, useState } from "react";

// Warms a remote image URL so it is in cache before it is shown.
export type PrefetchFn = (url: string) => Promise<unknown>;

export type OptimisticAvatar = {
  // The URI the avatar should render from right now: the just-picked local
  // image if one is pending, otherwise the canonical object-storage URL (or
  // null, so the UI shows initials).
  avatarSource: string | null;
  // Show a freshly-picked local image instantly, the moment it is picked (before
  // the upload round-trip completes).
  showPicked: (uri: string) => void;
  // Drop any optimistic preview (e.g. on remove, or a failed upload) so the
  // avatar falls back to the canonical URL or initials at once.
  clearPicked: () => void;
};

// Encapsulates the "instant profile photo" behavior:
// - the locally-picked URI is shown immediately when the image is picked, while
//   the upload runs in the background;
// - the canonical (object-storage) URL captured at pick time is remembered as a
//   baseline so the preview is held until the canonical URL actually changes to
//   the freshly-uploaded one (avoiding a flash back to the previous photo while
//   the upload is still in flight);
// - once the new canonical URL arrives it is prefetched in the background and,
//   when warm, the local preview is cleared so every render reads the canonical
//   URL;
// - the preview never carries across accounts: it clears whenever the
//   signed-in user id changes;
// - clearPicked() drops the preview instantly (used on remove or upload failure).
export function useOptimisticAvatar(
  canonicalAvatar: string | null,
  userId: string | null | undefined,
  prefetch: PrefetchFn
): OptimisticAvatar {
  // Local URI of the just-picked image. Shown instantly when picked so the new
  // photo appears with no round-trip, until the new canonical image has been
  // warmed and we swap to it.
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  // The canonical URL present when the preview started. We only swap to the
  // canonical image once it differs from this baseline, i.e. once the upload has
  // produced a new object-storage URL/version. Without this, the warm effect
  // would immediately prefetch the *previous* photo and flash back to it while
  // the upload is still running.
  const [baseline, setBaseline] = useState<string | null>(null);

  // Never carry an optimistic preview across accounts: clear it whenever the
  // signed-in user changes.
  useEffect(() => {
    setLocalAvatar(null);
    setBaseline(null);
  }, [userId]);

  // Once the canonical URL reflects the new upload (it differs from the baseline
  // captured at pick time), warm it in the background, then drop the local
  // preview so every render (and other screens) reads from the canonical URL.
  useEffect(() => {
    if (!localAvatar) return;
    if (!canonicalAvatar || canonicalAvatar === baseline) return;
    let cancelled = false;
    (async () => {
      try {
        await prefetch(canonicalAvatar);
      } catch {
        // Even if warming fails, swap to the canonical URL so the displayed
        // image stays consistent with what other screens load.
      }
      if (!cancelled) {
        setLocalAvatar(null);
        setBaseline(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localAvatar, canonicalAvatar, baseline, prefetch]);

  // Prefer the just-picked local image while an upload is pending, then fall
  // back to the canonical object-storage URL once it has been warmed.
  const avatarSource = localAvatar ?? canonicalAvatar;

  // Capture the canonical URL at pick time as the baseline to swap away from.
  const showPicked = useCallback(
    (uri: string) => {
      setLocalAvatar(uri);
      setBaseline(canonicalAvatar);
    },
    [canonicalAvatar]
  );

  const clearPicked = useCallback(() => {
    setLocalAvatar(null);
    setBaseline(null);
  }, []);

  return {
    avatarSource,
    showPicked,
    clearPicked,
  };
}
