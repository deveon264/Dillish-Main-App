import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { MotionListItem } from "@/components/Motion";
import { useInsets } from "@/hooks/useInsets";
import { useAuth } from "@/contexts/AuthContext";
import { AdminControls } from "@/components/AdminControls";
import { PageHeader } from "@/components/PageHeader";
import { ListRowsSkeleton } from "@/components/LoadingSkeletons";
import { EmptyState } from "@/components/EmptyState";
import { listExercises, deleteExercise, posterUrl, UploadedExercise } from "@/lib/exercises";
import { findExerciseImage } from "@/constants/workouts";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

function formatSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function ExerciseLibrary() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { isAdmin, adminToken } = useAuth();
  const [items, setItems] = useState<UploadedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posterErrors, setPosterErrors] = useState<Record<string, boolean>>({});
  const loadedOnceRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listExercises();
      setItems(data);
    } catch {
      setError("Couldn't load exercise videos. Pull to retry.");
    } finally {
      loadedOnceRef.current = true;
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!loadedOnceRef.current) setLoading(true);
      load();
    }, [load])
  );

  const confirmDelete = (item: UploadedExercise) => {
    const run = async () => {
      haptics.warning();
      try {
        await deleteExercise(item.id, adminToken ?? "");
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } catch {
        haptics.warning();
        if (Platform.OS === "web") window.alert("Could not delete this exercise.");
        else Alert.alert("Delete failed", "Could not delete this exercise.");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${item.title}"? This cannot be undone.`)) run();
    } else {
      Alert.alert("Delete exercise", `Delete "${item.title}"? This cannot be undone.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: run },
      ]);
    }
  };

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          variant="compact"
          eyebrow="FLORISH"
          title="Exercise"
          accent="Videos"
          leading={
            <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.foreground} />
            </Pressable>
          }
          action={
            isAdmin ? (
              <Pressable style={styles.uploadBtn} onPress={() => router.push("/admin/upload-exercise")} hitSlop={8}>
                <Ionicons name="add" size={22} color={colors.onPrimary} />
              </Pressable>
            ) : null
          }
        />

        {isAdmin && <AdminControls />}

        {loading ? (
          <ListRowsSkeleton rows={4} label="Loading exercise videos" />
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedForeground} />
            <Text style={styles.muted}>{error}</Text>
            <Pressable style={styles.retry} onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon="film-outline"
            title="No videos yet"
            description={isAdmin ? "Upload the first guided exercise video." : "Browse complete workouts while the video library grows."}
            actionLabel={isAdmin ? "Upload first video" : "Browse workouts"}
            onAction={() => router.push(isAdmin ? "/admin/upload-exercise" : "/(tabs)/workouts")}
          />
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <MotionListItem key={item.id} style={styles.card}>
                <Pressable
                  pressedScale={0.985}
                  style={styles.cardMain}
                  onPress={() =>
                    router.push({
                      pathname: "/exercise/[id]",
                      params: {
                        id: item.id,
                        title: item.title,
                        description: item.description,
                        cues: item.cues,
                        category: item.category,
                        level: item.level,
                        duration: item.duration,
                        hasPoster: item.hasPoster ? "1" : "",
                        workoutId: item.workoutId ?? "",
                        workoutExerciseId: item.workoutExerciseId ?? "",
                      },
                    })
                  }
                >
                  <View style={styles.thumb}>
                    {(() => {
                      const showPoster = item.hasPoster && !posterErrors[item.id];
                      const localImage = !showPoster
                        ? findExerciseImage({
                            workoutId: item.workoutId,
                            workoutExerciseId: item.workoutExerciseId,
                            name: item.title,
                          })
                        : undefined;
                      const hasImage = showPoster || !!localImage;
                      return (
                        <>
                          {showPoster ? (
                            <Image
                              source={{ uri: posterUrl(item.id) }}
                              style={styles.thumbImg}
                              contentFit="cover"
                              transition={200}
                              cachePolicy="memory-disk"
                              onError={() => setPosterErrors((prev) => ({ ...prev, [item.id]: true }))}
                            />
                          ) : localImage ? (
                            <Image
                              source={localImage}
                              style={styles.thumbImg}
                              contentFit="cover"
                              transition={200}
                            />
                          ) : null}
                          <View style={[styles.playBadge, hasImage && styles.playBadgeOnImage]}>
                            <Ionicons name="play" size={16} color={colors.onPrimary} />
                          </View>
                        </>
                      );
                    })()}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardCat}>{item.category.toUpperCase()}</Text>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.cardMeta}>
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>{item.level}</Text>
                      </View>
                      {item.videoSize ? <Text style={styles.metaText}>{formatSize(item.videoSize)}</Text> : null}
                    </View>
                  </View>
                </Pressable>
                {isAdmin && (
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.iconBtn}
                      hitSlop={8}
                      onPress={() =>
                        router.push({
                          pathname: "/admin/edit-exercise",
                          params: {
                            id: item.id,
                            title: item.title,
                            description: item.description,
                            cues: item.cues,
                            duration: item.duration,
                            category: item.category,
                            level: item.level,
                          },
                        })
                      }
                    >
                      <Ionicons name="create-outline" size={18} color={colors.muted} />
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      hitSlop={8}
                      onPress={() =>
                        router.push({
                          pathname: "/admin/edit-poster",
                          params: { id: item.id, title: item.title, hasPoster: item.hasPoster ? "1" : "" },
                        })
                      }
                    >
                      <Ionicons name="image-outline" size={18} color={colors.muted} />
                    </Pressable>
                    <Pressable style={styles.iconBtn} hitSlop={8} onPress={() => confirmDelete(item)}>
                      <Ionicons name="trash-outline" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                )}
              </MotionListItem>
            ))}
          </View>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
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
  uploadBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 12 },
  muted: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, textAlign: "center", paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.serifSemibold, fontSize: 20, color: colors.foreground },
  retry: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  retryText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.accent },
  list: { gap: 14, marginTop: 22 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 14,
  },
  cardMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImg: { ...StyleSheet.absoluteFillObject },
  playBadge: { alignItems: "center", justifyContent: "center" },
  playBadgeOnImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(16,17,17,0.45)",
  },
  cardCat: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.accent, letterSpacing: 0.5 },
  cardTitle: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.foreground, marginTop: 2 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  pill: {
    backgroundColor: "rgba(16,17,17,0.1)",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.muted },
  metaText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },
  cardActions: { flexDirection: "row", alignItems: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
