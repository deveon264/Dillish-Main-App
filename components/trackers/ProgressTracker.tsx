import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Platform, ActionSheetIOS, Alert, Modal, Keyboard } from "react-native";
import { KeyboardAwareScrollView, KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { GradientBackground } from "@/components/GradientBackground";
import { useScrollDecor } from "@/components/BackgroundDecor";
import { MotionListItem } from "@/components/Motion";
import { useDataRefresh } from "@/hooks/useDataRefresh";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { SectionLabel } from "@/components/PageHeader";
import { InfoTip } from "@/components/InfoTip";
import { KeyboardFormToolbar } from "@/components/KeyboardFormToolbar";
import { ProgressBar } from "@/components/ProgressBar";
import { LineChart, LinePoint } from "@/components/LineChart";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

const TABS = [
  { key: "progress", label: "Progress", icon: "trending-up" as const },
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
const MAX_VISIBLE_LOGS = 5;

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

// The full Progress screen, now hosted inside the Tracker tab's "Progress"
// segment. It renders the shared header supplied by the parent (PageHeader +
// the Calories/Water/Progress toggle), then its own internal Progress / Photos
// sub-tabs and their content.
export function ProgressTracker({ header }: { header?: React.ReactNode }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();
  const { profile, weightLogs, progressPhotos, addWeight, removeWeight, addPhoto, removePhoto } =
    useData();
  const { refreshControl, scrollRef } = useDataRefresh();
  // Petal texture embedded in the scroll content so it moves with the page.
  const { decor, onContentSizeChange } = useScrollDecor();

  const [tab, setTab] = useState("progress");
  const [weightInput, setWeightInput] = useState("");
  const [dateInput, setDateInput] = useState(fmtDateInput(new Date()));
  const [logError, setLogError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [showAllRecentLogs, setShowAllRecentLogs] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [photoDateInput, setPhotoDateInput] = useState(fmtDateInput(new Date()));
  const [photoWeightInput, setPhotoWeightInput] = useState("");
  const [photoDetailsError, setPhotoDetailsError] = useState("");
  const weightInputRef = useRef<TextInput>(null);
  const dateInputRef = useRef<TextInput>(null);
  const photoWeightRef = useRef<TextInput>(null);

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
      haptics.warning();
      return;
    }
    const ts = parseDateInput(dateInput);
    if (ts == null) {
      setLogError("Enter a valid date (dd/mm/yyyy).");
      haptics.warning();
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
  const canExpandRecentLogs = sortedDesc.length > MAX_VISIBLE_LOGS;
  const visibleRecentLogs = showAllRecentLogs ? sortedDesc : sortedDesc.slice(0, MAX_VISIBLE_LOGS);
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
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setPendingPhotoUri(uri);
      setPhotoDateInput(fmtDateInput(new Date()));
      setPhotoWeightInput(current != null ? current.toFixed(1) : "");
      setPhotoDetailsError("");
    } catch {
      setPhotoError("Unable to open the camera or library on this device.");
      haptics.warning();
    }
  };

  const cancelPendingPhoto = () => {
    setPendingPhotoUri(null);
    setPhotoDateInput(fmtDateInput(new Date()));
    setPhotoWeightInput("");
    setPhotoDetailsError("");
  };

  const savePendingPhoto = async () => {
    if (!pendingPhotoUri) return;
    const ts = parseDateInput(photoDateInput);
    if (ts == null) {
      setPhotoDetailsError("Enter a valid photo date (dd/mm/yyyy).");
      haptics.warning();
      return;
    }
    const trimmedWeight = photoWeightInput.trim().replace(",", ".");
    const parsedWeight = trimmedWeight ? Number(trimmedWeight) : null;
    if (parsedWeight != null && (!Number.isFinite(parsedWeight) || parsedWeight <= 0)) {
      setPhotoDetailsError("Enter a valid positive weight, or leave it blank.");
      haptics.warning();
      return;
    }
    const weight = parsedWeight == null ? null : Math.round(parsedWeight * 10) / 10;
    try {
      await addPhoto(pendingPhotoUri, weight, ts);
      cancelPendingPhoto();
    } catch {
      setPhotoDetailsError("Couldn't save the photo. Storage may be full. Try removing older photos.");
      haptics.warning();
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

  const hasData = current != null;

  return (
    <GradientBackground showDecor={false}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={110}
        refreshControl={refreshControl}
        onContentSizeChange={onContentSizeChange}
      >
        {decor}
        {header}

        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const isActive = t.key === tab;
            return (
              <Pressable
                key={t.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => {
                  if (isActive) return;
                  haptics.selection();
                  setTab(t.key);
                }}
              >
                <Ionicons name={t.icon} size={15} color={isActive ? colors.onPrimaryStrong : colors.muted} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab !== "photos" ? (
          <>
            <Card style={styles.weightCard}>
              <View style={styles.cardHead}>
                <View style={styles.eyebrowRow}>
                  <Ionicons name="body-outline" size={14} color={colors.accent} />
                  <Text style={styles.cardEyebrow}>WEIGHT PROGRESS</Text>
                  <InfoTip
                    title="Weight Progress"
                    body="Your current weight next to your starting weight and goal. The badge is your total change since you started."
                  />
                </View>
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
                <View style={styles.eyebrowRow}>
                  <Ionicons name="analytics-outline" size={14} color={colors.accent} />
                  <Text style={styles.cardEyebrow}>WEIGHT OVER TIME</Text>
                  <InfoTip
                    title="Weight Over Time"
                    body="A chart of your logged weigh-ins over the last 4 weeks, with your goal marked, so you can spot your trend."
                  />
                </View>
                <Text style={styles.weekRange}>Last 4 weeks</Text>
              </View>
              {chartData.length >= 2 ? (
                <View style={{ marginTop: 18 }}>
                  <LineChart data={chartData} unit={unit} goal={goal} />
                </View>
              ) : (
                <View style={styles.chartEmpty}>
                  <Ionicons name="analytics-outline" size={30} color={colors.mutedForeground} />
                  <Text style={styles.chartEmptyText}>Log at least two weigh-ins to see your trend</Text>
                </View>
              )}
            </Card>

            <SectionLabel style={styles.section}>LOG WEIGHT</SectionLabel>
            <Card style={styles.logCard}>
              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>WEIGHT ({unit.toUpperCase()})</Text>
                  <TextInput
                    ref={weightInputRef}
                    value={weightInput}
                    onChangeText={setWeightInput}
                    placeholder="e.g. 62.4"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    style={styles.input}
                    returnKeyType="next"
                    onSubmitEditing={() => dateInputRef.current?.focus()}
                  />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>DATE</Text>
                  <TextInput
                    ref={dateInputRef}
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
                  <Ionicons name="add" size={20} color={colors.onPrimaryStrong} />
                  <Text style={styles.logBtnText}>Log Weight</Text>
                </LinearGradient>
              </Pressable>
            </Card>

            <SectionLabel style={styles.section}>RECENT LOGS</SectionLabel>
            {sortedDesc.length === 0 ? (
              <Card>
                <EmptyState
                  compact
                  icon="scale-outline"
                  title="No weigh-ins logged yet"
                  description="Add your first measurement to begin tracking your trend."
                  actionLabel="Enter weight"
                  onAction={() => weightInputRef.current?.focus()}
                />
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                {visibleRecentLogs.map((l, i) => {
                  const prev = sortedDesc[i + 1];
                  const delta = prev ? l.weight - prev.weight : null;
                  return (
                    <MotionListItem key={l.id}>
                    <Card style={styles.logRow}>
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
                        <Pressable
                          onPress={() => {
                            haptics.warning();
                            removeWeight(l.id);
                          }}
                          hitSlop={10}
                        >
                          <Ionicons name="close-circle-outline" size={22} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    </Card>
                    </MotionListItem>
                  );
                })}
                {canExpandRecentLogs ? (
                  <Pressable
                    style={styles.seeMoreButton}
                    onPress={() => setShowAllRecentLogs((current) => !current)}
                  >
                    <Text style={styles.seeMoreText}>{showAllRecentLogs ? "See less" : "See more"}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </>
        ) : (
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
              pressedScale={0.985}
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
              <Card style={{ marginTop: 18 }}>
                <EmptyState
                  compact
                  icon="images-outline"
                  title="No progress photos yet"
                  description="Add a photo now so you can see changes over time."
                  actionLabel="Add first photo"
                  onAction={pickProgressPhoto}
                />
              </Card>
            ) : (
              <>
                <View style={styles.photosHead}>
                  <SectionLabel style={styles.section}>BEFORE & AFTER</SectionLabel>
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

                <SectionLabel style={[styles.section, { marginTop: 22 }]}>PHOTO TIMELINE</SectionLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingVertical: 2 }}
                >
                  {sortedPhotos.map((p) => (
                    <MotionListItem key={p.id} style={styles.timelineItem}>
                      <Image source={{ uri: p.uri }} style={styles.timelineImg} contentFit="cover" />
                      <Pressable
                        onPress={() => {
                          haptics.warning();
                          removePhoto(p.id);
                        }}
                        hitSlop={8}
                        style={styles.timelineRemove}
                      >
                        <Ionicons name="close" size={14} color={colors.onPrimary} />
                      </Pressable>
                      <Text style={styles.timelineDate}>{fmtDay(new Date(p.ts))}</Text>
                      {p.weight != null ? (
                        <Text style={styles.timelineWeight}>
                          {p.weight.toFixed(1)} {unit}
                        </Text>
                      ) : null}
                    </MotionListItem>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        )}
      </KeyboardAwareScrollView>
      <Modal
        visible={pendingPhotoUri != null}
        transparent
        animationType="fade"
        onRequestClose={cancelPendingPhoto}
      >
        <KeyboardAvoidingView
          style={styles.modalAvoider}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.photoSheet}>
              <KeyboardAwareScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                bottomOffset={92}
                contentContainerStyle={styles.photoSheetContent}
              >
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>Photo Details</Text>
                    <Text style={styles.sheetSub}>Add the date and weight for this photo.</Text>
                  </View>
                  <Pressable onPress={cancelPendingPhoto} hitSlop={10} style={styles.sheetClose}>
                    <Ionicons name="close" size={18} color={colors.muted} />
                  </Pressable>
                </View>
                {pendingPhotoUri ? (
                  <Image source={{ uri: pendingPhotoUri }} style={styles.photoPreview} contentFit="cover" />
                ) : null}
                <View style={styles.formRow}>
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>DATE TAKEN</Text>
                    <TextInput
                      value={photoDateInput}
                      onChangeText={setPhotoDateInput}
                      placeholder="dd/mm/yyyy"
                      placeholderTextColor={colors.mutedForeground}
                      style={styles.input}
                      returnKeyType="next"
                      onSubmitEditing={() => photoWeightRef.current?.focus()}
                    />
                  </View>
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>WEIGHT ({unit.toUpperCase()})</Text>
                    <TextInput
                      ref={photoWeightRef}
                      value={photoWeightInput}
                      onChangeText={setPhotoWeightInput}
                      placeholder="Optional"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      style={styles.input}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </View>
                </View>
                {photoDetailsError ? <Text style={styles.logErrorText}>{photoDetailsError}</Text> : null}
                <View style={styles.sheetActions}>
                  <Pressable style={styles.cancelBtn} onPress={cancelPendingPhoto}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.savePhotoBtn} onPress={savePendingPhoto}>
                    <LinearGradient
                      colors={colors.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.savePhotoGrad}
                    >
                      <Text style={styles.savePhotoText}>Save</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </KeyboardAwareScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <KeyboardFormToolbar />
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
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
  tabLabelActive: { fontFamily: fonts.sansSemibold, color: colors.onPrimaryStrong },

  weightCard: { marginTop: 18, padding: 18 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  bigNum: { fontFamily: fonts.serifSemibold, fontSize: 44, color: colors.foreground },
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

  section: { marginTop: 28, marginBottom: 14 },
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
  logBtnText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimaryStrong },
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
  seeMoreButton: { alignSelf: "center", paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  seeMoreText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent },

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
  baLabelAfter: { backgroundColor: colors.accentDark },
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
  timelineWeight: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.accent, marginTop: 2, textAlign: "center" },
  modalAvoider: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(16,17,17,0.42)",
    padding: 18,
  },
  photoSheet: {
    backgroundColor: colors.background,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    maxHeight: "88%",
  },
  photoSheetContent: { paddingBottom: 2 },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
    marginBottom: 14,
  },
  sheetHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  sheetTitle: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground },
  sheetSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  photoPreview: {
    width: "100%",
    height: 210,
    borderRadius: 20,
    backgroundColor: colors.card,
    marginTop: 16,
    marginBottom: 16,
  },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    paddingVertical: 15,
  },
  cancelBtnText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.muted },
  savePhotoBtn: { flex: 1, borderRadius: 16, overflow: "hidden" },
  savePhotoGrad: { alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  savePhotoText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimaryStrong },
});
