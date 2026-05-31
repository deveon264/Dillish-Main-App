import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform, ActivityIndicator, TextInput, Modal } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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

type LogTab = "photo" | "text" | "scan";

export default function Calories() {
  const insets = useInsets();
  const { profile, calorieLogs, addCalorie, deleteCalorie } = useData();
  const [image, setImage] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<LogTab>("photo");
  const [qty, setQty] = useState(1);
  const [mealType, setMealType] = useState("Lunch");
  const [mealMenu, setMealMenu] = useState(false);
  const [mName, setMName] = useState("");
  const [mKcal, setMKcal] = useState("");
  const [mProtein, setMProtein] = useState("");
  const [mCarbs, setMCarbs] = useState("");
  const [mFats, setMFats] = useState("");

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

  const now = new Date();
  const dateStr = `${now.toLocaleDateString("en-US", { weekday: "short" })}, ${now.getDate()} ${now.toLocaleDateString("en-US", { month: "short" })}`;

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
    setQty(1);
    setMealMenu(false);
  };

  const save = async () => {
    if (!result) return;
    await addCalorie({
      name: result.name,
      kcal: result.kcal * qty,
      protein: result.protein * qty,
      carbs: result.carbs * qty,
      fats: result.fats * qty,
      photoUri: image ?? undefined,
      mealType,
    });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reset();
  };

  const saveManual = async () => {
    const kcal = parseInt(mKcal, 10);
    if (!mName.trim() || !kcal || kcal <= 0) {
      setError("Add a name and calories to log a meal.");
      return;
    }
    setError(null);
    await addCalorie({
      name: mName.trim(),
      kcal,
      protein: parseInt(mProtein, 10) || 0,
      carbs: parseInt(mCarbs, 10) || 0,
      fats: parseInt(mFats, 10) || 0,
    });
    setMName("");
    setMKcal("");
    setMProtein("");
    setMCarbs("");
    setMFats("");
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const kcalPct = Math.min(1, totals.kcal / profile.calorieGoal);
  const remaining = Math.max(0, profile.calorieGoal - totals.kcal);

  const TABS: { key: LogTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "photo", label: "Photo", icon: "camera-outline" },
    { key: "text", label: "Text", icon: "create-outline" },
    { key: "scan", label: "Scan", icon: "scan-outline" },
  ];

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>AI POWERED</Text>
            <Text style={styles.title}>
              Calorie <Text style={styles.titleItalic}>Tracker</Text>
            </Text>
          </View>
          <Pressable style={styles.headerBtn} hitSlop={6}>
            <Ionicons name="help" size={18} color={colors.muted} />
          </Pressable>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={colors.accent} />
          </View>
        </View>

        <Card style={styles.goalCard}>
          <View style={styles.goalHead}>
            <Text style={styles.cardEyebrow}>TODAY'S GOAL</Text>
            <View style={styles.dateChip}>
              <Ionicons name="calendar-outline" size={13} color={colors.muted} />
              <Text style={styles.dateText}>{dateStr}</Text>
            </View>
          </View>

          <View style={styles.goalMain}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigNum}>
                {totals.kcal.toLocaleString()}
                <Text style={styles.bigNumGoal}> / {profile.calorieGoal.toLocaleString()} kcal</Text>
              </Text>
              <Text style={styles.remaining}>{remaining.toLocaleString()} kcal remaining</Text>
            </View>
            <ProgressRing size={72} strokeWidth={7} progress={kcalPct}>
              <Text style={styles.ringPct}>{Math.round(kcalPct * 100)}%</Text>
            </ProgressRing>
          </View>

          <View style={styles.macros}>
            <Macro label="Protein" value={totals.protein} goal={goalProtein} color={colors.protein} />
            <Macro label="Carbs" value={totals.carbs} goal={goalCarbs} color={colors.carbs} />
            <Macro label="Fats" value={totals.fats} goal={goalFats} color={colors.fats} />
          </View>
        </Card>

        <Text style={styles.section}>LOG A MEAL</Text>
        <View style={styles.tabRow}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => {
                  setTab(t.key);
                  reset();
                }}
              >
                <Ionicons name={t.icon} size={16} color={active ? colors.onPrimary : colors.muted} />
                <Text style={[styles.tabLabel, { color: active ? colors.onPrimary : colors.muted }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {image ? (
          <Card style={{ marginTop: 14 }}>
            {!result ? <Image source={{ uri: image }} style={styles.preview} /> : null}
            {analyzing ? (
              <View style={styles.analyzing}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.analyzingText}>Analyzing your meal...</Text>
              </View>
            ) : result ? (
              <View style={styles.resultBox}>
                <View style={styles.heroWrap}>
                  <Image source={{ uri: image }} style={styles.heroImg} />
                  <LinearGradient
                    colors={["transparent", "rgba(20,15,14,0.82)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.aiBadge}>
                    <Ionicons name="sparkles" size={12} color={colors.onPrimary} />
                    <Text style={styles.aiBadgeText}>AI Detected</Text>
                  </View>
                  <View style={styles.heroText}>
                    <Text style={styles.heroTitle} numberOfLines={2}>{result.name}</Text>
                    <View style={styles.heroKcalRow}>
                      <Ionicons name="flame" size={15} color={colors.accent} />
                      <Text style={styles.heroKcal}>{result.kcal * qty} kcal</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.resultMacros}>
                  <ResultMacro label="Protein" value={result.protein * qty} />
                  <ResultMacro label="Carbs" value={result.carbs * qty} />
                  <ResultMacro label="Fats" value={result.fats * qty} />
                </View>

                <View style={styles.ctrlRow}>
                  <Pressable style={styles.mealSelect} onPress={() => setMealMenu(true)}>
                    <Text style={styles.mealSelectText}>{mealType}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.muted} />
                  </Pressable>
                  <View style={styles.qtyBox}>
                    <Pressable hitSlop={8} onPress={() => setQty((q) => Math.max(1, q - 1))}>
                      <Ionicons name="remove" size={18} color={colors.muted} />
                    </Pressable>
                    <Text style={styles.qtyText}>{qty}</Text>
                    <Pressable hitSlop={8} onPress={() => setQty((q) => Math.min(20, q + 1))}>
                      <Ionicons name="add" size={18} color={colors.accent} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.btnRow}>
                  <Pressable style={styles.retakeBtn} onPress={reset}>
                    <Ionicons name="refresh" size={16} color={colors.foreground} />
                    <Text style={styles.retakeText}>Retake</Text>
                  </Pressable>
                  <Pressable style={styles.logBtn} onPress={save}>
                    <LinearGradient
                      colors={colors.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.logBtnGrad}
                    >
                      <Ionicons name="add" size={18} color={colors.onPrimary} />
                      <Text style={styles.logBtnText}>Log This Meal</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={22} color={colors.primary} />
                <Text style={styles.errorText}>{error}</Text>
                <Button label="Try Again" variant="outline" onPress={reset} style={{ marginTop: 12 }} />
              </View>
            ) : null}
          </Card>
        ) : tab === "text" ? (
          <Card style={styles.textCard}>
            <Text style={styles.fieldLabel}>Meal name</Text>
            <TextInput
              value={mName}
              onChangeText={setMName}
              placeholder="e.g. Greek yogurt bowl"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>Calories</Text>
            <TextInput
              value={mKcal}
              onChangeText={setMKcal}
              placeholder="kcal"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              style={styles.input}
            />
            <View style={styles.macroInputs}>
              <View style={styles.macroInputCol}>
                <Text style={styles.fieldLabel}>Protein</Text>
                <TextInput value={mProtein} onChangeText={setMProtein} placeholder="g" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" style={styles.input} />
              </View>
              <View style={styles.macroInputCol}>
                <Text style={styles.fieldLabel}>Carbs</Text>
                <TextInput value={mCarbs} onChangeText={setMCarbs} placeholder="g" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" style={styles.input} />
              </View>
              <View style={styles.macroInputCol}>
                <Text style={styles.fieldLabel}>Fats</Text>
                <TextInput value={mFats} onChangeText={setMFats} placeholder="g" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" style={styles.input} />
              </View>
            </View>
            {error ? <Text style={styles.formError}>{error}</Text> : null}
            <Button label="Add to Diary" icon="add" onPress={saveManual} style={{ marginTop: 16 }} />
          </Card>
        ) : (
          <Pressable onPress={() => pickImage(tab === "photo" ? Platform.OS !== "web" : false)}>
            <Card style={styles.dropCard}>
              <View style={styles.dropInner}>
                <View style={styles.dropIcon}>
                  <Ionicons name={tab === "photo" ? "camera" : "scan"} size={26} color={colors.accent} />
                </View>
                <Text style={styles.dropTitle}>
                  {tab === "photo" ? "Tap to take a photo or upload" : "Tap to scan a meal photo"}
                </Text>
                <Text style={styles.dropDesc}>AI will recognize your food instantly</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {!image && error && tab !== "text" ? (
          <View style={styles.inlineError}>
            <Ionicons name="alert-circle" size={16} color={colors.primary} />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.diarySection}>Today's diary</Text>
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

      <Modal visible={mealMenu} transparent animationType="fade" onRequestClose={() => setMealMenu(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMealMenu(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Meal type</Text>
            {MEALS.map((m) => {
              const active = m === mealType;
              return (
                <Pressable
                  key={m}
                  style={styles.modalItem}
                  onPress={() => {
                    setMealType(m);
                    setMealMenu(false);
                  }}
                >
                  <Text style={[styles.modalItemText, active && styles.modalItemActive]}>{m}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </GradientBackground>
  );
}

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];

function Macro({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHead}>
        <View style={styles.macroLabelWrap}>
          <View style={[styles.macroDot, { backgroundColor: color }]} />
          <Text style={styles.macroLabel}>{label}</Text>
        </View>
        <Text style={styles.macroValue}>{value}g / {goal}g</Text>
      </View>
      <ProgressBar progress={goal ? value / goal : 0} color={color} height={6} style={{ marginTop: 6 }} />
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
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 2, color: colors.muted },
  title: { fontFamily: fonts.serif, fontSize: 32, color: colors.foreground, marginTop: 2 },
  titleItalic: { fontFamily: fonts.serifItalic, color: colors.accent },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(242,212,204,0.12)",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  goalCard: { marginTop: 20, padding: 20 },
  goalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardEyebrow: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 1.5, color: colors.muted },
  dateChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },
  goalMain: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  bigNum: { fontFamily: fonts.serifSemibold, fontSize: 40, color: colors.foreground },
  bigNumGoal: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted },
  remaining: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 4 },
  ringPct: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  macros: { gap: 14, marginTop: 22 },
  macroRow: {},
  macroHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  macroLabelWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  macroValue: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  section: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 1.5, color: colors.muted, marginTop: 28, marginBottom: 12 },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  tabActive: { backgroundColor: colors.accent },
  tabLabel: { fontFamily: fonts.sansSemibold, fontSize: 13.5 },
  dropCard: { marginTop: 14, paddingVertical: 36, borderStyle: "dashed", borderWidth: 1.5, borderColor: "rgba(242,212,204,0.30)" },
  dropInner: { alignItems: "center" },
  dropIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(242,212,204,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  dropTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  dropDesc: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 6 },
  textCard: { marginTop: 14, padding: 18 },
  fieldLabel: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
  },
  macroInputs: { flexDirection: "row", gap: 10 },
  macroInputCol: { flex: 1 },
  formError: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary, marginTop: 12 },
  preview: { width: "100%", height: 200, borderRadius: colors.radius, marginBottom: 8 },
  analyzing: { alignItems: "center", paddingVertical: 20, gap: 12 },
  analyzingText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.muted },
  resultBox: { paddingTop: 2 },
  heroWrap: { height: 188, borderRadius: colors.radius, overflow: "hidden", justifyContent: "center" },
  heroImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  aiBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  aiBadgeText: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.onPrimary },
  heroText: { position: "absolute", right: 16, left: 16, bottom: 16, alignItems: "flex-end" },
  heroTitle: { fontFamily: fonts.serifSemibold, fontSize: 24, color: "#FFFFFF", textAlign: "right" },
  heroKcalRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  heroKcal: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.accent },
  resultMacros: { flexDirection: "row", gap: 12, marginTop: 14 },
  rMacro: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 14,
  },
  rMacroVal: { fontFamily: fonts.sansSemibold, fontSize: 20, color: colors.foreground },
  rMacroLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 3 },
  ctrlRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  mealSelect: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mealSelectText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.foreground },
  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  qtyText: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground, minWidth: 16, textAlign: "center" },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  retakeText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.foreground },
  logBtn: { flex: 1, borderRadius: 14, overflow: "hidden" },
  logBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
  },
  logBtnText: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.onPrimary },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(20,15,14,0.6)", justifyContent: "center", paddingHorizontal: 40 },
  modalSheet: {
    backgroundColor: "#2C2422",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 12,
  },
  modalTitle: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.muted, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8 },
  modalItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12 },
  modalItemText: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.foreground },
  modalItemActive: { color: colors.accent, fontFamily: fonts.sansSemibold },
  errorBox: { alignItems: "center", paddingVertical: 16 },
  errorText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 8 },
  inlineError: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  inlineErrorText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground, flex: 1 },
  diarySection: { fontFamily: fonts.serif, fontSize: 22, color: colors.foreground, marginTop: 28, marginBottom: 14 },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: 10 },
  logRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  logThumb: { width: 48, height: 48, borderRadius: 12 },
  logThumbFallback: { backgroundColor: "rgba(242,212,204,0.10)", alignItems: "center", justifyContent: "center" },
  logName: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  logMacro: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  logKcal: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.accent },
  logDelete: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
});
