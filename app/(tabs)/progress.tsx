import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, ActionSheetIOS, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { HelpButton } from "@/components/HelpButton";
import { ProgressBar } from "@/components/ProgressBar";
import { LineChart, LinePoint } from "@/components/LineChart";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { todayKey } from "@/lib/storage";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const TABS = [
  { key: "progress", label: "Progress", icon: "trending-up" as const },
  { key: "bmi", label: "BMI", icon: "body-outline" as const },
  { key: "photos", label: "Photos", icon: "images-outline" as const },
];

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmtDay = (d: Date) => `${M[d.getMonth()]} ${d.getDate()}`;
const fmtLogDate = (d: Date) => {
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? "Today" : fmtDay(d);
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDateInput = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

const parseDateInput = (s: string): number | null => {
  const parts = s.trim().split(/[\/\-.]/);
  if (parts.length !== 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (!day || !month || !year || year < 1900) return null;
  const d = new Date(year, month - 1, day, 12, 0, 0);
  if (isNaN(d.getTime())) return null;
  // Reject invalid calendar dates (e.g. 31/02) that JS would roll over.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d.getTime();
};

export default function Progress() {
  const insets = useInsets();
  const { profile, weightLogs, progressPhotos, addWeight, removeWeight, addPhoto, removePhoto } =
    useData();

  const [tab, setTab] = useState("progress");
  const [weightInput, setWeightInput] = useState("");
  const [dateInput, setDateInput] = useState(fmtDateInput(new Date()));
  const [logError, setLogError] = useState("");
  const [photoError, setPhotoError] = useState("");

  const unit = profile.weightUnit ?? "kg";

  const sortedDesc = useMemo(() => [...weightLogs].sort((a, b) => b.ts - a.ts), [weightLogs]);

  const current = sortedDesc[0]?.weight ?? profile.weight ?? null;
  const start = sortedDesc.length
    ? sortedDesc[sortedDesc.length - 1].weight
    : profile.startWeight ?? current;
  const goal = profile.goalWeight;

  const trend = current != null && start != null ? current - start : null;
  const toGoal = current != null && goal != null ? current - goal : null;
  const improving =
    current != null && start != null && goal != null
      ? Math.abs(current - goal) < Math.abs(start - goal)
      : trend != null && trend < 0;

  const goalProgress = useMemo(() => {
    if (current == null || start == null || goal == null || start === goal) return 0;
    return Math.max(0, Math.min(1, (start - current) / (start - goal)));
  }, [current, start, goal]);

  const chartData: LinePoint[] = useMemo(() => {
    const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
    const sorted = [...weightLogs].sort((a, b) => a.ts - b.ts);
    const recent = sorted.filter((l) => l.ts >= cutoff);
    const points = (recent.length >= 2 ? recent : sorted).slice(-8);
    return points.map((l) => ({ label: fmtDay(new Date(l.ts)), value: l.weight }));
  }, [weightLogs]);

  const logWeight = () => {
    const w = parseFloat(weightInput.replace(",", "."));
    if (!w || w <= 0) {
      setLogError("Enter a valid weight.");
      return;
    }
    const ts = parseDateInput(dateInput);
    if (ts == null) {
      setLogError("Enter a valid date (dd/mm/yyyy).");
      return;
    }
    addWeight(Math.round(w * 10) / 10, ts);
    setWeightInput("");
    setDateInput(fmtDateInput(new Date()));
    setLogError("");
  };

  const sortedPhotos = useMemo(
    () => [...progressPhotos].sort((a, b) => b.ts - a.ts),
    [progressPhotos]
  );
  const beforePhoto = sortedPhotos.length ? sortedPhotos[sortedPhotos.length - 1] : null;
  const afterPhoto = sortedPhotos.length ? sortedPhotos[0] : null;
  const hasPair = sortedPhotos.length >= 2;

  const addProgressPhoto = async (fromCamera: boolean) => {
    setPhotoError("");
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPhotoError("Permission is required to add a photo.");
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
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      try {
        await addPhoto(uri, current);
      } catch {
        setPhotoError("Couldn't save the photo — storage may be full. Try removing older photos.");
      }
    } catch {
      setPhotoError("Unable to open the camera or library on this device.");
    }
  };

  const pickProgressPhoto = () => {
    setPhotoError("");
    if (Platform.OS === "web") {
      addProgressPhoto(false);
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Take Photo", "Choose from Gallery", "Cancel"],
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) addProgressPhoto(true);
          else if (index === 1) addProgressPhoto(false);
        },
      );
      return;
    }
    Alert.alert("Add Progress Photo", undefined, [
      { text: "Take Photo", onPress: () => addProgressPhoto(true) },
      { text: "Choose from Gallery", onPress: () => addProgressPhoto(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const hasData = current != null;

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>WELLNESS</Text>
            <Text style={styles.title}>
              Your <Text style={styles.titleItalic}>Progress</Text>
            </Text>
          </View>
          <HelpButton
            title="Your Progress"
            intro="See how far you've come and keep your goals in view."
            points={[
              "Track your weight over time and watch the trend take shape.",
              "Explore charts that show your activity and results at a glance.",
              "Log new measurements to keep your progress up to date.",
            ]}
          />
        </View>

        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const isActive = t.key === tab;
            return (
              <Pressable key={t.key} style={[styles.tab, isActive && styles.tabActive]} onPress={() => setTab(t.key)}>
                <Ionicons name={t.icon} size={15} color={isActive ? colors.onPrimary : colors.muted} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === "progress" ? (
          <>
            <Card style={styles.weightCard}>
              <View style={styles.cardHead}>
                <Text style={styles.cardEyebrow}>WEIGHT PROGRESS</Text>
                {trend != null && Math.abs(trend) >= 0.05 ? (
                  <View style={styles.trendPill}>
                    <Ionicons
                      name={trend < 0 ? "trending-down" : "trending-up"}
                      size={13}
                      color={improving ? colors.success : colors.primary}
                    />
                    <Text style={[styles.trendText, { color: improving ? colors.success : colors.primary }]}>
                      {trend > 0 ? "+" : ""}
                      {trend.toFixed(1)} {unit}
                    </Text>
                  </View>
                ) : null}
              </View>

              {hasData ? (
                <View style={styles.weightBody}>
                  <View style={styles.weightLeft}>
                    <View style={styles.bigRow}>
                      <Text style={styles.bigNum}>{current!.toFixed(1)}</Text>
                      <Text style={styles.bigUnit}> {unit}</Text>
                    </View>
                    {start != null ? (
                      <Text style={styles.startedText}>
                        Started at {start.toFixed(1)} {unit}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.weightRight}>
                    {goal != null ? (
                      <>
                        <View style={styles.goalRow}>
                          <Text style={styles.goalLabel}>Goal</Text>
                          <Text style={styles.goalVal}>
                            {goal.toFixed(0)} {unit}
                          </Text>
                        </View>
                        <ProgressBar progress={goalProgress} height={8} style={{ marginTop: 10 }} />
                        {toGoal != null ? (
                          <Text style={styles.toGoalText}>
                            {Math.abs(toGoal).toFixed(1)} {unit} to goal
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <Text style={styles.noGoalText}>Set a goal weight in your profile to track progress.</Text>
                    )}
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyHint}>Log your weight below to start tracking your progress.</Text>
              )}
            </Card>

            <Card style={{ marginTop: 20 }}>
              <View style={styles.cardHead}>
                <Text style={styles.cardEyebrow}>WEIGHT OVER TIME</Text>
                <Text style={styles.weekRange}>Last 4 weeks</Text>
              </View>
              {chartData.length >= 2 ? (
                <View style={{ marginTop: 18 }}>
                  <LineChart data={chartData} unit={unit} />
                </View>
              ) : (
                <View style={styles.chartEmpty}>
                  <Ionicons name="analytics-outline" size={30} color={colors.mutedForeground} />
                  <Text style={styles.chartEmptyText}>Log at least two weigh-ins to see your trend</Text>
                </View>
              )}
            </Card>

            <Text style={styles.section}>LOG WEIGHT</Text>
            <Card style={styles.logCard}>
              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>WEIGHT ({unit.toUpperCase()})</Text>
                  <TextInput
                    value={weightInput}
                    onChangeText={setWeightInput}
                    placeholder="e.g. 62.4"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    style={styles.input}
                    returnKeyType="done"
                    onSubmitEditing={logWeight}
                  />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>DATE</Text>
                  <TextInput
                    value={dateInput}
                    onChangeText={setDateInput}
                    placeholder="dd/mm/yyyy"
                    placeholderTextColor={colors.mutedForeground}
                    style={styles.input}
                    returnKeyType="done"
                    onSubmitEditing={logWeight}
                  />
                </View>
              </View>
              {logError ? <Text style={styles.logErrorText}>{logError}</Text> : null}
              <Pressable style={styles.logBtn} onPress={logWeight}>
                <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logBtnGrad}>
                  <Ionicons name="add" size={20} color={colors.onPrimary} />
                  <Text style={styles.logBtnText}>Log Weight</Text>
                </LinearGradient>
              </Pressable>
            </Card>

            <Text style={styles.section}>RECENT LOGS</Text>
            {sortedDesc.length === 0 ? (
              <Card style={{ alignItems: "center", paddingVertical: 28 }}>
                <Ionicons name="scale-outline" size={32} color={colors.blush} />
                <Text style={styles.chartEmptyText}>No weigh-ins logged yet</Text>
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                {sortedDesc.slice(0, 10).map((l, i) => {
                  const prev = sortedDesc[i + 1];
                  const delta = prev ? l.weight - prev.weight : null;
                  return (
                    <Card key={l.id} style={styles.logRow}>
                      <View style={styles.logLeft}>
                        <View style={styles.logIcon}>
                          <Ionicons name="scale-outline" size={18} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.logVal}>
                            {l.weight.toFixed(1)} {unit}
                          </Text>
                          <Text style={styles.logDate}>{fmtLogDate(new Date(l.ts))}</Text>
                        </View>
                      </View>
                      <View style={styles.logRight}>
                        {delta != null && delta !== 0 ? (
                          <Text style={styles.logDelta}>
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(1)} {unit}
                          </Text>
                        ) : null}
                        <Pressable onPress={() => removeWeight(l.id)} hitSlop={10}>
                          <Ionicons name="close-circle-outline" size={22} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </>
        ) : tab === "photos" ? (
          <>
            <Card style={styles.galleryCard}>
              <View style={styles.galleryIcon}>
                <Ionicons name="lock-closed" size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.galleryTitle}>Private Gallery</Text>
                <Text style={styles.gallerySub}>Only visible to you · End-to-end encrypted</Text>
              </View>
            </Card>

            <Pressable
              onPress={pickProgressPhoto}
              style={({ pressed }) => [styles.addPhotoCard, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.addPhotoIcon}>
                <Ionicons name="camera" size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addPhotoTitle}>Add Progress Photo</Text>
                <Text style={styles.addPhotoSub}>Tap to take or upload a photo</Text>
              </View>
            </Pressable>
            {photoError ? <Text style={styles.logErrorText}>{photoError}</Text> : null}

            {sortedPhotos.length === 0 ? (
              <Card style={{ alignItems: "center", paddingVertical: 32, marginTop: 18 }}>
                <Ionicons name="images-outline" size={32} color={colors.blush} />
                <Text style={styles.chartEmptyText}>No progress photos yet</Text>
              </Card>
            ) : (
              <>
                <View style={styles.photosHead}>
                  <Text style={styles.section}>BEFORE & AFTER</Text>
                  <Text style={styles.photosCount}>
                    {sortedPhotos.length} {sortedPhotos.length === 1 ? "photo" : "photos"}
                  </Text>
                </View>

                {hasPair && beforePhoto && afterPhoto ? (
                  <View style={styles.baRow}>
                    <View style={styles.baCard}>
                      <Image source={{ uri: beforePhoto.uri }} style={styles.baImg} contentFit="cover" />
                      <View style={styles.baLabel}>
                        <Text style={styles.baLabelText}>Before</Text>
                      </View>
                      <LinearGradient
                        colors={["transparent", "rgba(16,17,17,0.85)"]}
                        style={styles.baOverlay}
                      >
                        <Text style={styles.baDate}>{fmtDay(new Date(beforePhoto.ts))}</Text>
                        <Text style={styles.baMeta}>
                          {beforePhoto.weight != null ? `${beforePhoto.weight.toFixed(1)} ${unit} · ` : ""}Start
                        </Text>
                      </LinearGradient>
                    </View>
                    <View style={styles.baCard}>
                      <Image source={{ uri: afterPhoto.uri }} style={styles.baImg} contentFit="cover" />
                      <View style={[styles.baLabel, styles.baLabelAfter]}>
                        <Text style={styles.baLabelText}>After</Text>
                      </View>
                      <LinearGradient
                        colors={["transparent", "rgba(16,17,17,0.85)"]}
                        style={styles.baOverlay}
                      >
                        <Text style={styles.baDate}>{fmtDay(new Date(afterPhoto.ts))}</Text>
                        <Text style={styles.baMeta}>
                          {afterPhoto.weight != null ? `${afterPhoto.weight.toFixed(1)} ${unit} · ` : ""}Now
                        </Text>
                      </LinearGradient>
                    </View>
                  </View>
                ) : (
                  <Card style={{ alignItems: "center", paddingVertical: 24 }}>
                    <Text style={styles.chartEmptyText}>Add one more photo to compare before & after</Text>
                  </Card>
                )}

                <Text style={[styles.section, { marginTop: 22 }]}>PHOTO TIMELINE</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingVertical: 2 }}
                >
                  {sortedPhotos.map((p) => (
                    <View key={p.id} style={styles.timelineItem}>
                      <Image source={{ uri: p.uri }} style={styles.timelineImg} contentFit="cover" />
                      <Pressable
                        onPress={() => removePhoto(p.id)}
                        hitSlop={8}
                        style={styles.timelineRemove}
                      >
                        <Ionicons name="close" size={14} color={colors.onPrimary} />
                      </Pressable>
                      <Text style={styles.timelineDate}>{fmtDay(new Date(p.ts))}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        ) : (
          <Card style={styles.comingSoon}>
            <Ionicons name={active.icon} size={34} color={colors.accent} />
            <Text style={styles.comingTitle}>{active.label}</Text>
            <Text style={styles.comingDesc}>Coming soon</Text>
          </Card>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.6, color: colors.muted },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.foreground, marginTop: 2 },
  titleItalic: { fontFamily: fonts.serifItalic, color: colors.foreground },
  tabBar: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    padding: 5,
    marginTop: 20,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 11,
    borderRadius: 13,
  },
  tabActive: { backgroundColor: colors.primary },
  tabLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  tabLabelActive: { fontFamily: fonts.sansSemibold, color: colors.onPrimary },

  weightCard: { marginTop: 18, padding: 18 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.2, color: colors.muted },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.successTint,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trendText: { fontFamily: fonts.sansSemibold, fontSize: 12.5 },
  weightBody: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 16 },
  weightLeft: {},
  bigRow: { flexDirection: "row", alignItems: "baseline" },
  bigNum: { fontFamily: fonts.sansBold, fontSize: 40, color: colors.foreground },
  bigUnit: { fontFamily: fonts.sans, fontSize: 16, color: colors.muted },
  startedText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
  weightRight: { flex: 1 },
  goalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  goalVal: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  toGoalText: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 8 },
  noGoalText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.mutedForeground, lineHeight: 18 },
  emptyHint: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, marginTop: 14, lineHeight: 20 },

  weekRange: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  chartEmpty: { alignItems: "center", paddingVertical: 30, gap: 10 },
  chartEmptyText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, marginTop: 6, textAlign: "center" },

  section: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.4, color: colors.muted, marginTop: 28, marginBottom: 14 },
  logCard: { padding: 18 },
  formRow: { flexDirection: "row", gap: 12 },
  formField: { flex: 1 },
  fieldLabel: { fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 0.8, color: colors.muted, marginBottom: 8 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: fonts.sans,
    fontSize: 14.5,
    color: colors.foreground,
  },
  logBtn: { borderRadius: 16, overflow: "hidden", marginTop: 16 },
  logBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  logBtnText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimary },
  logErrorText: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger, marginTop: 10 },

  logRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  logLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  logIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  logVal: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  logDate: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  logRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  logDelta: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.danger },

  comingSoon: { marginTop: 18, alignItems: "center", paddingVertical: 48, gap: 8 },
  comingTitle: { fontFamily: fonts.serifSemibold, fontSize: 20, color: colors.foreground, marginTop: 6 },
  comingDesc: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },

  galleryCard: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 18, padding: 18 },
  galleryIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryTitle: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  gallerySub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 3 },

  addPhotoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 14,
    padding: 18,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderStyle: "dashed",
    backgroundColor: colors.card,
  },
  addPhotoIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoTitle: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  addPhotoSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 3 },

  photosHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photosCount: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.primary },

  baRow: { flexDirection: "row", gap: 12 },
  baCard: {
    flex: 1,
    aspectRatio: 0.74,
    borderRadius: colors.radius,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  baImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  baLabel: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(16,17,17,0.7)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  baLabelAfter: { backgroundColor: colors.accentDeep },
  baLabelText: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.onPrimary },
  baOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 12,
  },
  baDate: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimary },
  baMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.accent, marginTop: 2 },

  timelineItem: { width: 92 },
  timelineImg: {
    width: 92,
    height: 116,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  timelineRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(16,17,17,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDate: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted, marginTop: 6, textAlign: "center" },
});
