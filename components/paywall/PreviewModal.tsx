import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, Platform, ActivityIndicator } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useInsets } from "@/hooks/useInsets";
import { resolvePreviewSource } from "@/lib/previewVideo";
import type { AppColors } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

type PlayState = "loading" | "ready" | "empty" | "error";

// Fullscreen preview player opened from the paywall's "Watch Preview" control.
// Resolves a real source at open time (a configured preview URL, else the
// welcome video). If nothing resolves — or playback fails — it shows a calm
// "coming soon" card rather than trapping the member on a black screen.
export function PreviewModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();
  const [state, setState] = useState<PlayState>("loading");

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setState("loading");
    (async () => {
      const src = await resolvePreviewSource();
      if (cancelled) return;
      if (!src) {
        setState("empty");
        return;
      }
      try {
        // Mirror the thank-you flow: the endpoint may 302 to a signed URL that
        // iOS's native player won't follow, so resolve it in JS first. For a
        // direct URL this is a no-op (resp.url === url).
        let url = src.url;
        if (Platform.OS !== "web") {
          const resp = await fetch(url, { redirect: "follow", headers: { Range: "bytes=0-0" } });
          if (!resp.ok) throw new Error(`status ${resp.status}`);
          url = resp.url || url;
        }
        if (cancelled) return;
        await player.replaceAsync(url);
        player.play();
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, player]);

  // Stop playback whenever the modal is dismissed.
  useEffect(() => {
    if (!visible) {
      try {
        player.pause();
      } catch {
        // player may already be released.
      }
    }
  }, [visible, player]);

  const showVideo = state === "ready" || state === "loading";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent={false}
    >
      <View style={styles.root}>
        {showVideo ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />
        ) : null}

        {state === "loading" ? (
          <View style={styles.center} pointerEvents="none">
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}

        {state === "empty" || state === "error" ? (
          <View style={styles.center}>
            <View style={styles.emptyChip}>
              <Ionicons name="play-circle-outline" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.emptyTitle}>
              {state === "error" ? "Preview unavailable" : "Preview coming soon"}
            </Text>
            <Text style={styles.emptySub}>
              {state === "error"
                ? "We couldn't load the preview right now. Please try again later."
                : "A sneak peek of your workouts is on its way."}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.close, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close preview"
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const createStyles = (_colors: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000" },
    center: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
    },
    emptyChip: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: "rgba(255,255,255,0.12)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },
    emptyTitle: {
      fontFamily: fonts.serifSemibold,
      fontSize: 22,
      color: "#FFFFFF",
      textAlign: "center",
    },
    emptySub: {
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      color: "rgba(255,255,255,0.7)",
      textAlign: "center",
      marginTop: 8,
    },
    close: {
      position: "absolute",
      left: 18,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "rgba(16,17,17,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
  });
