import React, { useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { GradientBackground } from "@/components/GradientBackground";
import { PageHeader } from "@/components/PageHeader";
import { useInsets } from "@/hooks/useInsets";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/Button";
import { updateExercisePoster, posterUrl, videoUrl, PosterAsset } from "@/lib/exercises";
import { generatePosterFromVideo } from "@/lib/posterFromVideo";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export default function EditPoster() {
  const router = useRouter();
  const insets = useInsets();
  const { isAdmin, adminToken } = useAuth();
  const { id, title, hasPoster } = useLocalSearchParams<{
    id: string;
    title?: string;
    hasPoster?: string;
  }>();

  // A freshly chosen/generated poster, or null until the coach picks one.
  const [poster, setPoster] = useState<PosterAsset | null>(null);
  const [posterBusy, setPosterBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return (
      <GradientBackground>
        <View style={styles.guard}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.mutedForeground} />
          <Text style={styles.guardTitle}>Coaches only</Text>
          <Text style={styles.guardText}>This area is reserved for the Shape coach account.</Text>
          <Button label="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: 20, width: 200 }} />
        </View>
      </GradientBackground>
    );
  }

  const pickPoster = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify("Permission needed", "Please allow library access to choose an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const a = result.assets[0];
      setPoster({ uri: a.uri, mimeType: a.mimeType || "image/jpeg" });
    } catch {
      notify("Could not open library", "Something went wrong picking an image.");
    }
  };

  const regeneratePoster = async () => {
    if (!id) return;
    setPosterBusy(true);
    try {
      const generated = await generatePosterFromVideo(videoUrl(id));
      if (generated) {
        setPoster(generated);
      } else {
        notify("Couldn't capture a frame", "Choose a custom image instead.");
      }
    } finally {
      setPosterBusy(false);
    }
  };

  const save = async () => {
    if (!id) return;
    if (!poster?.uri) {
      notify("Pick a poster", "Choose a new image or capture one from the video first.");
      return;
    }
    setBusy(true);
    try {
      await updateExercisePoster({ id, poster, token: adminToken ?? "" });
      if (Platform.OS !== "web") Alert.alert("Poster updated", "Members will see the new poster.");
      router.back();
    } catch (e: any) {
      notify("Update failed", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Show the freshly chosen poster, otherwise the existing one (if any).
  const previewUri = poster?.uri ?? (hasPoster && id ? posterUrl(id) : null);

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Header onBack={() => router.back()} />

        {title ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {title}
          </Text>
        ) : null}

        <View style={styles.previewWrap}>
          {posterBusy ? (
            <ActivityIndicator color={colors.accent} />
          ) : previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImg} contentFit="cover" transition={150} />
          ) : (
            <View style={styles.previewEmpty}>
              <Ionicons name="image-outline" size={32} color={colors.muted} />
              <Text style={styles.previewEmptyText}>No poster yet</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={pickPoster}>
            <Ionicons name="images-outline" size={18} color={colors.foreground} />
            <Text style={styles.actionText}>Choose image</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, posterBusy && { opacity: 0.5 }]}
            onPress={regeneratePoster}
            disabled={posterBusy}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.foreground} />
            <Text style={styles.actionText}>From video</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          {poster
            ? "New poster ready. Tap Save to publish it to all members."
            : "Pick a new image, or capture a frame from the existing video."}
        </Text>

        <Pressable style={[styles.save, (busy || !poster) && { opacity: 0.6 }]} onPress={save} disabled={busy || !poster}>
          {busy ? (
            <ActivityIndicator color={colors.onPrimaryStrong} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.onPrimaryStrong} />
              <Text style={styles.saveText}>Save Poster</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </GradientBackground>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <PageHeader
      variant="compact"
      eyebrow="COACH"
      title="Edit"
      accent="Poster"
      style={styles.header}
      leading={
        <Pressable style={styles.roundBtn} onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
      }
    />
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
  subtitle: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.muted, marginTop: 14 },
  previewWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 18,
  },
  previewImg: { width: "100%", height: "100%" },
  previewEmpty: { alignItems: "center", gap: 8 },
  previewEmptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  actions: { flexDirection: "row", gap: 12, marginTop: 18 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingVertical: 14,
  },
  actionText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 12 },
  save: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: colors.radius,
    paddingVertical: 16,
    marginTop: 28,
  },
  saveText: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.onPrimaryStrong },
  guard: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  guardTitle: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground, marginTop: 8 },
  guardText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center" },
});
