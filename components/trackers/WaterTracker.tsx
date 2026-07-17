import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Bouncy } from "@/components/Bouncy";
import { GradientBackground } from "@/components/GradientBackground";
import { useScrollDecor } from "@/components/BackgroundDecor";
import { MotionListItem } from "@/components/Motion";
import { useDataRefresh } from "@/hooks/useDataRefresh";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { SectionLabel } from "@/components/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { BarChart, BarDatum } from "@/components/BarChart";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { todayKey } from "@/lib/storage";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics, waterAddFeedback } from "@/lib/haptics";

const QUICK = [
  { ml: 150, label: "Sip", icon: "water-outline" as const },
  { ml: 250, label: "Glass", icon: "water" as const },
  { ml: 400, label: "Bottle", icon: "water" as const },
  { ml: 500, label: "Large", icon: "water" as const },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE_LOGS = 5;

const fmtTime = (ts: number) => {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
};

const amountLabel = (ml: number) => {
  if (ml <= 150) return "Small glass";
  if (ml <= 250) return "Glass of water";
  if (ml <= 400) return "Water bottle";
  if (ml <= 600) return "Large bottle";
  return "Big refill";
};

export function WaterTracker({ header }: { header?: React.ReactNode }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();
  const { profile, waterLogs, addWater, removeWater } = useData();
  const { refreshControl, scrollRef } = useDataRefresh();
  // Petal texture embedded in the scroll content so it moves with the page.
  const { decor, onContentSizeChange } = useScrollDecor();

  const [custom, setCustom] = useState("");
  const [showAllTodayLogs, setShowAllTodayLogs] = useState(false);

  const tk = todayKey();
  const todayLogs = useMemo(
    () => waterLogs.filter((l) => todayKey(new Date(l.ts)) === tk),
    [waterLogs, tk]
  );
  const canExpandTodayLogs = todayLogs.length > MAX_VISIBLE_LOGS;
  const visibleTodayLogs = showAllTodayLogs ? todayLogs : todayLogs.slice(0, MAX_VISIBLE_LOGS);
  const todayTotal = todayLogs.reduce((s, l) => s + l.amountMl, 0);
  const goal = profile.waterGoalMl || 2500;
  const pct = Math.min(1, todayTotal / goal);
  const remaining = Math.max(0, goal - todayTotal);
  const waterTotalRef = useRef(todayTotal);
  useEffect(() => {
    waterTotalRef.current = todayTotal;
  }, [todayTotal]);

  const logWater = (amountMl: number) => {
    const currentMl = waterTotalRef.current;
    waterTotalRef.current = currentMl + amountMl;
    void addWater(amountMl);
    haptics[waterAddFeedback(currentMl, amountMl, goal)]();
  };

  const dateStr = useMemo(() => {
    const d = new Date();
    return `${d.toLocaleDateString("en-US", { weekday: "short" })}, ${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`;
  }, []);

  const weekly: BarDatum[] = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const day = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - day);
    return DAY_LABELS.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = todayKey(d);
      const total = waterLogs.filter((l) => todayKey(new Date(l.ts)) === key).reduce((s, l) => s + l.amountMl, 0);
      return { label, value: Math.round(total / 1000 * 10) / 10 };
    });
  }, [waterLogs]);

  const weekRange = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const day = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sameMonth = monday.getMonth() === sunday.getMonth();
    return sameMonth
      ? `${M[monday.getMonth()]} ${monday.getDate()} – ${sunday.getDate()}`
      : `${M[monday.getMonth()]} ${monday.getDate()} – ${M[sunday.getMonth()]} ${sunday.getDate()}`;
  }, []);

  const addCustom = () => {
    const ml = parseInt(custom, 10);
    if (ml && ml > 0) {
      logWater(ml);
      setCustom("");
    }
  };

  return (
    <GradientBackground showDecor={false}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={88}
        refreshControl={refreshControl}
        onContentSizeChange={onContentSizeChange}
      >
        {decor}
        {header}

        <Card style={styles.hydrationCard}>
              <View style={styles.hydrationHead}>
                <View style={styles.eyebrowRow}>
                  <Ionicons name="water-outline" size={14} color={colors.water} />
                  <Text style={styles.hydrationEyebrow}>TODAY'S HYDRATION</Text>
                </View>
                <View style={styles.dateChip}>
                  <Ionicons name="calendar-outline" size={13} color={colors.muted} />
                  <Text style={styles.dateText}>{dateStr}</Text>
                </View>
              </View>
              <View style={styles.hydrationBody}>
                <View style={styles.dropWrap}>
                  <WaterGlass progress={pct} />
                  <View style={[styles.dropOverlay, { pointerEvents: "none" }]}>
                    <AnimatedNumber value={todayTotal / 1000} formatter={(n) => `${n.toFixed(1)}L`} style={styles.dropL} />
                    <Text style={styles.dropOf}>of {(goal / 1000).toFixed(1)}L</Text>
                  </View>
                </View>
                <View style={styles.hydrationInfo}>
                  <View style={styles.bigRow}>
                    <AnimatedNumber value={todayTotal} style={styles.bigNum} />
                    <Text style={styles.bigUnit}> / {goal.toLocaleString()} ml</Text>
                  </View>
                  <Text style={styles.subInfo}>
                    <AnimatedNumber value={remaining} style={styles.subInfoValue} /> ml remaining · <AnimatedNumber value={pct * 100} formatter={(n) => `${Math.round(n)}%`} style={styles.subInfoValue} />
                  </Text>
                  <ProgressBar progress={pct} height={8} color={colors.water} style={{ marginTop: 14 }} />
                </View>
              </View>
            </Card>

            <SectionLabel style={styles.section}>QUICK ADD</SectionLabel>
            <View style={styles.quickRow}>
              {QUICK.map((q) => (
                <Bouncy key={q.ml} style={styles.quick} onPress={() => logWater(q.ml)}>
                  <View style={styles.quickIcon}>
                    <Ionicons name={q.icon} size={20} color={colors.water} />
                  </View>
                  <Text style={styles.quickMl}>{q.ml}ml</Text>
                  <Text style={styles.quickLabel}>{q.label}</Text>
                </Bouncy>
              ))}
            </View>

            <View style={styles.customRow}>
              <View style={styles.customInputWrap}>
                <Ionicons name="water-outline" size={18} color={colors.water} />
                <TextInput
                  value={custom}
                  onChangeText={setCustom}
                  placeholder="Custom amount (ml)"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  style={styles.customInput}
                  returnKeyType="done"
                  onSubmitEditing={addCustom}
                />
              </View>
              <Bouncy style={styles.addBtn} onPress={addCustom}>
                <LinearGradient
                  colors={colors.waterGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addBtnGrad}
                >
                  <Ionicons name="add" size={24} color={colors.onPrimaryStrong} />
                </LinearGradient>
              </Bouncy>
            </View>

            <Card style={{ marginTop: 24 }}>
              <View style={styles.weekHead}>
                <Text style={styles.weekEyebrow}>WEEKLY HYDRATION</Text>
                <Text style={styles.weekRange}>{weekRange}</Text>
              </View>
              <View style={{ marginTop: 18 }}>
                <BarChart data={weekly} goal={goal / 1000} unit="L" fillColors={colors.waterGradient} trackColors={["#DDEBF3", "#C7DEEC"]} />
              </View>
            </Card>

            <View style={styles.logHead}>
              <Text style={styles.logHeadTitle}>TODAY'S LOG</Text>
              {todayLogs.length > 0 ? (
                <Text style={styles.entryCount}>
                  {todayLogs.length} {todayLogs.length === 1 ? "entry" : "entries"}
                </Text>
              ) : null}
            </View>
            {todayLogs.length === 0 ? (
              <Card>
                <EmptyState
                  compact
                  icon="water-outline"
                  title="No water logged yet"
                  description="Start today's hydration log with a regular glass."
                  actionLabel="Add 250 ml"
                  onAction={() => logWater(250)}
                />
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                {visibleTodayLogs.map((l) => (
                  <MotionListItem key={l.id}>
                  <Card style={styles.logRow}>
                    <View style={styles.logLeft}>
                      <View style={styles.logIcon}>
                        <Ionicons name="water" size={18} color={colors.water} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.logMl}>{l.amountMl} ml</Text>
                        <Text style={styles.logLabel}>{amountLabel(l.amountMl)}</Text>
                      </View>
                    </View>
                    <View style={styles.logRight}>
                      <Text style={styles.logTime}>{fmtTime(l.ts)}</Text>
                      <Bouncy
                        onPress={() => {
                          haptics.warning();
                          waterTotalRef.current = Math.max(0, waterTotalRef.current - l.amountMl);
                          removeWater(l.id);
                        }}
                        hitSlop={10}
                      >
                        <Ionicons name="close-circle-outline" size={22} color={colors.mutedForeground} />
                      </Bouncy>
                    </View>
                  </Card>
                  </MotionListItem>
                ))}
                {canExpandTodayLogs ? (
                  <Bouncy
                    style={styles.seeMoreButton}
                    onPress={() => setShowAllTodayLogs((current) => !current)}
                  >
                    <Text style={styles.seeMoreText}>{showAllTodayLogs ? "See less" : "See more"}</Text>
                  </Bouncy>
                ) : null}
              </View>
            )}
      </KeyboardAwareScrollView>
    </GradientBackground>
  );
}

function WaterGlass({ progress }: { progress: number }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const clamped = Math.max(0, Math.min(1, progress));
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(clamped, { duration: 280, reduceMotion: ReduceMotion.System });
  }, [clamped, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${fill.value * 100}%`,
    opacity: fill.value > 0.001 ? 1 : 0,
  }));

  return (
    <View style={styles.glass}>
      <Animated.View style={[styles.glassFill, fillStyle]}>
        <View style={styles.glassFlowSoft} />
        <View style={styles.glassFlow} />
        <View style={styles.glassWaveBack} />
        <View style={styles.glassWave} />
        <View style={styles.glassMeniscus} />
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  hydrationCard: { marginTop: 18, padding: 18 },
  hydrationHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hydrationEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.2, color: colors.water },
  dateChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
  hydrationBody: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  dropWrap: { width: 92, height: 118, alignItems: "center", justifyContent: "center" },
  glass: {
    width: 72,
    height: 108,
    borderWidth: 2.5,
    borderColor: colors.water,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: "hidden",
    backgroundColor: colors.waterTint,
    justifyContent: "flex-end",
  },
  glassFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.water,
    overflow: "visible",
  },
  glassFlow: {
    position: "absolute",
    left: -18,
    right: -18,
    bottom: 20,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.48)",
  },
  glassFlowSoft: {
    position: "absolute",
    left: -24,
    right: -24,
    bottom: 44,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(231,240,246,0.5)",
  },
  glassWave: {
    position: "absolute",
    top: -9,
    left: -24,
    width: 120,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  glassWaveBack: {
    position: "absolute",
    top: -12,
    left: -16,
    width: 104,
    height: 20,
    borderRadius: 999,
    backgroundColor: "rgba(168,203,224,0.58)",
  },
  glassMeniscus: {
    position: "absolute",
    top: -1,
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.62)",
  },
  dropOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingTop: 10 },
  dropL: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
  dropOf: { fontFamily: fonts.sans, fontSize: 11, color: "rgba(16,17,17,0.85)", marginTop: -2 },
  hydrationInfo: { flex: 1, paddingLeft: 6 },
  bigRow: { flexDirection: "row", alignItems: "baseline" },
  bigNum: { fontFamily: fonts.sansBold, fontSize: 34, color: colors.foreground },
  bigUnit: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted },
  subInfo: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, marginTop: 2 },
  subInfoValue: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted },
  section: { marginTop: 28, marginBottom: 14 },
  quickRow: { flexDirection: "row", gap: 10 },
  quick: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingVertical: 16,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.waterTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickMl: { fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.foreground },
  quickLabel: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted, marginTop: 1 },
  customRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  customInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  customInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14.5, color: colors.foreground, padding: 0 },
  addBtn: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: colors.water,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  addBtnGrad: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.foreground },
  weekHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.2, color: colors.muted },
  weekRange: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: 10 },
  logRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  logLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  logIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.waterTint,
    alignItems: "center",
    justifyContent: "center",
  },
  logMl: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  logLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  logRight: { alignItems: "flex-end", justifyContent: "center", gap: 6, marginLeft: 12 },
  logTime: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, textAlign: "right" },
  logHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 14,
  },
  logHeadTitle: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 2, color: colors.muted },
  entryCount: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.water },
  seeMoreButton: { alignSelf: "center", paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  seeMoreText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent },
});
