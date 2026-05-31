import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ProgressRing } from "@/components/ProgressRing";
import { ProgressBar } from "@/components/ProgressBar";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { getApiUrl } from "@/lib/api";
import { todayKey } from "@/lib/storage";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

type AnalysisResult = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
};

export default function Calories() {
  const insets = useInsets();
  const { profile, calorieLogs, addCalorie, deleteCalorie } = useData();
  const [image, setImage] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tk = todayKey();
  const todayLogs = useMemo(() => calorieLogs.filter((l) => todayKey(new Date(l.ts)) === tk), [calorieLogs, tk]);
  const totals = useMemo(() => {
    return todayLogs.reduce(
      (acc, l) => ({
        kcal: acc.kcal + l.kcal,
        protein: acc.protein + l.protein,
        carbs: acc.carbs + l.carbs,
        fats: acc.fats + l.fats,
      }),
      { kcal: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }, [todayLogs]);

  const goalProtein = Math.round((profile.calorieGoal * 0.3) / 4);
  const goalCarbs = Math.round((profile.calorieGoal * 0.4) / 4);
  const goalFats = Math.round((profile.calorieGoal * 0.3) / 9);

  const pickImage = async (fromCamera: boolean) => {
    setError(null);
    setResult(null);
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Permission is required to access your photos.");
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.6,
        base64: true,
        allowsEditing: true,
      };
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setImage(asset.uri);
      if (asset.base64) {
        setBase64(asset.base64);
        analyze(asset.base64);
      } else {
        setError("Could not read the image. Please try another.");
      }
    } catch {
      setError("Unable to open the camera or library on this device.");
    }
  };

  const analyze = async (b64: string) => {
    setAnalyzing(true);
    setError(null);
    try {
      const url = `${getApiUrl()}/api/analyze`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64 }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "Analysis failed");
      }
      const data = (await resp.json()) as AnalysisResult;
      setResult(data);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.message?.includes("API") ? "AI service is not configured yet." : "Could not analyze the image. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setBase64(null);
    setResult(null);
    setError(null);
  };

  const save = async () => {
    if (!result) return;
    await addCalorie({
      name: result.name,
      kcal: result.kcal,
      protein: result.protein,
      carbs: result.carbs,
      fats: result.fats,
      photoUri: image ?? undefined,
    });
    reset();
  };

  const kcalPct = Math.min(1, totals.kcal / profile.calorieGoal);

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>AI Nutrition</Text>
        <Text style={styles.subtitle}>Snap your meal, we'll do the math.</Text>

        <Card style={styles.summary}>
          <ProgressRing size={104} strokeWidth={9} progress={kcalPct}>
            <Text style={styles.ringValue}>{totals.kcal}</Text>
            <Text style={styles.ringLabel}>/ {profile.calorieGoal}</Text>
          </ProgressRing>
          <View style={styles.macros}>
            <Macro label="Protein" value={totals.protein} goal={goalProtein} color={colors.protein} />
            <Macro label="Carbs" value={totals.carbs} goal={goalCarbs} color={colors.carbs} />
            <Macro label="Fats" value={totals.fats} goal={goalFats} color={colors.fats} />
          </View>
        </Card>

        {!image ? (
          <Card style={styles.scanCard}>
            <View style={styles.scanIcon}>
              <Ionicons name="sparkles" size={28} color={colors.accent} />
            </View>
            <Text style={styles.scanTitle}>Track with a photo</Text>
            <Text style={styles.scanDesc}>
              Take or upload a picture of your meal and our AI estimates calories and macros instantly.
            </Text>
            <Button label="Take Photo" icon="camera-outline" onPress={() => pickImage(true)} style={{ marginTop: 18 }} />
            <Button label="Upload Photo" icon="image-outline" variant="outline" onPress={() => pickImage(false)} style={{ marginTop: 10 }} />
          </Card>
        ) : (
          <Card style={{ marginTop: 22 }}>
            <Image source={{ uri: image }} style={styles.preview} />
            {analyzing ? (
              <View style={styles.analyzing}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.analyzingText}>Analyzing your meal...</Text>
              </View>
            ) : result ? (
              <View style={styles.resultBox}>
                <Text style={styles.resultName}>{result.name}</Text>
                <View style={styles.resultKcalRow}>
                  <Ionicons name="flame-outline" size={18} color={colors.accent} />
                  <Text style={styles.resultKcal}>{result.kcal} kcal</Text>
                </View>
                <View style={styles.resultMacros}>
                  <ResultMacro label="Protein" value={result.protein} />
                  <ResultMacro label="Carbs" value={result.carbs} />
                  <ResultMacro label="Fats" value={result.fats} />
                </View>
                <Button label="Add to Diary" icon="add" onPress={save} style={{ marginTop: 16 }} />
                <Button label="Retake" variant="ghost" onPress={reset} style={{ marginTop: 4 }} />
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={22} color={colors.primary} />
                <Text style={styles.errorText}>{error}</Text>
                <Button label="Try Again" variant="outline" onPress={reset} style={{ marginTop: 12 }} />
              </View>
            ) : null}
          </Card>
        )}

        {!image && error ? (
          <View style={styles.inlineError}>
            <Ionicons name="alert-circle" size={16} color={colors.primary} />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.section}>Today's diary</Text>
        {todayLogs.length === 0 ? (
          <Card style={{ alignItems: "center", paddingVertical: 28 }}>
            <Ionicons name="restaurant-outline" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No meals logged yet today</Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {todayLogs.map((l) => (
              <Card key={l.id} style={styles.logRow}>
                {l.photoUri ? (
                  <Image source={{ uri: l.photoUri }} style={styles.logThumb} />
                ) : (
                  <View style={[styles.logThumb, styles.logThumbFallback]}>
                    <Ionicons name="restaurant-outline" size={18} color={colors.accent} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.logName} numberOfLines={1}>{l.name}</Text>
                  <Text style={styles.logMacro}>P {l.protein}g · C {l.carbs}g · F {l.fats}g</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.logKcal}>{l.kcal}</Text>
                  <Pressable onPress={() => deleteCalorie(l.id)} hitSlop={8}>
                    <Text style={styles.logDelete}>Remove</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

function Macro({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHead}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>{value}/{goal}g</Text>
      </View>
      <ProgressBar progress={goal ? value / goal : 0} color={color} height={6} style={{ marginTop: 5 }} />
    </View>
  );
}

function ResultMacro({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.rMacro}>
      <Text style={styles.rMacroVal}>{value}g</Text>
      <Text style={styles.rMacroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  title: { fontFamily: fonts.serif, fontSize: 36, color: colors.foreground },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 4 },
  summary: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 20 },
  ringValue: { fontFamily: fonts.serifSemibold, fontSize: 26, color: colors.foreground },
  ringLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: -2 },
  macros: { flex: 1, gap: 12 },
  macroRow: {},
  macroHead: { flexDirection: "row", justifyContent: "space-between" },
  macroLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  macroValue: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  scanCard: { alignItems: "center", marginTop: 22, paddingVertical: 26 },
  scanIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "rgba(242,212,204,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  scanTitle: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
  scanDesc: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 8, lineHeight: 21, paddingHorizontal: 10 },
  preview: { width: "100%", height: 200, borderRadius: colors.radius, marginBottom: 8 },
  analyzing: { alignItems: "center", paddingVertical: 20, gap: 12 },
  analyzingText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.muted },
  resultBox: { paddingTop: 8 },
  resultName: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground },
  resultKcalRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  resultKcal: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.accent },
  resultMacros: { flexDirection: "row", gap: 12, marginTop: 16 },
  rMacro: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.cardElevated,
    borderRadius: 14,
    paddingVertical: 12,
  },
  rMacroVal: { fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.foreground },
  rMacroLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  errorBox: { alignItems: "center", paddingVertical: 16 },
  errorText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 8 },
  inlineError: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  inlineErrorText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground, flex: 1 },
  section: { fontFamily: fonts.serif, fontSize: 22, color: colors.foreground, marginTop: 28, marginBottom: 14 },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: 10 },
  logRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  logThumb: { width: 48, height: 48, borderRadius: 12 },
  logThumbFallback: { backgroundColor: "rgba(242,212,204,0.10)", alignItems: "center", justifyContent: "center" },
  logName: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  logMacro: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  logKcal: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.accent },
  logDelete: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
});
