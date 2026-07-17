import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable as StructuralPressable, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Easing, TextInput, Modal, ActionSheetIOS, Alert } from "react-native";
import { KeyboardAwareScrollView, KeyboardGestureArea } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from "expo-audio";
import { readAsStringAsync } from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { GradientBackground } from "@/components/GradientBackground";
import { useScrollDecor } from "@/components/BackgroundDecor";
import { AnalyzingCard } from "@/components/trackers/AnalyzingCard";
import { MotionListItem } from "@/components/Motion";
import { useDataRefresh } from "@/hooks/useDataRefresh";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { SectionLabel } from "@/components/PageHeader";
import { ProgressRing } from "@/components/ProgressRing";
import { useData, type CalorieLog } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { getApiUrl } from "@/lib/api";
import { rehostStockPhoto } from "@/lib/mealPhotos";
import { addMealWithBackgroundPhoto } from "@/lib/optimisticMeal";
import { todayKey } from "@/lib/storage";
import { getCalorieInsight, type InsightChip } from "@/lib/calorieInsights";
import { CalorieInsightBody, insightMacroColor, type InsightBodyComponents } from "@/components/trackers/CalorieInsightCard";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

type AnalysisResult = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  portion?: string;
  photoUrl?: string;
};

type LogTab = "photo" | "text" | "voice";
const MAX_VISIBLE_LOGS = 5;
const MEAL_TEXT_INPUT_ID = "meal-text-input";

function MealTextGestureArea({ children }: { children: React.ReactNode }) {
  if (Platform.OS === "web") return <>{children}</>;
  return (
    <KeyboardGestureArea
      enableSwipeToDismiss
      showOnSwipeUp={false}
      interpolator="ios"
      textInputNativeID={MEAL_TEXT_INPUT_ID}
    >
      {children}
    </KeyboardGestureArea>
  );
}

// Pull the specific message the analyze endpoint returned (it answers with
// {"error": "..."}) so the user sees what actually went wrong instead of a
// generic line. Falls back to a passed-in default if the body has no message.
async function extractAnalyzeError(resp: Response, fallback: string): Promise<string> {
  try {
    const data = (await resp.json()) as { error?: string };
    if (data && typeof data.error === "string" && data.error.trim()) {
      return data.error.trim();
    }
  } catch {
    // Non-JSON body: fall through to the default message.
  }
  return fallback;
}

// Turns a thrown error into a user-facing line. A failed fetch (no network)
// surfaces a connection message; a server-provided message is shown as-is.
function toAnalyzeMessage(e: any, fallback: string): string {
  const msg = typeof e?.message === "string" ? e.message.trim() : "";
  if (!msg) return fallback;
  if (/network|failed to fetch|load failed|timeout/i.test(msg)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return msg;
}

// Gentle placeholder shown in the meal hero while a stock photo is being
// fetched (text-logged meals). A soft opacity pulse plus a spinner makes the
// wait feel intentional rather than broken. On failure the hero falls back to
// the fork-and-knife icon (handled by the caller).
function PhotoShimmer() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.75,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.heroFallback}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.heroShimmer, { opacity: pulse }]} />
      <ActivityIndicator color="rgba(255,255,255,0.5)" />
    </View>
  );
}

export function CaloriesTracker({ header }: { header?: React.ReactNode }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();
  const router = useRouter();
  const { profile, calorieLogs, addCalorie, updateCaloriePhoto, deleteCalorie } = useData();
  const { refreshControl, scrollRef } = useDataRefresh();
  // Petal texture embedded in the scroll content so it moves with the page.
  const { decor, onContentSizeChange } = useScrollDecor();
  const [image, setImage] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [base64, setBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  // True once the AI response has landed; lets the analyzing card show 100%
  // and the final stage tick before the result card swaps in.
  const [analyzeDone, setAnalyzeDone] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<LogTab | null>(null);
  const [qty, setQty] = useState(1);
  const [mealType, setMealType] = useState("Lunch");
  const [mealMenu, setMealMenu] = useState(false);
  // "Not quite right?" correction on photo results: re-analyzes the same
  // photo with the user's typed identity (e.g. "droewors").
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionText, setCorrectionText] = useState("");
  const [mealText, setMealText] = useState("");
  const mealTextInputRef = useRef<TextInput>(null);
  // Voice logging: idle -> recording -> transcribing, then the transcript is
  // handed to analyzeText and the shared analyzing/result states take over.
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing">("idle");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [saving, setSaving] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<CalorieLog | null>(null);
  const [showAllTodayLogs, setShowAllTodayLogs] = useState(false);
  // Tapped AI-insight food chip, plus its looked-up stock photo.
  const [foodDetail, setFoodDetail] = useState<InsightChip | null>(null);
  const [foodPhotoUrl, setFoodPhotoUrl] = useState<string | null>(null);
  const [foodPhotoLoading, setFoodPhotoLoading] = useState(false);
  const foodPhotoCache = useRef<Record<string, string>>({});
  // Name of the food whose detail modal is currently open, so a slow photo
  // fetch for a previously-tapped chip can't overwrite the current one.
  const openFoodNameRef = useRef<string | null>(null);

  const tk = todayKey();
  const todayLogs = useMemo(() => calorieLogs.filter((l) => todayKey(new Date(l.ts)) === tk), [calorieLogs, tk]);
  const canExpandTodayLogs = todayLogs.length > MAX_VISIBLE_LOGS;
  const visibleTodayLogs = showAllTodayLogs ? todayLogs : todayLogs.slice(0, MAX_VISIBLE_LOGS);
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

  const insight = useMemo(
    () =>
      getCalorieInsight({
        totals,
        goals: {
          kcal: profile.calorieGoal,
          protein: goalProtein,
          carbs: goalCarbs,
          fats: goalFats,
        },
      }),
    [totals, profile.calorieGoal, goalProtein, goalCarbs, goalFats]
  );
  const insightColor = insightMacroColor(insight.featuredMacro, colors);
  const INSIGHT_COMPONENTS = useMemo(() => insightComponents(styles), [styles]);

  const week = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const mondayOffset = (base.getDay() + 6) % 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - mondayOffset);
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const todayMs = base.getTime();
    const days = labels.map((label, i) => {
      const start = new Date(monday);
      start.setDate(monday.getDate() + i);
      const startMs = start.getTime();
      const endMs = startMs + 86400000;
      const total = calorieLogs
        .filter((l) => l.ts >= startMs && l.ts < endMs)
        .reduce((a, l) => a + l.kcal, 0);
      return { label, total, isToday: startMs === todayMs };
    });
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
    const range =
      monday.getMonth() === sunday.getMonth()
        ? `${mShort(monday)} ${monday.getDate()} – ${sunday.getDate()}`
        : `${mShort(monday)} ${monday.getDate()} – ${mShort(sunday)} ${sunday.getDate()}`;
    return { days, range };
  }, [calorieLogs]);

  const now = new Date();
  const dateStr = `${now.toLocaleDateString("en-US", { weekday: "short" })}, ${now.getDate()} ${now.toLocaleDateString("en-US", { month: "short" })}`;

  const heroUri = image ?? photoUrl;

  // Keep the loading placeholder up until the <Image> bytes finish downloading.
  // Whenever the hero URI changes we reset to a loading state; the Image's own
  // onLoad/onError callbacks then clear it (or surface the fork/knife fallback).
  useEffect(() => {
    if (heroUri) {
      setImgLoading(true);
      setImgError(false);
    }
  }, [heroUri]);

  const pickImage = async (fromCamera: boolean) => {
    setError(null);
    setResult(null);
    setPhotoUrl(null);
    setPhotoLoading(false);
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Permission is required to access your photos.");
        haptics.warning();
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
        haptics.warning();
      }
    } catch {
      setError("Unable to open the camera or library on this device.");
      haptics.warning();
    }
  };

  const choosePhotoSource = () => {
    if (Platform.OS === "web") {
      pickImage(false);
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Take Photo", "Choose from Library", "Cancel"],
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) pickImage(true);
          else if (index === 1) pickImage(false);
        }
      );
      return;
    }
    Alert.alert("Add a meal photo", "Take a new photo or choose one from your library.", [
      { text: "Take Photo", onPress: () => pickImage(true) },
      { text: "Choose from Library", onPress: () => pickImage(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // Brief hold at 100% so the analyzing card's final tick is visible before
  // the result card replaces it.
  const ANALYZE_DONE_HOLD_MS = 450;
  const holdAtComplete = () => new Promise((r) => setTimeout(r, ANALYZE_DONE_HOLD_MS));

  const analyze = async (b64: string, hint?: string) => {
    setAnalyzing(true);
    setError(null);
    try {
      const url = `${getApiUrl()}/api/analyze`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hint ? { image: b64, text: hint } : { image: b64 }),
      });
      if (!resp.ok) {
        throw new Error(await extractAnalyzeError(resp, "Could not analyze the image. Please try again."));
      }
      const data = (await resp.json()) as AnalysisResult;
      setAnalyzeDone(true);
      await holdAtComplete();
      setResult(data);
    } catch (e: any) {
      setError(toAnalyzeMessage(e, "Could not analyze the image. Please try again."));
      haptics.warning();
    } finally {
      setAnalyzing(false);
      setAnalyzeDone(false);
    }
  };

  const submitCorrection = () => {
    const hint = correctionText.trim();
    if (!hint || !base64) return;
    setCorrectionOpen(false);
    haptics.selection();
    // Clear the result so the staged analyzing card shows during the re-run.
    setResult(null);
    analyze(base64, hint);
  };

  const fetchFoodPhoto = async (name: string, text?: string) => {
    setPhotoLoading(true);
    try {
      const resp = await fetch(`${getApiUrl()}/api/food-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text }),
      });
      if (!resp.ok) return;
      const { photoUrl: url } = (await resp.json()) as { photoUrl: string | null };
      if (url) setPhotoUrl(url);
    } catch {
      // Silent: the hero keeps its fork-and-knife fallback.
    } finally {
      setPhotoLoading(false);
    }
  };

  // Open the food-idea detail popup and look up a stock photo for it by name
  // (reusing the /api/food-photo endpoint). Cached per name; falls back to the
  // chip's icon when offline or no photo is found.
  const openFoodDetail = async (chip: InsightChip) => {
    setFoodDetail(chip);
    openFoodNameRef.current = chip.name;
    const cached = foodPhotoCache.current[chip.name];
    if (cached) {
      setFoodPhotoUrl(cached);
      setFoodPhotoLoading(false);
      return;
    }
    setFoodPhotoUrl(null);
    setFoodPhotoLoading(true);
    try {
      const resp = await fetch(`${getApiUrl()}/api/food-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: chip.name }),
      });
      if (!resp.ok) return;
      const { photoUrl: url } = (await resp.json()) as { photoUrl: string | null };
      if (url) {
        foodPhotoCache.current[chip.name] = url;
        if (openFoodNameRef.current === chip.name) setFoodPhotoUrl(url);
      }
    } catch {
      // Offline / no key: the hero keeps its icon fallback.
    } finally {
      if (openFoodNameRef.current === chip.name) setFoodPhotoLoading(false);
    }
  };

  const closeFoodDetail = () => {
    openFoodNameRef.current = null;
    setFoodDetail(null);
    setFoodPhotoUrl(null);
    setFoodPhotoLoading(false);
  };

  const reset = () => {
    setImage(null);
    setPhotoUrl(null);
    setPhotoLoading(false);
    setBase64(null);
    setResult(null);
    setError(null);
    setQty(1);
    setMealMenu(false);
    setCorrectionOpen(false);
    setCorrectionText("");
    // Abandon any in-flight recording (e.g. the member switched tabs mid-take).
    if (voiceState === "recording") {
      recorder.stop().catch(() => {});
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
    setVoiceState("idle");
  };

  const startTextLogging = () => {
    setTab("text");
    requestAnimationFrame(() => mealTextInputRef.current?.focus());
  };

  const save = async () => {
    if (!result || saving) return;
    setSaving(true);
    try {
      // Device photos are already durable. Stock photos are inserted as their
      // current URL immediately, then re-hosted after the local diary write so
      // network latency never holds the logged meal or its counters hostage.
      await addMealWithBackgroundPhoto({
        entry: {
          name: result.name,
          kcal: result.kcal * qty,
          protein: result.protein * qty,
          carbs: result.carbs * qty,
          fats: result.fats * qty,
          photoUri: image ?? undefined,
          mealType,
        },
        stockPhotoUrl: image ? null : photoUrl,
        addCalorie,
        updateCaloriePhoto,
        rehostPhoto: rehostStockPhoto,
      });
      haptics.success();
      reset();
    } catch (e: any) {
      // The save only resolves once the log is durably written to storage; if
      // that fails, keep the result on screen so the user can retry instead of
      // silently losing the meal.
      haptics.warning();
      Alert.alert("Couldn't save meal", e?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const analyzeText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Describe your meal to analyze.");
      return;
    }
    setMealText(trimmed);
    setImage(null);
    setPhotoUrl(null);
    setBase64(null);
    setResult(null);
    setAnalyzing(true);
    setError(null);
    try {
      const url = `${getApiUrl()}/api/analyze`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!resp.ok) {
        throw new Error(await extractAnalyzeError(resp, "Could not analyze that meal. Please try again."));
      }
      const data = (await resp.json()) as AnalysisResult;
      setAnalyzeDone(true);
      await holdAtComplete();
      setResult(data);
      // Fetch a matching stock photo in the background so it never blocks the
      // nutrition result. On no result or any error the hero falls back to the
      // fork-and-knife icon.
      fetchFoodPhoto(data.name, trimmed);
    } catch (e: any) {
      setError(toAnalyzeMessage(e, "Could not analyze that meal. Please try again."));
      haptics.warning();
    } finally {
      setAnalyzing(false);
      setAnalyzeDone(false);
    }
  };

  const startVoice = async () => {
    setError(null);
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError("Microphone permission is required to log meals by voice.");
      haptics.warning();
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setVoiceState("recording");
      haptics.selection();
    } catch {
      setError("Could not start recording. Please try again.");
      haptics.warning();
    }
  };

  const stopVoice = async () => {
    setVoiceState("transcribing");
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) throw new Error("No recording captured. Please try again.");
      const b64 = await readAsStringAsync(uri, { encoding: "base64" });
      const resp = await fetch(`${getApiUrl()}/api/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Web records webm/opus; native records m4a. The server names the file
        // accordingly so the transcription provider sniffs the right codec.
        body: JSON.stringify({ audio: b64, format: Platform.OS === "web" ? "webm" : "m4a" }),
      });
      if (!resp.ok) {
        throw new Error(await extractAnalyzeError(resp, "Could not transcribe the recording. Please try again."));
      }
      const data = (await resp.json()) as { text?: string };
      const transcript = data.text?.trim();
      if (!transcript) throw new Error("We couldn't hear a meal in that recording. Please try again.");
      setVoiceState("idle");
      await analyzeText(transcript);
    } catch (e: any) {
      setVoiceState("idle");
      setError(toAnalyzeMessage(e, "Could not transcribe the recording. Please try again."));
      haptics.warning();
    }
  };

  const kcalPct = Math.min(1, totals.kcal / profile.calorieGoal);
  const remaining = Math.max(0, profile.calorieGoal - totals.kcal);

  const TABS: { key: LogTab; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "photo", label: "Photo", sub: "AI recognizes it", icon: "camera-outline" },
    { key: "voice", label: "Voice", sub: "Say what you ate", icon: "mic-outline" },
    { key: "text", label: "Text", sub: "Type it in", icon: "create-outline" },
  ];

  const openLogFlow = (next: LogTab) => {
    reset();
    setTab(next);
    haptics.selection();
    if (next === "photo") {
      requestAnimationFrame(choosePhotoSource);
    } else if (next === "text") {
      requestAnimationFrame(() => mealTextInputRef.current?.focus());
    }
  };

  return (
    <GradientBackground showDecor={false}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 52) : insets.top) + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={110}
        refreshControl={refreshControl}
        onContentSizeChange={onContentSizeChange}
      >
        {decor}
        {header}

        <Card style={styles.polishGoalCard}>
          <View style={styles.polishGoalHead}>
            <Text style={styles.polishEyebrow}>TODAY&apos;S GOAL</Text>
            <Text style={styles.polishDate}>{dateStr}</Text>
          </View>

          <View style={styles.polishGoalMain}>
            <ProgressRing
              size={96}
              strokeWidth={9}
              progress={kcalPct}
              color={colors.primary}
              trackColor={colors.ringTrack}
              durationMs={600}
              gradientId="calorie-goal-polish"
            >
              <AnimatedNumber
                value={remaining}
                formatter={(n) => `~${Math.round(n).toLocaleString()}`}
                style={styles.polishRemaining}
              />
              <Text style={styles.polishRemainingLabel}>KCAL REMAINING</Text>
            </ProgressRing>
            <View style={styles.polishGoalDetails}>
              <Text style={styles.polishEatenLine}>
                <AnimatedNumber value={totals.kcal} formatter={(n) => `~${Math.round(n).toLocaleString()}`} style={styles.polishEatenStrong} /> eaten · goal {profile.calorieGoal.toLocaleString()}
              </Text>
              <View style={styles.polishGoalMacros}>
                <GoalMacro label="Protein" value={totals.protein} goal={goalProtein} />
                <GoalMacro label="Carbs" value={totals.carbs} goal={goalCarbs} />
                <GoalMacro label="Fats" value={totals.fats} goal={goalFats} />
              </View>
            </View>
          </View>

          <View style={styles.polishWeekZone}>
            <View style={styles.polishWeekHead}>
              <Text style={styles.polishWeekEyebrow}>THIS WEEK</Text>
              <Text style={styles.polishWeekRange}>{week.range}</Text>
            </View>
            <View style={styles.polishWeekBars}>
              {week.days.map((day) => {
                const ratio = profile.calorieGoal > 0 ? Math.min(1, day.total / profile.calorieGoal) : 0;
                const height = day.total > 0 ? Math.max(8, Math.round(ratio * 42)) : 3;
                return (
                  <View key={day.label} style={styles.polishWeekColumn}>
                    <View
                      style={[
                        styles.polishWeekBar,
                        { height },
                        day.total > 0 && styles.polishWeekBarLogged,
                        day.isToday && styles.polishWeekBarToday,
                      ]}
                    />
                    <Text style={[styles.polishWeekDay, day.isToday && styles.polishWeekDayToday]}>{day.label.slice(0, 1)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Card>

        <SectionLabel style={styles.polishLogSection}>LOG A MEAL</SectionLabel>
        <View style={styles.polishActionTiles}>
          {TABS.map((item) => {
            const photo = item.key === "photo";
            return (
              <Pressable
                key={item.key}
                motion="timing"
                pressedScale={0.95}
                style={[styles.polishActionTile, photo && styles.polishActionTilePrimary]}
                onPress={() => openLogFlow(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`Log a meal with ${item.label.toLowerCase()}`}
              >
                <Ionicons name={item.icon} size={21} color={photo ? colors.onPrimary : colors.accentDark} />
                <View style={styles.polishActionCopy}>
                  <Text style={[styles.polishActionTitle, photo && styles.polishActionTitlePrimary]}>{item.label}</Text>
                  <Text style={[styles.polishActionSub, photo && styles.polishActionSubPrimary]} numberOfLines={1}>{item.sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {result ? (
          <Card style={{ marginTop: 14 }}>
            <View style={styles.resultBox}>
              <View style={styles.heroWrap}>
                {heroUri && !imgError ? (
                  <>
                    <Image
                      source={{ uri: heroUri }}
                      style={styles.heroImg}
                      onLoadStart={() => setImgLoading(true)}
                      onLoad={() => setImgLoading(false)}
                      onError={() => {
                        setImgLoading(false);
                        setImgError(true);
                      }}
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(16,17,17,0.82)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    {imgLoading ? <PhotoShimmer /> : null}
                  </>
                ) : photoLoading ? (
                  <PhotoShimmer />
                ) : (
                  <View style={styles.heroFallback}>
                    <Ionicons name="restaurant" size={42} color="rgba(255,255,255,0.28)" />
                  </View>
                )}
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={12} color={colors.onPrimaryStrong} />
                  <Text style={styles.aiBadgeText}>AI Detected</Text>
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.heroTitle} numberOfLines={2}>{result.name}</Text>
                  <View style={styles.heroKcalRow}>
                    <Ionicons name="flame" size={15} color={colors.accent} />
                    <Text style={styles.heroKcal}>~{result.kcal * qty} kcal</Text>
                  </View>
                </View>
              </View>

              <View style={styles.resultMacros}>
                <ResultMacro label="Protein" value={result.protein * qty} />
                <ResultMacro label="Carbs" value={result.carbs * qty} />
                <ResultMacro label="Fats" value={result.fats * qty} />
              </View>
              <Text style={styles.resultEstimateNote}>
                {result.portion
                  ? `AI estimate · 1 serving = ${result.portion}`
                  : "Values are AI estimates"}
              </Text>

              <View style={styles.ctrlRow}>
                <View style={styles.ctrlCol}>
                  <Text style={styles.ctrlLabel}>MEAL TYPE</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Change meal type"
                    style={styles.mealSelect}
                    onPress={() => setMealMenu(true)}
                  >
                    <Text style={styles.mealSelectText}>{mealType}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.muted} />
                  </Pressable>
                </View>
                <View>
                  <Text style={styles.ctrlLabel}>SERVINGS</Text>
                  <View style={styles.qtyBox}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Decrease servings"
                      hitSlop={8}
                      onPress={() => setQty((q) => Math.max(1, q - 1))}
                    >
                      <Ionicons name="remove" size={18} color={colors.muted} />
                    </Pressable>
                    <Text style={styles.qtyText}>{qty}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Increase servings"
                      hitSlop={8}
                      onPress={() => setQty((q) => Math.min(20, q + 1))}
                    >
                      <Ionicons name="add" size={18} color={colors.accent} />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.btnRow}>
                <Pressable style={styles.retakeBtn} onPress={reset} disabled={saving}>
                  <Ionicons name="refresh" size={16} color={colors.foreground} />
                  <Text style={styles.retakeText}>Retake</Text>
                </Pressable>
                <Pressable style={[styles.logBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
                  <LinearGradient
                    colors={colors.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.logBtnGrad}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.onPrimaryStrong} />
                    ) : (
                      <Ionicons name="add" size={18} color={colors.onPrimaryStrong} />
                    )}
                    <Text style={styles.logBtnText}>{saving ? "Saving..." : "Log This Meal"}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
              {base64 ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.correctLink}
                  disabled={saving}
                  onPress={() => {
                    setCorrectionText("");
                    setCorrectionOpen(true);
                  }}
                >
                  <Text style={styles.correctLinkText}>Not quite right? Correct it</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        ) : analyzing ? (
          <Card style={{ marginTop: 14 }}>
            <AnalyzingCard
              imageUri={image}
              done={analyzeDone}
              labels={[
                image ? "Analyzing photo" : "Reading your meal",
                "Identifying food",
                "Estimating nutrition",
                "Finalizing results",
              ]}
            />
          </Card>
        ) : tab === "voice" ? (
          <Card style={styles.textCard}>
            <View style={styles.textIntro}>
              <View style={styles.dropIcon}>
                <Ionicons name="mic" size={26} color={colors.accent} />
              </View>
              <Text style={styles.dropTitle}>
                {voiceState === "recording" ? "Listening..." : "Say what you ate"}
              </Text>
              <Text style={styles.dropDesc}>
                {voiceState === "recording"
                  ? "Describe your meal, then tap to stop"
                  : 'Try "two scrambled eggs with toast and orange juice"'}
              </Text>
            </View>
            {voiceState === "transcribing" ? (
              <View style={styles.analyzing}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.analyzingText}>Transcribing your meal...</Text>
              </View>
            ) : (
              <View style={styles.micWrap}>
                <Pressable onPress={voiceState === "recording" ? stopVoice : startVoice} hitSlop={8}>
                  {voiceState === "recording" ? (
                    <View style={[styles.micBtn, styles.micBtnRecording]}>
                      <Ionicons name="stop" size={26} color={colors.onPrimaryStrong} />
                    </View>
                  ) : (
                    <LinearGradient
                      colors={colors.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.micBtn}
                    >
                      <Ionicons name="mic" size={26} color={colors.onPrimaryStrong} />
                    </LinearGradient>
                  )}
                </Pressable>
              </View>
            )}
            {mealText && voiceState === "idle" ? (
              <Text style={styles.voiceTranscript}>You said: {mealText}</Text>
            ) : null}
            {error ? <Text style={styles.formError}>{error}</Text> : null}
          </Card>
        ) : tab === "text" ? (
          <MealTextGestureArea>
            <Card style={styles.textCard}>
              <View style={styles.textIntro}>
                <View style={styles.dropIcon}>
                  <Ionicons name="create" size={26} color={colors.accent} />
                </View>
                <Text style={styles.dropTitle}>Type what you ate</Text>
                <Text style={styles.dropDesc}>AI will estimate the calories and macros instantly</Text>
              </View>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={colors.muted} />
                <TextInput
                  ref={mealTextInputRef}
                  nativeID={MEAL_TEXT_INPUT_ID}
                  value={mealText}
                  onChangeText={setMealText}
                  placeholder="e.g. 2 eggs, oatmeal with berries..."
                  placeholderTextColor={colors.mutedForeground}
                  style={styles.searchInput}
                  returnKeyType="search"
                  onSubmitEditing={() => analyzeText(mealText)}
                />
                <Pressable style={styles.analyzeBtn} onPress={() => analyzeText(mealText)}>
                  <LinearGradient
                    colors={colors.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.analyzeBtnGrad}
                  >
                    <Ionicons name="sparkles" size={14} color={colors.onPrimaryStrong} />
                    <Text style={styles.analyzeBtnText}>Analyze</Text>
                  </LinearGradient>
                </Pressable>
              </View>
              {error ? <Text style={styles.formError}>{error}</Text> : null}
            </Card>
          </MealTextGestureArea>
        ) : image ? (
          <Card style={{ marginTop: 14 }}>
            <Image source={{ uri: image }} style={styles.preview} />
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.errorText}>{error ?? "Could not analyze the image."}</Text>
              <Button label="Try Again" variant="outline" onPress={reset} style={{ marginTop: 12 }} />
            </View>
          </Card>
        ) : tab === "photo" ? (
          <Pressable pressedScale={0.985} onPress={choosePhotoSource}>
            <Card style={styles.dropCard}>
              <View style={styles.dropInner}>
                <View style={styles.dropIcon}>
                  <Ionicons name="camera" size={26} color={colors.accent} />
                </View>
                <Text style={styles.dropTitle}>
                  Tap to take a photo or upload
                </Text>
                <Text style={styles.dropDesc}>
                  AI will recognize your food instantly
                </Text>
              </View>
            </Card>
          </Pressable>
        ) : null}

        {!image && !result && !analyzing && error && tab !== "text" ? (
          <View style={styles.inlineError}>
            <Ionicons name="alert-circle" size={16} color={colors.primary} />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.diaryHead}>
          <Text style={styles.diaryEyebrow}>TODAY'S MEALS</Text>
          {todayLogs.length > 0 ? (
            <Text style={styles.diaryCount}>{todayLogs.length} logged</Text>
          ) : null}
        </View>
        {todayLogs.length === 0 ? (
          <Card style={styles.polishMealEmpty}>
            <View style={styles.polishMealEmptyIcon}>
              <Ionicons name="restaurant-outline" size={20} color={colors.accentDark} />
            </View>
            <View style={styles.polishMealEmptyCopy}>
              <Text style={styles.polishMealEmptyTitle}>No meals logged yet</Text>
              <Text style={styles.polishMealEmptyDescription}>Describe what you ate and Florish will estimate the nutrition.</Text>
            </View>
            <Pressable
              motion="timing"
              pressedScale={0.96}
              accessibilityRole="button"
              accessibilityLabel="Log first meal with text"
              style={styles.polishMealEmptyAction}
              onPress={startTextLogging}
            >
              <Text style={styles.polishMealEmptyActionText}>Log</Text>
            </Pressable>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {visibleTodayLogs.map((l) => (
              <MotionListItem key={l.id}>
              <Card style={styles.logCard}>
                <Pressable
                  pressedScale={0.985}
                  accessibilityRole="button"
                  accessibilityLabel={`View meal details for ${l.name}`}
                  onPress={() => setSelectedMeal(l)}
                  style={({ pressed }) => [styles.logDetailsTap, pressed && styles.logCardPressed]}
                >
                  {l.photoUri ? (
                    <Image source={{ uri: l.photoUri }} style={styles.logThumb} />
                  ) : (
                    <View style={[styles.logThumb, styles.logThumbFallback]}>
                      <Ionicons name="restaurant-outline" size={20} color={colors.accent} />
                    </View>
                  )}
                  <View style={styles.logMid}>
                    <View style={styles.logMetaRow}>
                      {l.mealType ? (
                        <View style={styles.mealTag}>
                          <Text style={styles.mealTagText}>{l.mealType}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.logTime}>{formatTime(l.ts)}</Text>
                    </View>
                    <Text style={styles.logName} numberOfLines={1}>{l.name}</Text>
                    <Text style={styles.logMacro}>P: {l.protein}g · C: {l.carbs}g · F: {l.fats}g</Text>
                  </View>
                </Pressable>
                <View style={styles.logRight}>
                  <Text style={styles.logKcal}>~{l.kcal}</Text>
                  <Text style={styles.logKcalUnit}>kcal</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${l.name}`}
                    style={styles.logTrash}
                    onPress={(event) => {
                      event.stopPropagation();
                      setSelectedMeal((current) => (current?.id === l.id ? null : current));
                      haptics.warning();
                      deleteCalorie(l.id);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.muted} />
                  </Pressable>
                </View>
              </Card>
              </MotionListItem>
            ))}
            {canExpandTodayLogs ? (
              <Pressable
                style={styles.seeMoreButton}
                onPress={() => setShowAllTodayLogs((current) => !current)}
              >
                <Text style={styles.seeMoreText}>{showAllTodayLogs ? "See less" : "See more"}</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <Card style={styles.insightCard}>
          <View style={styles.insightHead}>
            <View style={styles.insightIcon}>
              <Ionicons name="bulb" size={15} color={colors.accent} />
            </View>
            <Text style={styles.insightEyebrow}>AI INSIGHT</Text>
          </View>
          <CalorieInsightBody
            insight={insight}
            components={INSIGHT_COMPONENTS}
            color={insightColor}
            onChipPress={openFoodDetail}
          />
        </Card>

        <Pressable motion="timing" pressedScale={0.98} style={styles.polishRecipesRow} onPress={() => router.push("/recipes")}>
          <View style={styles.polishRecipesIcon}>
            <Ionicons name="restaurant-outline" size={19} color={colors.foreground} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.polishRecipesTitle}>Browse Recipes</Text>
            <Text style={styles.polishRecipesSub} numberOfLines={2}>Mediterranean, high protein, pre and post workout and more</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(62,39,51,0.30)" />
        </Pressable>
      </KeyboardAwareScrollView>

      <Modal visible={mealMenu} transparent animationType="fade" onRequestClose={() => setMealMenu(false)}>
        <StructuralPressable style={styles.modalBackdrop} onPress={() => setMealMenu(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Meal type</Text>
            {MEALS.map((m) => {
              const active = m === mealType;
              return (
                <Pressable
                  key={m}
                  style={styles.modalItem}
                  onPress={() => {
                    if (mealType !== m) haptics.selection();
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
        </StructuralPressable>
      </Modal>

      <Modal visible={correctionOpen} transparent animationType="fade" onRequestClose={() => setCorrectionOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <StructuralPressable style={styles.modalBackdrop} onPress={() => setCorrectionOpen(false)}>
            <StructuralPressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.modalTitle}>What is this food really?</Text>
              <TextInput
                value={correctionText}
                onChangeText={setCorrectionText}
                placeholder="e.g. droewors"
                placeholderTextColor={colors.mutedForeground}
                style={styles.correctionInput}
                autoFocus
                autoCapitalize="none"
                returnKeyType="send"
                onSubmitEditing={submitCorrection}
              />
              <Pressable
                style={[styles.analyzeBtn, { marginTop: 12, marginHorizontal: 8, marginBottom: 4 }, !correctionText.trim() && { opacity: 0.5 }]}
                disabled={!correctionText.trim()}
                onPress={submitCorrection}
              >
                <LinearGradient
                  colors={colors.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.analyzeBtnGrad, { justifyContent: "center" }]}
                >
                  <Ionicons name="sparkles" size={15} color={colors.onPrimaryStrong} />
                  <Text style={styles.analyzeBtnText}>Re-analyze</Text>
                </LinearGradient>
              </Pressable>
            </StructuralPressable>
          </StructuralPressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!selectedMeal} transparent animationType="fade" onRequestClose={() => setSelectedMeal(null)}>
        <StructuralPressable style={styles.mealDetailBackdrop} onPress={() => setSelectedMeal(null)}>
          {selectedMeal ? (
            <StructuralPressable style={styles.mealDetailSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.mealDetailHero}>
                {selectedMeal.photoUri ? (
                  <Image source={{ uri: selectedMeal.photoUri }} style={styles.mealDetailImage} />
                ) : (
                  <View style={styles.mealDetailFallback}>
                    <Ionicons name="restaurant-outline" size={42} color={colors.accent} />
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close meal details"
                  style={styles.mealDetailClose}
                  onPress={() => setSelectedMeal(null)}
                >
                  <Ionicons name="close" size={18} color={colors.foreground} />
                </Pressable>
              </View>
              <View style={styles.mealDetailBody}>
                <View style={styles.mealDetailMetaRow}>
                  {selectedMeal.mealType ? (
                    <View style={styles.mealTag}>
                      <Text style={styles.mealTagText}>{selectedMeal.mealType}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.mealDetailTime}>{formatTime(selectedMeal.ts)}</Text>
                </View>
                <Text style={styles.mealDetailTitle}>{selectedMeal.name}</Text>
                <View style={styles.mealDetailKcalRow}>
                  <Ionicons name="flame" size={18} color={colors.accent} />
                  <Text style={styles.mealDetailKcal}>~{selectedMeal.kcal.toLocaleString()} kcal</Text>
                </View>
                <View style={styles.mealDetailMacros}>
                  <DetailMacro label="Protein" value={selectedMeal.protein} />
                  <DetailMacro label="Carbs" value={selectedMeal.carbs} />
                  <DetailMacro label="Fats" value={selectedMeal.fats} />
                </View>
              </View>
            </StructuralPressable>
          ) : null}
        </StructuralPressable>
      </Modal>

      <Modal visible={!!foodDetail} transparent animationType="fade" onRequestClose={closeFoodDetail}>
        <StructuralPressable style={styles.mealDetailBackdrop} onPress={closeFoodDetail}>
          {foodDetail ? (
            <StructuralPressable style={styles.mealDetailSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.mealDetailHero}>
                {foodPhotoUrl ? (
                  <Image source={{ uri: foodPhotoUrl }} style={styles.mealDetailImage} />
                ) : (
                  <View style={styles.mealDetailFallback}>
                    {foodPhotoLoading ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : (
                      <Ionicons
                        name={foodDetail.icon as keyof typeof Ionicons.glyphMap}
                        size={42}
                        color={colors.accent}
                      />
                    )}
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close food details"
                  style={styles.mealDetailClose}
                  onPress={closeFoodDetail}
                >
                  <Ionicons name="close" size={18} color={colors.foreground} />
                </Pressable>
              </View>
              <View style={styles.mealDetailBody}>
                <Text style={styles.mealDetailTitle}>{foodDetail.name}</Text>
                <View style={styles.mealDetailKcalRow}>
                  <Ionicons name="flame" size={18} color={colors.accent} />
                  <Text style={styles.mealDetailKcal}>
                    ~{Math.round(foodDetail.protein * 4 + foodDetail.carbs * 4 + foodDetail.fats * 9).toLocaleString()} kcal
                  </Text>
                </View>
                <View style={styles.mealDetailMacros}>
                  <DetailMacro label="Protein" value={foodDetail.protein} />
                  <DetailMacro label="Carbs" value={foodDetail.carbs} />
                  <DetailMacro label="Fats" value={foodDetail.fats} />
                </View>
                <Text style={styles.foodDetailNote}>Approx. per serving</Text>
              </View>
            </StructuralPressable>
          ) : null}
        </StructuralPressable>
      </Modal>
    </GradientBackground>
  );
}

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function GoalMacro({ label, value, goal }: { label: string; value: number; goal: number }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.polishGoalMacro}>
      <Text style={styles.polishGoalMacroValue}>
        <AnimatedNumber value={value} formatter={(n) => `${Math.round(n)}`} style={styles.polishGoalMacroValue} />
        <Text style={styles.polishGoalMacroUnit}>g</Text>
      </Text>
      <Text style={styles.polishGoalMacroLabel} numberOfLines={1}>{label} {goal}g</Text>
    </View>
  );
}

function ResultMacro({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.rMacro}>
      <Text style={styles.rMacroVal}>{value}g</Text>
      <Text style={styles.rMacroLabel}>{label}</Text>
    </View>
  );
}

function DetailMacro({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detailMacro}>
      <Text style={styles.detailMacroValue}>{value}g</Text>
      <Text style={styles.detailMacroLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  polishGoalCard: { marginTop: 16, padding: 18, borderRadius: 22 },
  polishGoalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  polishEyebrow: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.8, color: colors.mutedForeground },
  polishDate: { fontFamily: fonts.sansSemibold, fontSize: 11.5, color: "rgba(62,39,51,0.50)" },
  polishGoalMain: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 16 },
  polishRemaining: { fontFamily: fonts.serifSemibold, fontSize: 20, lineHeight: 23, color: colors.foreground },
  polishRemainingLabel: { fontFamily: fonts.sansBold, fontSize: 7.5, letterSpacing: 1.2, color: colors.mutedForeground, marginTop: 3 },
  polishGoalDetails: { flex: 1, minWidth: 0, gap: 10 },
  polishEatenLine: { fontFamily: fonts.sans, fontSize: 13, color: "rgba(62,39,51,0.60)" },
  polishEatenStrong: { fontFamily: fonts.sansBold, color: colors.foreground },
  polishGoalMacros: { flexDirection: "row", gap: 10 },
  polishGoalMacro: { flex: 1, minWidth: 0 },
  polishGoalMacroValue: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.foreground },
  polishGoalMacroUnit: { fontFamily: fonts.sansSemibold, fontSize: 9.5, color: colors.mutedForeground },
  polishGoalMacroLabel: { fontFamily: fonts.sansSemibold, fontSize: 9, color: colors.mutedForeground, marginTop: 1 },
  polishWeekZone: { borderTopWidth: 1, borderTopColor: "rgba(62,39,51,0.07)", paddingTop: 14, marginTop: 16 },
  polishWeekHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  polishWeekEyebrow: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1, color: colors.mutedForeground },
  polishWeekRange: { fontFamily: fonts.sansSemibold, fontSize: 11, color: "rgba(62,39,51,0.50)" },
  polishWeekBars: { height: 56, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  polishWeekColumn: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center", gap: 5 },
  polishWeekBar: { width: "100%", maxWidth: 22, height: 3, borderRadius: 99, backgroundColor: "rgba(62,39,51,0.10)" },
  polishWeekBarLogged: { backgroundColor: colors.hydrationAccent },
  polishWeekBarToday: { backgroundColor: colors.primary },
  polishWeekDay: { fontFamily: fonts.sansSemibold, fontSize: 9, color: colors.mutedForeground },
  polishWeekDayToday: { fontFamily: fonts.sansBold, color: colors.accentDark },
  polishLogSection: { marginTop: 16, marginBottom: 10 },
  polishActionTiles: { flexDirection: "row", gap: 10 },
  polishActionTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 93,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  polishActionTilePrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 7,
  },
  polishActionCopy: { alignItems: "center", maxWidth: "100%" },
  polishActionTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.foreground },
  polishActionTitlePrimary: { color: colors.onPrimary },
  polishActionSub: { fontFamily: fonts.sansSemibold, fontSize: 9.5, color: colors.mutedForeground, marginTop: 1 },
  polishActionSubPrimary: { color: "rgba(255,255,255,0.75)" },
  goalCard: { marginTop: 20, padding: 20 },
  goalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.2, color: colors.muted },
  dateChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },
  goalMain: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  goalRingWrap: { alignItems: "center", marginTop: 18 },
  bigNumRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" },
  bigNum: { fontFamily: fonts.serifSemibold, fontSize: 40, color: colors.foreground },
  bigNumGoal: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted },
  remaining: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 4 },
  remainingNum: { fontFamily: fonts.serifSemibold, fontSize: 42, lineHeight: 46, color: colors.foreground },
  remainingLabel: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.7, color: colors.mutedForeground, marginTop: 2 },
  eatenLine: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, marginTop: 12 },
  eatenStrong: { fontFamily: fonts.sansBold, color: colors.foreground },
  ringPct: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  macros: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 24 },
  macroTile: { flex: 1, alignItems: "center" },
  macroRingValue: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.foreground },
  macroLabel: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.foreground, marginTop: 8 },
  macroValue: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 1 },
  section: { marginTop: 28, marginBottom: 14 },
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
  dropCard: { marginTop: 14, paddingVertical: 36, borderStyle: "dashed", borderWidth: 1.5, borderColor: colors.accentBorderLg },
  dropInner: { alignItems: "center" },
  dropIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accentTintMd,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  dropTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  dropDesc: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 6 },
  textCard: { marginTop: 14, padding: 18 },
  textIntro: { alignItems: "center", marginBottom: 16 },
  formError: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary, marginTop: 12 },
  micWrap: { alignItems: "center", paddingVertical: 8 },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnRecording: {
    backgroundColor: colors.primary,
    borderWidth: 6,
    borderColor: colors.accentTintLg,
  },
  voiceTranscript: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    marginTop: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 28,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14.5,
    color: colors.foreground,
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
  },
  analyzeBtn: { borderRadius: 22, overflow: "hidden" },
  analyzeBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  analyzeBtnText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.onPrimaryStrong },
  preview: { width: "100%", height: 200, borderRadius: colors.radius, marginBottom: 8 },
  analyzing: { alignItems: "center", paddingVertical: 20, gap: 12 },
  analyzingText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.muted },
  resultBox: { paddingTop: 2 },
  heroWrap: { height: 188, borderRadius: colors.radius, overflow: "hidden", justifyContent: "center" },
  heroImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  heroFallback: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.foreground,
    alignItems: "center",
    justifyContent: "center",
  },
  heroShimmer: { backgroundColor: "rgba(255,255,255,0.08)" },
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
  aiBadgeText: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.onPrimaryStrong },
  heroText: { position: "absolute", right: 16, left: 16, bottom: 16, alignItems: "flex-end" },
  heroTitle: { fontFamily: fonts.serifSemibold, fontSize: 24, color: "#FFFFFF", textAlign: "right" },
  heroKcalRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  heroKcal: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.accent },
  resultMacros: { flexDirection: "row", gap: 12, marginTop: 14 },
  resultEstimateNote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    marginTop: 10,
    textAlign: "center",
  },
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
  ctrlCol: { flex: 1 },
  ctrlLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.muted,
    marginBottom: 6,
    marginLeft: 2,
  },
  mealSelect: {
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
    paddingVertical: 14,
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
  logBtnText: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.onPrimaryStrong },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(16,17,17,0.45)", justifyContent: "center", paddingHorizontal: 40 },
  correctLink: { alignItems: "center", marginTop: 14 },
  correctLinkText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accentDark },
  correctionInput: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    marginHorizontal: 8,
  },
  modalSheet: {
    backgroundColor: colors.card,
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
  recipesCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  recipesIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  recipesTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  recipesSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  diaryHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 10 },
  diaryEyebrow: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.8, color: colors.mutedForeground },
  diaryCount: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.primary },
  polishMealEmpty: { minHeight: 90, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  polishMealEmptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentTint, alignItems: "center", justifyContent: "center" },
  polishMealEmptyCopy: { flex: 1, minWidth: 0 },
  polishMealEmptyTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
  polishMealEmptyDescription: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 16, color: colors.mutedForeground, marginTop: 2 },
  polishMealEmptyAction: { minWidth: 54, minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  polishMealEmptyActionText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accentDark },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: 10 },
  seeMoreButton: { alignSelf: "center", paddingHorizontal: 8, paddingVertical: 4, marginTop: -2 },
  seeMoreText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent },
  logCard: { flexDirection: "row", gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  logDetailsTap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  logCardPressed: { opacity: 0.86 },
  logThumb: { width: 56, height: 56, borderRadius: 14 },
  logThumbFallback: { backgroundColor: colors.accentTint, alignItems: "center", justifyContent: "center" },
  logMid: { flex: 1, justifyContent: "center" },
  logMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  mealTag: { backgroundColor: colors.accentTintLg, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  mealTagText: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.accent },
  logTime: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.mutedForeground },
  logName: { fontFamily: fonts.serifSemibold, fontSize: 16, color: colors.foreground },
  logMacro: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 4 },
  logRight: { alignItems: "flex-end", justifyContent: "space-between" },
  logKcal: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.foreground },
  logKcalUnit: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 1 },
  logTrash: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.cardElevated, alignItems: "center", justifyContent: "center", marginTop: 6 },
  mealDetailBackdrop: { flex: 1, backgroundColor: "rgba(16,17,17,0.5)", justifyContent: "center", paddingHorizontal: 24 },
  mealDetailSheet: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    overflow: "hidden",
  },
  mealDetailHero: { height: 210, backgroundColor: colors.cardElevated },
  mealDetailImage: { width: "100%", height: "100%" },
  mealDetailFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentTint },
  mealDetailClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  mealDetailBody: { padding: 18 },
  mealDetailMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mealDetailTime: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted },
  mealDetailTitle: { fontFamily: fonts.serifSemibold, fontSize: 26, lineHeight: 31, color: colors.foreground, marginTop: 12 },
  mealDetailKcalRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12 },
  mealDetailKcal: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.accent },
  mealDetailMacros: { flexDirection: "row", gap: 10, marginTop: 16 },
  detailMacro: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 13,
  },
  detailMacroValue: { fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.foreground },
  detailMacroLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 3 },
  foodDetailNote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    marginTop: 12,
    textAlign: "center",
  },

  insightCard: { marginTop: 16, padding: 18, borderRadius: 22 },
  insightHead: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  insightIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentTintMd, alignItems: "center", justifyContent: "center" },
  insightEyebrow: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.8, color: colors.mutedForeground },
  insightText: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 21, color: "rgba(62,39,51,0.75)" },
  insightStrong: { fontFamily: fonts.sansSemibold, color: colors.foreground },
  insightChipsCaption: {
    fontFamily: fonts.sansSemibold,
    fontSize: 11.5,
    letterSpacing: 0.4,
    color: colors.muted,
    marginTop: 14,
  },
  insightChips: { flexDirection: "row", gap: 10, marginTop: 8 },
  insightChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.blushSurface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  insightChipPressed: { opacity: 0.6 },
  insightChipName: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground, flex: 1 },
  insightChipVal: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.primary },

  polishRecipesRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  polishRecipesIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(62,39,51,0.05)",
  },
  polishRecipesTitle: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.foreground },
  polishRecipesSub: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: colors.mutedForeground, marginTop: 2 },

  weekCard: { marginTop: 14, padding: 18, marginBottom: 8 },
  weekHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  weekEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.2, color: colors.muted },
  weekRange: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
  chartWrap: { flexDirection: "row", height: 168 },
  chartYAxis: { justifyContent: "space-between", paddingBottom: 22, paddingRight: 10, alignItems: "flex-end" },
  chartYLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  chartArea: { flex: 1, position: "relative" },
  chartGoalLine: { position: "absolute", top: 7, left: 0, right: 0, height: 1, borderTopWidth: 1, borderColor: colors.accentBorder, borderStyle: "dashed" },
  chartBars: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
  chartCol: { flex: 1, alignItems: "center" },
  chartBarTrack: { flex: 1, width: 22, justifyContent: "flex-end", marginBottom: 8 },
  chartBar: { width: "100%", borderRadius: 7, backgroundColor: colors.mutedForeground, minHeight: 3 },
  chartBarToday: { backgroundColor: colors.accent },
  chartXLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
});

// React-native host elements the insight card renders through. Kept here so the
// styling stays with the screen, while the wiring (segments + chips) lives in
// the testable, RN-free CalorieInsightBody. A factory over the themed styles so
// the chips restyle with the palette.
const insightComponents = (styles: ReturnType<typeof createStyles>): InsightBodyComponents => ({
  Text: ({ children }) => <Text style={styles.insightText}>{children}</Text>,
  Strong: ({ children }) => <Text style={styles.insightStrong}>{children}</Text>,
  ChipsCaption: ({ children }) => <Text style={styles.insightChipsCaption}>{children}</Text>,
  ChipsRow: ({ children }) => <View style={styles.insightChips}>{children}</View>,
  Chip: ({ onPress, children }) => (
    <Pressable
      style={({ pressed }) => [styles.insightChip, pressed && styles.insightChipPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  ),
  ChipIcon: ({ name, color }) => (
    <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={14} color={color} />
  ),
  ChipName: ({ numberOfLines, children }) => (
    <Text style={styles.insightChipName} numberOfLines={numberOfLines}>
      {children}
    </Text>
  ),
  ChipValue: ({ color, children }) => (
    <Text style={[styles.insightChipVal, { color }]}>{children}</Text>
  ),
});
