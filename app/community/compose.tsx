import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
  ActionSheetIOS,
  Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { FormSkeleton } from "@/components/LoadingSkeletons";
import { POST_TYPE_META } from "@/components/community/postTypes";
import { useAuth } from "@/contexts/AuthContext";
import { useInsets } from "@/hooks/useInsets";
import { notify } from "@/lib/confirm";
import {
  communityPhotoUri,
  createPost,
  fetchPost,
  updatePost,
  uploadCommunityPhoto,
  POST_TYPES,
  type PostType,
} from "@/lib/community";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

const MAX_CHARS = 2000;
const MAX_PHOTOS = 4;

type PickedPhoto = { uri: string; mime: string | null; key: string | null; isNew: boolean };

export default function Compose() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();
  const router = useRouter();
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [type, setType] = useState<PostType>("progress");
  const [text, setText] = useState("");
  // The images attached to the post, in display order (up to MAX_PHOTOS). Each
  // entry is either an already-stored image (`key` set, `isNew:false`) or a
  // freshly picked local file (local `uri`, `isNew:true`) uploaded on save.
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In edit mode, load the post once and prefill the form.
  useEffect(() => {
    if (!isEdit || !token || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const post = await fetchPost({ token, id });
        if (cancelled) return;
        setType(post.type);
        setText(post.body);
        setPhotos(
          (post.photoKeys ?? []).map((key) => ({
            uri: communityPhotoUri(key),
            mime: null,
            key,
            isNew: false,
          }))
        );
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Could not load this post.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, token, id]);

  const pickFrom = async (fromCamera: boolean) => {
    setError(null);
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        haptics.warning();
        setError("Permission is required to add a photo.");
        return;
      }
      // Camera adds one shot at a time (and can crop); the library allows
      // selecting several at once, up to the remaining slots. `allowsEditing`
      // and multi-selection can't be combined, so only the camera crops.
      const opts: ImagePicker.ImagePickerOptions = fromCamera
        ? { mediaTypes: ["images"], quality: 0.7, allowsEditing: true }
        : { mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: true, selectionLimit: remaining };
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.length) return;
      const picked: PickedPhoto[] = res.assets
        .slice(0, remaining)
        .map((a) => ({ uri: a.uri, mime: a.mimeType ?? null, key: null, isNew: true }));
      setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
    } catch {
      haptics.warning();
      setError("Unable to open the camera or library on this device.");
    }
  };

  const addPhoto = () => {
    setError(null);
    if (photos.length >= MAX_PHOTOS) return;
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

  const removeAt = (index: number) => {
    haptics.warning();
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!token) {
      haptics.warning();
      setError("Please sign in again.");
      return;
    }
    const body = text.trim();
    if (!body) {
      haptics.warning();
      setError("Write something to share.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Upload any freshly picked images, keeping display order; existing images
      // pass through their stored key. Promise.all preserves index order.
      const photoKeys = await Promise.all(
        photos.map((p) => (p.isNew ? uploadCommunityPhoto(p.uri, p.mime, token) : Promise.resolve(p.key!)))
      );
      if (isEdit && id) {
        await updatePost({ token, id, type, text: body, photoKeys });
      } else {
        await createPost({ token, type, text: body, photoKeys });
      }
      router.back();
    } catch (e: any) {
      haptics.warning();
      setError(e?.message ?? (isEdit ? "Could not save your changes." : "Could not share your post."));
      setSubmitting(false);
    }
  };

  return (
    <GradientBackground>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.topTitle}>{isEdit ? "Edit post" : "New post"}</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <FormSkeleton />
      ) : (
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bottomOffset={96}
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
                    onPress={() => {
                      if (active) return;
                      haptics.selection();
                      setType(t);
                    }}
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

            {photos.length === 0 ? (
              <Pressable style={styles.addPhoto} onPress={addPhoto}>
                <Ionicons name="image-outline" size={20} color={colors.accentDark} />
                <Text style={styles.addPhotoText}>Add photos (optional)</Text>
              </Pressable>
            ) : (
              <View style={styles.photoGrid}>
                {photos.map((p, i) => (
                  <View key={`${p.uri}-${i}`} style={styles.thumbWrap}>
                    <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
                    <Pressable style={styles.removePhoto} onPress={() => removeAt(i)} hitSlop={6}>
                      <Ionicons name="close" size={16} color={colors.onPrimaryStrong} />
                    </Pressable>
                  </View>
                ))}
                {photos.length < MAX_PHOTOS ? (
                  <Pressable style={[styles.thumbWrap, styles.addTile]} onPress={addPhoto}>
                    <Ionicons name="add" size={26} color={colors.accentDark} />
                    <Text style={styles.addTileText}>Add more</Text>
                    <Text style={styles.addTileHint}>{MAX_PHOTOS - photos.length} left</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              label={
                submitting
                  ? isEdit
                    ? "Saving..."
                    : "Sharing..."
                  : isEdit
                    ? "Save changes"
                    : "Share post"
              }
              onPress={submit}
              loading={submitting}
              disabled={!text.trim()}
              style={{ marginTop: 22 }}
            />
        </KeyboardAwareScrollView>
      )}
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  thumbWrap: {
    width: "47.8%",
    aspectRatio: 1,
    borderRadius: colors.radiusSm,
    overflow: "hidden",
    backgroundColor: colors.accentTintFaint,
    position: "relative",
  },
  thumb: { width: "100%", height: "100%" },
  addTile: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.accentBorderMd,
    backgroundColor: colors.accentTintFaint,
  },
  addTileText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accentDark },
  addTileHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
  removePhoto: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(74,46,51,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  error: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger, marginTop: 16, textAlign: "center" },
});
