import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { GradientBackground } from "@/components/GradientBackground";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { useInsets } from "@/hooks/useInsets";
import { useAuth } from "@/contexts/AuthContext";
import {
  uploadThankYouVideo,
  deleteThankYouVideo,
  thankYouVideoExists,
} from "@/lib/thankYouVideo";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const MAX_MB = 80;

function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

type Asset = { uri: string; fileName?: string | null; mimeType?: string | null; size?: number };

export default function UploadThankYou() {
  const router = useRouter();
  const insets = useInsets();
  const { isAdmin, adminToken } = useAuth();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [hasExisting, setHasExisting] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const exists = await thankYouVideoExists();
      if (!cancelled) setHasExisting(exists);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        notify("Video too large", `Please choose a video under ${MAX_MB}MB.`);
        return;
      }
      setAsset({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType, size: a.fileSize ?? undefined });
    } catch {
      notify("Could not open library", "Something went wrong picking a video.");
    }
  };

  const submit = async () => {
    if (!asset) {
      notify("Video required", "Choose a video to upload.");
      return;
    }
    setBusy(true);
    setProgress({ sent: 0, total: asset.size ?? 0 });
    try {
      await uploadThankYouVideo({
        uri: asset.uri,
        mimeType: asset.mimeType,
        token: adminToken ?? "",
        onProgress: (sent, total) => setProgress({ sent, total }),
      });
      if (Platform.OS !== "web") {
        Alert.alert("Saved", "Your thank-you video will play after the paywall for new members.");
      }
      router.back();
    } catch (e: any) {
      const message = e?.message ?? "Please try again.";
      if (Platform.OS === "web") {
        notify("Upload failed", message);
      } else {
        Alert.alert("Upload failed", message, [
          { text: "Cancel", style: "cancel" },
          { text: "Retry", onPress: () => { void submit(); } },
        ]);
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const removeExisting = () => {
    const run = async () => {
      try {
        await deleteThankYouVideo(adminToken ?? "");
        setHasExisting(false);
        if (Platform.OS !== "web") Alert.alert("Removed", "New members will skip straight to the dashboard.");
      } catch {
        notify("Could not remove", "Something went wrong removing the video.");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm("Remove the current thank-you video? New members will skip straight to the dashboard.")) run();
    } else {
      Alert.alert("Remove video", "New members will skip straight to the dashboard.", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: run },
      ]);
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
      >
        <PageHeader
          variant="compact"
          eyebrow="ADMIN"
          title="Thank-you"
          accent="Video"
          style={styles.header}
          leading={
            <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.foreground} />
            </Pressable>
          }
        />

        <View style={styles.forCard}>
          <Ionicons name="heart-outline" size={18} color={colors.accent} />
          <Text style={styles.forText}>
            This single video plays once after the paywall, before a new member reaches the dashboard.
          </Text>
        </View>

        {hasExisting && (
          <View style={styles.statusCard}>
            <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
            <Text style={styles.statusText}>A thank-you video is set. Upload a new one to replace it.</Text>
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
        <Text style={styles.hint}>MP4 recommended · up to {MAX_MB}MB · shown to new members</Text>

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
              <Text style={styles.submitText}>{hasExisting ? "Replace Video" : "Save Video"}</Text>
            </>
          )}
        </Pressable>

        {hasExisting && !busy && (
          <Pressable style={styles.removeBtn} onPress={removeExisting}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.removeText}>Remove current video</Text>
          </Pressable>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
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
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  statusText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
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
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  removeText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.danger },
  guard: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  guardTitle: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground, marginTop: 8 },
  guardText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center" },
});
