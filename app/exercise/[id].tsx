import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { GradientBackground } from "@/components/GradientBackground";
import { useInsets } from "@/hooks/useInsets";
import { videoUrl } from "@/lib/exercises";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

export default function ExercisePlayer() {
  const { id, title, description, cues, category, level, duration } = useLocalSearchParams<{
    id: string;
    title?: string;
    description?: string;
    cues?: string;
    category?: string;
    level?: string;
    duration?: string;
  }>();
  const router = useRouter();
  const insets = useInsets();

  const player = useVideoPlayer(id ? videoUrl(id) : null, (p) => {
    p.loop = false;
    p.play();
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
  info: { paddingHorizontal: 20, marginTop: 24, gap: 8 },
  cat: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.accent, letterSpacing: 0.6 },
  title: { fontFamily: fonts.serifSemibold, fontSize: 28, color: colors.foreground },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(247,235,232,0.1)",
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
    backgroundColor: "rgba(201,137,122,0.1)",
    borderWidth: 1,
    borderColor: "rgba(201,137,122,0.28)",
    borderRadius: colors.radius,
    padding: 16,
    gap: 8,
  },
  cuesLabel: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.accent, letterSpacing: 1.2 },
  cuesText: { fontFamily: fonts.sans, fontSize: 15, color: colors.foreground, lineHeight: 23 },
});
