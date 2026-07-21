import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { KeyboardFormToolbar } from "@/components/KeyboardFormToolbar";
import { useInsets } from "@/hooks/useInsets";
import { useAuth } from "@/contexts/AuthContext";
import { updateExercise } from "@/lib/exercises";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

const CATEGORIES = ["Pilates", "Yoga", "Strength", "HIIT", "Mobility", "Cardio"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export default function EditExercise() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const descriptionRef = useRef<TextInput>(null);
  const router = useRouter();
  const insets = useInsets();
  const { isAdmin, adminToken } = useAuth();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    description?: string;
    cues?: string;
    duration?: string;
    category?: string;
    level?: string;
  }>();

  const [title, setTitle] = useState(params.title ?? "");
  const [description, setDescription] = useState(params.description ?? "");
  const [cues, setCues] = useState(params.cues ?? "");
  const [duration, setDuration] = useState(params.duration ?? "");
  const [category, setCategory] = useState(
    params.category && CATEGORIES.includes(params.category) ? params.category : "Strength"
  );
  const [level, setLevel] = useState(
    params.level && LEVELS.includes(params.level) ? params.level : "Beginner"
  );
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return (
      <GradientBackground>
        <View style={styles.guard}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.mutedForeground} />
          <Text style={styles.guardTitle}>Admins only</Text>
          <Text style={styles.guardText}>This area is reserved for the Shape admin account.</Text>
          <Button label="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: 20, width: 200 }} />
        </View>
      </GradientBackground>
    );
  }

  const save = async () => {
    if (!params.id) return;
    if (!title.trim()) {
      haptics.warning();
      notify("Title required", "Give this exercise a title.");
      return;
    }
    setBusy(true);
    try {
      await updateExercise({
        id: params.id,
        title: title.trim(),
        description: description.trim(),
        cues: cues.trim(),
        category,
        level,
        duration: duration.trim(),
        token: adminToken ?? "",
      });
      if (Platform.OS !== "web") Alert.alert("Saved", "Members will see the updated details.");
      router.back();
    } catch (e: any) {
      haptics.warning();
      notify("Save failed", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GradientBackground>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={96}
      >
        <Header onBack={() => router.back()} />

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Single Leg Glute Bridge"
          placeholderTextColor={colors.mutedForeground}
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
          onSubmitEditing={() => descriptionRef.current?.focus()}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          ref={descriptionRef}
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
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              style={[styles.chip, category === c && styles.chipOn]}
              onPress={() => {
                if (category === c) return;
                haptics.selection();
                setCategory(c);
              }}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Level</Text>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <Pressable
              key={l}
              style={[styles.chip, level === l && styles.chipOn]}
              onPress={() => {
                if (level === l) return;
                haptics.selection();
                setLevel(l);
              }}
            >
              <Text style={[styles.chipText, level === l && styles.chipTextOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.hint}>
          The video and poster stay as they are. Only these details change for all members.
        </Text>

        <Pressable style={[styles.submit, busy && { opacity: 0.7 }]} onPress={save} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.onPrimaryStrong} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.onPrimaryStrong} />
              <Text style={styles.submitText}>Save Changes</Text>
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollView>
      <KeyboardFormToolbar />
    </GradientBackground>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <PageHeader
      variant="compact"
      eyebrow="ADMIN"
      title="Edit"
      accent="Details"
      style={styles.header}
      leading={
        <Pressable style={styles.roundBtn} onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
      }
    />
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
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 18 },
  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: colors.radius,
    paddingVertical: 16,
    marginTop: 24,
  },
  submitText: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.onPrimaryStrong },
  guard: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  guardTitle: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground, marginTop: 8 },
  guardText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center" },
});
