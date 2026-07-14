import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { GradientBackground } from "@/components/GradientBackground";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { useInsets } from "@/hooks/useInsets";
import { useAuth } from "@/contexts/AuthContext";
import { uploadExercise, UploadError, UploadStage, VideoAsset, PosterAsset } from "@/lib/exercises";
import { generatePosterFromVideo } from "@/lib/posterFromVideo";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

const MAX_MB = 80;

function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

// Native direct uploads fail at a specific step; give each a clear title so the
// coach knows whether the bytes ever left the device and that a retry is safe.
function failureTitle(stage: UploadStage | undefined): string {
  switch (stage) {
    case "start":
      return "Couldn't start upload";
    case "upload":
      return "Upload interrupted";
    case "confirm":
      return "Couldn't save details";
    default:
      return "Upload failed";
  }
}

export default function UploadExercise() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { isAdmin, adminToken } = useAuth();
  // When the coach taps the upload button on a specific exercise inside a
  // workout, these arrive so the video is tied to THAT exercise. They're absent
  // for a generic library upload.
  const params = useLocalSearchParams<{
    workoutId?: string;
    exerciseId?: string;
    moveId?: string;
    title?: string;
    category?: string;
    level?: string;
  }>();
  const forWorkout = !!params.workoutId && !!params.exerciseId;
  const exerciseName = (params.title ?? "").trim();

  const [asset, setAsset] = useState<(VideoAsset & { size?: number }) | null>(null);
  const [poster, setPoster] = useState<PosterAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);

  if (!isAdmin) {
    return (
      <GradientBackground>
        <View style={styles.guard}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.mutedForeground} />
          <Text style={styles.guardTitle}>Admins only</Text>
          <Text style={styles.guardText}>This area is reserved for the Florish admin account.</Text>
          <Button label="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: 20, width: 200 }} />
        </View>
      </GradientBackground>
    );
  }

  const pickVideo = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        haptics.warning();
        notify("Permission needed", "Please allow library access to choose a video.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 1,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const a = result.assets[0];
      if (a.fileSize && a.fileSize > MAX_MB * 1024 * 1024) {
        haptics.warning();
        notify("Video too large", `Please choose a video under ${MAX_MB}MB.`);
        return;
      }
      setAsset({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType, size: a.fileSize ?? undefined });

      // Silently capture a poster from the first frame so members get a
      // thumbnail; the coach never sees or manages it here.
      try {
        const generated = await generatePosterFromVideo(a.uri);
        setPoster(generated);
      } catch {
        setPoster(null);
      }
    } catch {
      haptics.warning();
      notify("Could not open library", "Something went wrong picking a video.");
    }
  };

  const submit = async () => {
    if (!asset) {
      haptics.warning();
      notify("Video required", "Choose a video to upload.");
      return;
    }
    setBusy(true);
    setProgress({ sent: 0, total: asset.size ?? 0 });
    try {
      await uploadExercise({
        title: exerciseName,
        description: "",
        cues: "",
        category: (params.category ?? "Strength").trim() || "Strength",
        level: (params.level ?? "Beginner").trim() || "Beginner",
        duration: "",
        asset,
        poster,
        workoutId: params.workoutId ?? null,
        workoutExerciseId: params.exerciseId ?? null,
        moveId: params.moveId ?? null,
        token: adminToken ?? "",
        onProgress: (sent, total) => setProgress({ sent, total }),
      });
      if (Platform.OS !== "web") {
        Alert.alert(
          "Uploaded",
          forWorkout
            ? `This video is now tied to ${exerciseName || "this exercise"}.`
            : "Your exercise video is now live for all members."
        );
      }
      // Return to the workout so the coach lands back on the exercise they
      // uploaded for; otherwise show the standalone library.
      if (forWorkout) router.back();
      else router.replace("/exercises");
    } catch (e: any) {
      haptics.warning();
      const stage: UploadStage | undefined = e instanceof UploadError ? e.stage : undefined;
      const title = failureTitle(stage);
      const message = e?.message ?? "Please try again.";
      // Native offers a one-tap Retry that reuses this same flow; the picked
      // video stays selected so the coach doesn't have to choose it again. Web
      // keeps its plain alert (the proxy upload has no per-step stages) and the
      // coach simply taps Publish again.
      if (Platform.OS === "web") {
        notify(title, message);
      } else {
        Alert.alert(title, message, [
          { text: "Cancel", style: "cancel" },
          { text: "Retry", onPress: () => { void submit(); } },
        ]);
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const sizeLabel = asset?.size ? ` · ${(asset.size / (1024 * 1024)).toFixed(1)} MB` : "";
  const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.sent / progress.total) * 100))
      : 0;

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader
          variant="compact"
          eyebrow="ADMIN"
          title="Upload"
          accent="Exercise"
          style={styles.header}
          leading={
            <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.foreground} />
            </Pressable>
          }
        />

        {forWorkout && (
          <View style={styles.forCard}>
            <Ionicons name="link-outline" size={18} color={colors.accent} />
            <Text style={styles.forText} numberOfLines={2}>
              This video will play for <Text style={styles.forName}>{exerciseName || "this exercise"}</Text>
              {params.moveId ? " in every workout that uses this move." : " in the workout."}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Video</Text>
        <Pressable style={styles.videoPick} onPress={pickVideo}>
          <Ionicons name={asset ? "checkmark-circle" : "videocam-outline"} size={22} color={colors.accent} />
          <Text style={styles.videoPickText} numberOfLines={1}>
            {asset ? `${asset.fileName || "Video selected"}${sizeLabel}` : "Choose a video from your library"}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <Text style={styles.hint}>MP4 recommended · up to {MAX_MB}MB · visible to all members</Text>

        {busy && progress ? (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>
                {progress.total > 0 ? `Uploading… ${pct}%` : "Uploading…"}
              </Text>
              {progress.total > 0 ? (
                <Text style={styles.progressBytes}>
                  {mb(progress.sent)} / {mb(progress.total)} MB
                </Text>
              ) : null}
            </View>
            <View style={styles.progressTrack}>
              {progress.total > 0 ? (
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              ) : (
                <View style={[styles.progressFill, styles.progressFillIndeterminate]} />
              )}
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.submit, busy && { opacity: 0.7 }]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimaryStrong} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.onPrimaryStrong} />
              <Text style={styles.submitText}>Publish to Library</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { marginBottom: 8 },
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
  forCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    backgroundColor: colors.accentTint,
    borderWidth: 1,
    borderColor: colors.accentBorderMd,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  forText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.foreground, lineHeight: 20 },
  forName: { fontFamily: fonts.sansSemibold, color: colors.accent },
  label: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground, marginTop: 22, marginBottom: 10 },
  videoPick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  videoPickText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 10 },
  progressCard: {
    marginTop: 30,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  progressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  progressBytes: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.cardBorder,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.accent },
  progressFillIndeterminate: { width: "40%" },
  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: colors.radius,
    paddingVertical: 16,
    marginTop: 16,
  },
  submitText: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.onPrimaryStrong },
  guard: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  guardTitle: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground, marginTop: 8 },
  guardText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center" },
});
