import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";
import { GradientBackground } from "@/components/GradientBackground";
import { useInsets } from "@/hooks/useInsets";
import { videoUrl, posterUrl } from "@/lib/exercises";
import { findExerciseImage } from "@/constants/workouts";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

export default function ExercisePlayer() {
  const { id, title, description, cues, category, level, duration, hasPoster, workoutId, workoutExerciseId } =
    useLocalSearchParams<{
      id: string;
      title?: string;
      description?: string;
      cues?: string;
      category?: string;
      level?: string;
      duration?: string;
      hasPoster?: string;
      workoutId?: string;
      workoutExerciseId?: string;
    }>();
  const router = useRouter();
  const insets = useInsets();
  const localImage = findExerciseImage({ workoutId, workoutExerciseId, name: title });
  const [showPoster, setShowPoster] = useState(!!hasPoster || !!localImage);
  const [posterError, setPosterError] = useState(false);
  const [videoState, setVideoState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  // The video endpoint responds with a 302 redirect to a short-lived signed
  // GCS URL. iOS's native player (Expo Go) does not reliably follow that
  // cross-origin redirect, so we resolve it in JS first and hand the player the
  // final URL. On web the browser's media element follows the redirect fine and
  // fetching the GCS URL directly would fail CORS, so we pass it through as-is.
  useEffect(() => {
    if (!id) {
      setVideoState("error");
      return;
    }
    let cancelled = false;
    setVideoState("loading");
    (async () => {
      try {
        let finalUrl = videoUrl(id);
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
        if (!cancelled) setVideoState("ready");
      } catch {
        if (!cancelled) setVideoState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, player, retry]);

  // Keep the poster visible until the first frame is ready, then reveal the video.
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "readyToPlay") setShowPoster(false);
  });

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topBar, { marginTop: insets.top + 8 }]}>
          <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={styles.topLabel}>NOW PLAYING</Text>
          <View style={{ width: 42 }} />
        </View>

        <View style={styles.videoWrap}>
          <VideoView
            player={player}
            style={styles.video}
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
            nativeControls
          />
          {showPoster && videoState !== "error" && !!hasPoster && !posterError && (
            <Image
              source={{ uri: posterUrl(id) }}
              style={styles.poster}
              contentFit="cover"
              transition={150}
              pointerEvents="none"
              onError={() => setPosterError(true)}
            />
          )}
          {showPoster && videoState !== "error" && (!hasPoster || posterError) && !!localImage && (
            <Image
              source={localImage}
              style={styles.poster}
              contentFit="cover"
              transition={150}
              pointerEvents="none"
            />
          )}
          {videoState === "loading" && (
            <View style={styles.videoOverlay} pointerEvents="none">
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.overlayText}>Loading video…</Text>
            </View>
          )}
          {videoState === "error" && (
            <View style={styles.videoOverlay}>
              <Ionicons name="alert-circle-outline" size={30} color="#FFFFFF" />
              <Text style={styles.overlayText}>This video couldn’t be loaded.</Text>
              <Pressable style={styles.retryBtn} onPress={() => setRetry((n) => n + 1)}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.info}>
          {!!category && <Text style={styles.cat}>{String(category).toUpperCase()}</Text>}
          <Text style={styles.title}>{title || "Exercise"}</Text>
          <View style={styles.metaRow}>
            {!!level && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{level}</Text>
              </View>
            )}
            {!!duration && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={colors.muted} />
                <Text style={styles.metaText}>{duration}</Text>
              </View>
            )}
          </View>
          {!!description && <Text style={styles.desc}>{description}</Text>}
          {!!cues && (
            <View style={styles.cuesBox}>
              <Text style={styles.cuesLabel}>COACHING CUES</Text>
              <Text style={styles.cuesText}>{cues}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  topLabel: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.muted, letterSpacing: 1.5 },
  videoWrap: {
    marginTop: 16,
    marginHorizontal: 20,
    borderRadius: colors.radiusLg,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  video: { width: "100%", aspectRatio: 16 / 9 },
  poster: { ...StyleSheet.absoluteFillObject },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
    backgroundColor: "rgba(16,17,17,0.55)",
  },
  overlayText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
  },
  retryText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  info: { paddingHorizontal: 20, marginTop: 24, gap: 8 },
  cat: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.accent, letterSpacing: 0.6 },
  title: { fontFamily: fonts.serifSemibold, fontSize: 28, color: colors.foreground },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16,17,17,0.1)",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 2,
  },
  pillText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  desc: { fontFamily: fonts.sans, fontSize: 15, color: colors.mutedForeground, lineHeight: 23, marginTop: 8 },
  cuesBox: {
    marginTop: 14,
    backgroundColor: "rgba(82,91,74,0.1)",
    borderWidth: 1,
    borderColor: "rgba(82,91,74,0.28)",
    borderRadius: colors.radius,
    padding: 16,
    gap: 8,
  },
  cuesLabel: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.accent, letterSpacing: 1.2 },
  cuesText: { fontFamily: fonts.sans, fontSize: 15, color: colors.foreground, lineHeight: 23 },
});
