import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform, ActivityIndicator, TextInput, Modal } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { HelpButton } from "@/components/HelpButton";
import { PageHeader, SectionLabel } from "@/components/PageHeader";
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
  const [mealText, setMealText] = useState("");

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

  const proteinLeft = Math.max(0, goalProtein - totals.protein);

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

  const analyzeText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Describe your meal to analyze.");
      return;
    }
    setMealText(trimmed);
    setImage(null);
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
        const txt = await resp.text();
        throw new Error(txt || "Analysis failed");
      }
      const data = (await resp.json()) as AnalysisResult;
      setResult(data);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.message?.includes("API") ? "AI service is not configured yet." : "Could not analyze that meal. Please try again.");
    } finally {
      setAnalyzing(false);
    }
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
        <PageHeader
          eyebrow="AI POWERED"
          title="Calorie"
          accent="Tracker"
          action={
            <HelpButton
              title="Calorie Tracker"
              intro="Log what you eat and stay on top of your daily goal."
              points={[
                "Snap a photo, scan a barcode, or type a meal — AI does the math.",
                "See your calories and protein, carbs, and fats against your goal.",
                "Review everything you've logged today in one place.",
              ]}
            />
          }
        />

        <Card style={styles.goalCard}>
          <View style={styles.goalHead}>
            <View style={styles.eyebrowRow}>
              <Ionicons name="flame-outline" size={14} color={colors.accent} />
              <Text style={styles.cardEyebrow}>TODAY'S GOAL</Text>
            </View>
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

        <SectionLabel style={styles.section}>LOG A MEAL</SectionLabel>
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

        {result ? (
          <Card style={{ marginTop: 14 }}>
            <View style={styles.resultBox}>
              <View style={styles.heroWrap}>
                {image ? (
                  <>
                    <Image source={{ uri: image }} style={styles.heroImg} />
                    <LinearGradient
                      colors={["transparent", "rgba(16,17,17,0.82)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </>
                ) : (
                  <View style={styles.heroFallback}>
                    <Ionicons name="restaurant" size={42} color="rgba(255,255,255,0.28)" />
                  </View>
                )}
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
          </Card>
        ) : analyzing ? (
          <Card style={{ marginTop: 14 }}>
            {image ? <Image source={{ uri: image }} style={styles.preview} /> : null}
            <View style={styles.analyzing}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.analyzingText}>Analyzing your meal...</Text>
            </View>
          </Card>
        ) : tab === "text" ? (
          <Card style={styles.textCard}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
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
                  <Ionicons name="sparkles" size={14} color={colors.onPrimary} />
                  <Text style={styles.analyzeBtnText}>Analyze</Text>
                </LinearGradient>
              </Pressable>
            </View>
            <View style={styles.chipsWrap}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.suggestChip} onPress={() => setMealText(s)}>
                  <Text style={styles.suggestChipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
            {error ? <Text style={styles.formError}>{error}</Text> : null}
          </Card>
        ) : image ? (
          <Card style={{ marginTop: 14 }}>
            <Image source={{ uri: image }} style={styles.preview} />
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.errorText}>{error ?? "Could not analyze the image."}</Text>
              <Button label="Try Again" variant="outline" onPress={reset} style={{ marginTop: 12 }} />
            </View>
          </Card>
        ) : (
          <Pressable onPress={() => pickImage(tab === "photo" ? Platform.OS !== "web" : false)}>
            <Card style={styles.dropCard}>
              <View style={styles.dropInner}>
                <View style={styles.dropIcon}>
                  <Ionicons name={tab === "photo" ? "camera" : "barcode"} size={26} color={colors.accent} />
                </View>
                <Text style={styles.dropTitle}>
                  {tab === "photo" ? "Tap to take a photo or upload" : "Point camera at barcode"}
                </Text>
                <Text style={styles.dropDesc}>
                  {tab === "photo" ? "AI will recognize your food instantly" : "Supports all food product barcodes"}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}

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
          <Card style={{ alignItems: "center", paddingVertical: 28 }}>
            <Ionicons name="restaurant-outline" size={32} color={colors.blush} />
            <Text style={styles.emptyText}>No meals logged yet today</Text>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {todayLogs.map((l) => (
              <Card key={l.id} style={styles.logCard}>
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
                <View style={styles.logRight}>
                  <Text style={styles.logKcal}>{l.kcal}</Text>
                  <Text style={styles.logKcalUnit}>kcal</Text>
                  <Pressable style={styles.logTrash} onPress={() => deleteCalorie(l.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={15} color={colors.muted} />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}

        <Card style={styles.insightCard}>
          <View style={styles.insightHead}>
            <View style={styles.insightIcon}>
              <Ionicons name="bulb" size={15} color={colors.accent} />
            </View>
            <Text style={styles.insightEyebrow}>AI INSIGHT</Text>
          </View>
          {proteinLeft > 0 ? (
            <Text style={styles.insightText}>
              You're doing great! You still need{" "}
              <Text style={styles.insightStrong}>{proteinLeft}g of protein</Text> to hit your daily
              goal. Consider adding a protein-rich dinner like salmon or lentils.
            </Text>
          ) : (
            <Text style={styles.insightText}>
              Excellent work — you've hit your{" "}
              <Text style={styles.insightStrong}>protein goal</Text> for today. Keep your meals
              balanced to stay on track.
            </Text>
          )}
          <View style={styles.insightChips}>
            <View style={styles.insightChip}>
              <Ionicons name="fish" size={14} color={colors.accent} />
              <Text style={styles.insightChipName}>Salmon fillet</Text>
              <Text style={styles.insightChipVal}>+35g</Text>
            </View>
            <View style={styles.insightChip}>
              <Ionicons name="restaurant" size={14} color={colors.accent} />
              <Text style={styles.insightChipName}>Lentil soup</Text>
              <Text style={styles.insightChipVal}>+18g</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.weekCard}>
          <View style={styles.weekHead}>
            <Text style={styles.weekEyebrow}>WEEKLY OVERVIEW</Text>
            <Text style={styles.weekRange}>{week.range}</Text>
          </View>
          <View style={styles.chartWrap}>
            <View style={styles.chartYAxis}>
              <Text style={styles.chartYLabel}>{(profile.calorieGoal / 1000).toFixed(1)}k</Text>
              <Text style={styles.chartYLabel}>{(profile.calorieGoal / 2000).toFixed(1)}k</Text>
              <Text style={styles.chartYLabel}>0</Text>
            </View>
            <View style={styles.chartArea}>
              <View style={styles.chartGoalLine} />
              <View style={styles.chartBars}>
                {week.days.map((d) => {
                  const h = Math.max(0.02, Math.min(1, d.total / profile.calorieGoal));
                  return (
                    <View key={d.label} style={styles.chartCol}>
                      <View style={styles.chartBarTrack}>
                        <View
                          style={[
                            styles.chartBar,
                            { height: `${h * 100}%` },
                            d.isToday && styles.chartBarToday,
                          ]}
                        />
                      </View>
                      <Text style={styles.chartXLabel}>{d.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </Card>
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

const SUGGESTIONS = ["Greek yogurt", "Avocado toast", "Protein shake", "Brown rice", "Salmon fillet"];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

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
  goalCard: { marginTop: 20, padding: 20 },
  goalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.2, color: colors.muted },
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
  formError: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary, marginTop: 12 },
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
  analyzeBtnText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.onPrimary },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  suggestChip: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestChipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
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
  modalBackdrop: { flex: 1, backgroundColor: "rgba(16,17,17,0.45)", justifyContent: "center", paddingHorizontal: 40 },
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
  diaryHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 14 },
  diaryEyebrow: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 2, color: colors.muted },
  diaryCount: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.primary },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: 10 },
  logCard: { flexDirection: "row", gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
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

  insightCard: { marginTop: 14, padding: 18 },
  insightHead: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  insightIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentTintMd, alignItems: "center", justifyContent: "center" },
  insightEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.2, color: colors.muted },
  insightText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.muted },
  insightStrong: { fontFamily: fonts.sansSemibold, color: colors.foreground },
  insightChips: { flexDirection: "row", gap: 10, marginTop: 14 },
  insightChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  insightChipName: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground, flex: 1 },
  insightChipVal: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.primary },

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
