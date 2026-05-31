import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { useInsets } from "@/hooks/useInsets";
import { useAuth } from "@/contexts/AuthContext";
import { uploadExercise, VideoAsset } from "@/lib/exercises";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const CATEGORIES = ["Pilates", "Yoga", "Strength", "HIIT", "Mobility", "Cardio"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const MAX_MB = 80;

function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export default function UploadExercise() {
  const router = useRouter();
  const insets = useInsets();
  const { user, isAdmin } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cues, setCues] = useState("");
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState("Strength");
  const [level, setLevel] = useState("Beginner");
  const [asset, setAsset] = useState<(VideoAsset & { size?: number }) | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return (
      <GradientBackground>
        <View style={styles.guard}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.mutedForeground} />
          <Text style={styles.guardTitle}>Coaches only</Text>
          <Text style={styles.guardText}>This area is reserved for the Florish coach account.</Text>
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
    if (!title.trim()) {
      notify("Title required", "Give this exercise a title.");
      return;
    }
    if (!asset) {
      notify("Video required", "Choose a video to upload.");
      return;
    }
    setBusy(true);
    try {
      await uploadExercise({
        title: title.trim(),
        description: description.trim(),
        cues: cues.trim(),
        category,
        level,
        duration: duration.trim(),
        asset,
        email: user?.email ?? "",
      });
      if (Platform.OS !== "web") Alert.alert("Uploaded", "Your exercise video is now live for all members.");
      router.back();
    } catch (e: any) {
      notify("Upload failed", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const sizeLabel = asset?.size ? ` · ${(asset.size / (1024 * 1024)).toFixed(1)} MB` : "";

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>COACH</Text>
            <Text style={styles.title}>
              Upload <Text style={styles.titleItalic}>Exercise</Text>
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Single Leg Glute Bridge"
          placeholderTextColor={colors.mutedForeground}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Cues, form tips, what members should focus on…"
          placeholderTextColor={colors.mutedForeground}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>Coaching cues</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Step-by-step cues members should follow…"
          placeholderTextColor={colors.mutedForeground}
          value={cues}
          onChangeText={setCues}
          multiline
        />

        <Text style={styles.label}>Duration</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 3 min · 12 reps each side"
          placeholderTextColor={colors.mutedForeground}
          value={duration}
          onChangeText={setDuration}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} style={[styles.chip, category === c && styles.chipOn]} onPress={() => setCategory(c)}>
              <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Level</Text>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <Pressable key={l} style={[styles.chip, level === l && styles.chipOn]} onPress={() => setLevel(l)}>
              <Text style={[styles.chipText, level === l && styles.chipTextOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Video</Text>
        <Pressable style={styles.videoPick} onPress={pickVideo}>
          <Ionicons name={asset ? "checkmark-circle" : "videocam-outline"} size={22} color={colors.accent} />
          <Text style={styles.videoPickText} numberOfLines={1}>
            {asset ? `${asset.fileName || "Video selected"}${sizeLabel}` : "Choose a video from your library"}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <Text style={styles.hint}>MP4 recommended · up to {MAX_MB}MB · visible to all members</Text>

        <Pressable
          style={[styles.submit, busy && { opacity: 0.7 }]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.onPrimary} />
              <Text style={styles.submitText}>Publish to Library</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
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
  eyebrow: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted, letterSpacing: 3 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.foreground, marginTop: 2 },
  titleItalic: { fontFamily: fonts.serifItalic, fontStyle: "italic", color: colors.foreground },
  label: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground, marginTop: 22, marginBottom: 10 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
  },
  textArea: { minHeight: 96, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted },
  chipTextOn: { color: colors.onPrimary },
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
  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: colors.radius,
    paddingVertical: 16,
    marginTop: 30,
  },
  submitText: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.onPrimary },
  guard: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  guardTitle: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground, marginTop: 8 },
  guardText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center" },
});
