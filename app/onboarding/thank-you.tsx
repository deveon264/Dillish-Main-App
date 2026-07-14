import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";
import { useInsets } from "@/hooks/useInsets";
import { useData } from "@/contexts/DataContext";
import { SkeletonBlock, SkeletonGroup } from "@/components/Skeleton";
import { thankYouVideoUrl, thankYouVideoExists } from "@/lib/thankYouVideo";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { ScreenEntrance } from "@/components/Motion";

// Plays once between the onboarding paywall and the dashboard. EVERY exit from
// the paywall routes here. When playback ends (or the member taps Skip, or no
// video is set / it fails to load) we continue to the dashboard. We use
// `replace` so the back gesture never returns to the paywall.
export default function ThankYouVideo() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { queueWelcome } = useData();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  const goToApp = React.useCallback(() => {
    // Queue the one-time home-screen welcome popup before handing off, so it
    // greets the member the moment the dashboard appears.
    queueWelcome();
    router.replace("/(tabs)");
  }, [router, queueWelcome]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // If the coach hasn't set a video, don't stall onboarding — continue
        // straight to the dashboard.
        const exists = await thankYouVideoExists();
        if (cancelled) return;
        if (!exists) {
          goToApp();
          return;
        }

        // The endpoint 302-redirects to a short-lived signed GCS URL. iOS's
        // native player doesn't reliably follow that cross-origin redirect, so
        // resolve it in JS first; on web the media element follows it fine and
        // fetching the GCS URL directly would fail CORS, so pass it through.
        let finalUrl = thankYouVideoUrl();
        if (Platform.OS !== "web") {
          const resp = await fetch(finalUrl, {
            redirect: "follow",
            headers: { Range: "bytes=0-0" },
          });
          if (!resp.ok) throw new Error(`status ${resp.status}`);
          finalUrl = resp.url || finalUrl;
        }
        if (cancelled) return;
        await player.replaceAsync(finalUrl);
        player.play();
        if (!cancelled) setState("ready");
      } catch {
        // Any failure should never trap the member on this screen.
        if (!cancelled) goToApp();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, goToApp]);

  // Continue to the dashboard as soon as the video finishes.
  useEventListener(player, "playToEnd", () => {
    goToApp();
  });

  return (
    <ScreenEntrance style={styles.root}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />

      {state === "loading" && (
        <SkeletonGroup
          label="Preparing your welcome video"
          tone="dark"
          style={styles.overlay}
          pointerEvents="none"
        >
          <SkeletonBlock tone="dark" style={styles.videoSkeleton} />
        </SkeletonGroup>
      )}

      <Pressable
        style={[styles.skip, { top: insets.top + 12 }]}
        onPress={goToApp}
        hitSlop={10}
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </ScreenEntrance>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  videoSkeleton: { width: "82%", height: "68%", borderRadius: 24 },
  skip: {
    position: "absolute",
    right: 18,
    backgroundColor: "rgba(16,17,17,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  skipText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: "#FFFFFF" },
});
