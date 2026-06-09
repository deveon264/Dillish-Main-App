import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { POST_TYPE_META } from "@/components/community/postTypes";
import { useAuth } from "@/contexts/AuthContext";
import { useInsets } from "@/hooks/useInsets";
import { notify } from "@/lib/confirm";
import { createPost, uploadCommunityPhoto, POST_TYPES, type PostType } from "@/lib/community";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const MAX_CHARS = 2000;

export default function Compose() {
  const insets = useInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [type, setType] = useState<PostType>("progress");
  const [text, setText] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFrom = async (fromCamera: boolean) => {
    setError(null);
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Permission is required to add a photo.");
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: true,
      };
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setPhotoUri(asset.uri);
      setPhotoMime(asset.mimeType ?? null);
    } catch {
      setError("Unable to open the camera or library on this device.");
    }
  };

  const addPhoto = () => {
    setError(null);
    if (Platform.OS === "web") {
      pickFrom(false);
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Take Photo", "Choose from Gallery", "Cancel"], cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) pickFrom(true);
          else if (index === 1) pickFrom(false);
        }
      );
      return;
    }
    Alert.alert("Add a photo", undefined, [
      { text: "Take Photo", onPress: () => pickFrom(true) },
      { text: "Choose from Gallery", onPress: () => pickFrom(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const share = async () => {
    if (!token) {
      setError("Please sign in again.");
      return;
    }
    const body = text.trim();
    if (!body) {
      setError("Write something to share.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let photoKey: string | null = null;
      if (photoUri) {
        photoKey = await uploadCommunityPhoto(photoUri, photoMime, token);
      }
      await createPost({ token, type, text: body, photoKey });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Could not share your post.");
      setSubmitting(false);
    }
  };

  return (
    <GradientBackground>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.topTitle}>New post</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 50}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>WHAT ARE YOU SHARING?</Text>
          <View style={styles.types}>
            {POST_TYPES.map((t) => {
              const active = t === type;
              const meta = POST_TYPE_META[t];
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                >
                  <Ionicons
                    name={meta.icon}
                    size={15}
                    color={active ? colors.onPrimaryStrong : colors.accentDark}
                  />
                  <Text style={[styles.typeText, active && styles.typeTextActive]}>{meta.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 22 }]}>YOUR MESSAGE</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Share an update, a win, a meal, or some encouragement..."
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={(v) => setText(v.slice(0, MAX_CHARS))}
            multiline
          />
          <Text style={styles.counter}>
            {text.length}/{MAX_CHARS}
          </Text>

          {photoUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: photoUri }} style={styles.preview} contentFit="cover" />
              <Pressable style={styles.removePhoto} onPress={() => { setPhotoUri(null); setPhotoMime(null); }}>
                <Ionicons name="close" size={18} color={colors.onPrimaryStrong} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.addPhoto} onPress={addPhoto}>
              <Ionicons name="image-outline" size={20} color={colors.accentDark} />
              <Text style={styles.addPhotoText}>Add a photo (optional)</Text>
            </Pressable>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={submitting ? "Sharing..." : "Share post"}
            onPress={share}
            loading={submitting}
            disabled={!text.trim()}
            style={{ marginTop: 22 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  label: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 2, color: colors.muted, marginBottom: 12 },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  typeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accentDark },
  typeTextActive: { color: colors.onPrimaryStrong },
  textArea: {
    minHeight: 150,
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 23,
    color: colors.foreground,
    textAlignVertical: "top",
  },
  counter: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, alignSelf: "flex-end", marginTop: 8 },
  addPhoto: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.accentBorderMd,
    backgroundColor: colors.accentTintFaint,
  },
  addPhotoText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.accentDark },
  previewWrap: { marginTop: 16, position: "relative" },
  preview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: colors.radiusLg,
    backgroundColor: colors.accentTintFaint,
  },
  removePhoto: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(74,46,51,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  error: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger, marginTop: 16, textAlign: "center" },
});
