import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Bouncy } from "@/components/Bouncy";
import { GradientBackground } from "@/components/GradientBackground";
import { useScrollDecor } from "@/components/BackgroundDecor";
import { MotionListItem } from "@/components/Motion";
import { useDataRefresh } from "@/hooks/useDataRefresh";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { SectionLabel } from "@/components/PageHeader";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { todayKey } from "@/lib/storage";
import { buildHydrationWeek } from "@/lib/hydrationWeek";
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

// Millilitres -> compact litres for the weekly axis ("2500" -> "2.5").
const fmtLitres = (ml: number) => Number((ml / 1000).toFixed(2)).toString();

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

  // Running total at the moment each entry was logged. waterLogs is newest-first,
  // so the total "then" for row i is the sum of that entry and every older one.
  const runningById = useMemo(() => {
    const map = new Map<string, number>();
    let suffix = 0;
    for (let i = todayLogs.length - 1; i >= 0; i--) {
      suffix += todayLogs[i].amountMl;
      map.set(todayLogs[i].id, suffix);
    }
    return map;
  }, [todayLogs]);

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

  const week = useMemo(() => buildHydrationWeek(waterLogs, goal), [waterLogs, goal]);

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
            <WaterGlass progress={pct} />
            <View style={styles.hydrationInfo}>
              <View style={styles.bigRow}>
                <AnimatedNumber value={todayTotal} style={styles.bigNum} />
                <Text style={styles.bigUnit}> / {goal.toLocaleString()} ml</Text>
              </View>
              <Text style={styles.subInfo}>
                <AnimatedNumber value={remaining} style={styles.subInfoValue} /> ml left ·{" "}
                <AnimatedNumber value={pct * 100} formatter={(n) => `${Math.round(n)}%`} style={styles.subInfoValue} />
              </Text>
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
            <Text style={styles.weekRange}>{week.range}</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statChip}>
              <Text style={styles.statVal}>
                {(week.dailyAvgMl / 1000).toFixed(1)}
                <Text style={styles.statUnit}>L</Text>
              </Text>
              <Text style={styles.statLabel}>Daily avg</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statVal}>
                {week.goalDays}
                <Text style={styles.statUnitMuted}>/7</Text>
              </Text>
              <Text style={styles.statLabel}>Goal days</Text>
            </View>
            <View style={[styles.statChip, styles.statChipPink]}>
              <Text style={styles.statValPink}>{week.streak}</Text>
              <Text style={styles.statLabel}>Day streak</Text>
            </View>
          </View>

          <View style={styles.weekChartRow}>
            {/* Y axis: full track height = the daily goal, so the top tick is
                the goal itself. Litres, goal/half/zero. */}
            <View style={styles.weekYAxis}>
              <Text style={styles.weekAxisUnit}>litres</Text>
              <View style={styles.weekYTicks}>
                <View style={styles.weekYTickTop}>
                  <Text style={styles.weekYTick}>{fmtLitres(goal)}</Text>
                  <Text style={styles.weekYGoalTag}>goal</Text>
                </View>
                <Text style={styles.weekYTick}>{fmtLitres(goal / 2)}</Text>
                <Text style={styles.weekYTick}>0</Text>
              </View>
            </View>

            <View style={styles.weekPlot}>
              {/* Matches the y-axis unit label's height so ticks align with the bars. */}
              <View style={styles.weekPlotSpacer} />
              <View style={styles.weekBars}>
                {week.days.map((d, i) => {
                  const fillPct = goal > 0 ? Math.min(1, d.totalMl / goal) : 0;
                  return (
                    <View
                      key={d.label + i}
                      style={styles.weekBarCol}
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel={`${d.label} ${d.dayOfMonth}: ${(d.totalMl / 1000).toFixed(2)} L of ${fmtLitres(goal)} L goal${d.isToday ? ", today" : ""}`}
                    >
                      <View style={[styles.weekTrack, d.isToday && styles.weekTrackToday]}>
                        <LinearGradient
                          colors={colors.waterGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={[styles.weekFill, { height: `${Math.max(fillPct * 100, fillPct > 0 ? 6 : 0)}%` }]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.weekLabels}>
                {week.days.map((d, i) => (
                  <View key={d.label + i} style={styles.weekLabelCol}>
                    <Text style={[styles.weekLabel, d.isToday && styles.weekLabelToday]}>{d.label}</Text>
                    <Text style={[styles.weekLabelDate, d.isToday && styles.weekLabelToday]}>{d.dayOfMonth}</Text>
                  </View>
                ))}
              </View>
            </View>
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
              title="No water logged yet today"
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
                      <Text style={styles.logMl}>+{l.amountMl} ml</Text>
                      <Text style={styles.logLabel}>{((runningById.get(l.id) ?? l.amountMl) / 1000).toFixed(2)} L total</Text>
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

// Vessel dimensions, kept together so the cap, ticks and surface stay in proportion.
const GLASS_W = 76;
const GLASS_H = 152;

// The vessel fills and "pops" on each log, but deliberately carries no continuous
// decorative loop (see phase-5 polish): the water surface is a static layered
// highlight rather than an animated wave.
function WaterGlass({ progress }: { progress: number }) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const clamped = Math.max(0, Math.min(1, progress));
  const fill = useSharedValue(0);
  const pop = useSharedValue(1);
  const prev = useRef(0);

  useEffect(() => {
    if (clamped > prev.current + 0.0001) {
      pop.value = withSequence(
        withTiming(1.04, { duration: 180, reduceMotion: ReduceMotion.System }),
        withTiming(1, { duration: 320, reduceMotion: ReduceMotion.System })
      );
    }
    prev.current = clamped;
    fill.value = withTiming(clamped, {
      duration: 900,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      reduceMotion: ReduceMotion.System,
    });
  }, [clamped, fill, pop]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${fill.value * 100}%`,
    opacity: fill.value > 0.001 ? 1 : 0,
  }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={[styles.vesselWrap, popStyle]}>
      <View style={styles.cap} />
      <View style={styles.glass}>
        <Animated.View style={[styles.glassFill, fillStyle]}>
          <LinearGradient
            colors={colors.waterGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.crestBack} />
          <View style={styles.crestFront} />
          <View style={styles.meniscus} />
        </Animated.View>
        <View style={[styles.tick, { top: "34%", width: 9 }]} />
        <View style={[styles.tick, { top: "50%", width: 13 }]} />
        <View style={[styles.tick, { top: "66%", width: 9 }]} />
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  hydrationCard: { marginTop: 18, padding: 20 },
  hydrationHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hydrationEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.2, color: colors.water },
  dateChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
  hydrationBody: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 18 },

  vesselWrap: { width: GLASS_W, height: GLASS_H, alignItems: "center", justifyContent: "flex-end" },
  cap: {
    position: "absolute",
    top: -8,
    width: 30,
    height: 14,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.waterTint,
    borderWidth: 2,
    borderColor: colors.water,
    borderBottomWidth: 0,
    zIndex: 2,
  },
  glass: {
    width: GLASS_W,
    height: GLASS_H,
    borderWidth: 2.5,
    borderColor: colors.water,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
    backgroundColor: colors.waterTint,
    justifyContent: "flex-end",
  },
  glassFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  crestBack: {
    position: "absolute",
    top: -9,
    left: -16,
    right: -16,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  crestFront: {
    position: "absolute",
    top: -6,
    left: -10,
    right: -10,
    height: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  meniscus: {
    position: "absolute",
    top: -1,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  tick: { position: "absolute", left: 0, height: 2, backgroundColor: colors.water, opacity: 0.3 },

  hydrationInfo: { flex: 1, minWidth: 0 },
  bigRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" },
  bigNum: { fontFamily: fonts.serifSemibold, fontSize: 40, color: colors.foreground },
  bigUnit: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  subInfo: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 5 },
  subInfoValue: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },

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

  weekHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.2, color: colors.muted },
  weekRange: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },

  statRow: { flexDirection: "row", gap: 9, marginTop: 16 },
  statChip: { flex: 1, backgroundColor: colors.waterTint, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 12 },
  statChipPink: { backgroundColor: colors.accentTint },
  statVal: { fontFamily: fonts.serifSemibold, fontSize: 21, color: colors.water },
  statValPink: { fontFamily: fonts.serifSemibold, fontSize: 21, color: colors.accent },
  statUnit: { fontFamily: fonts.serifSemibold, fontSize: 12, color: colors.water },
  statUnitMuted: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  statLabel: { fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.muted, marginTop: 3 },

  weekChartRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  weekYAxis: { width: 34, alignItems: "flex-end" },
  weekAxisUnit: {
    fontFamily: fonts.sansSemibold,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.4,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  weekYTicks: { height: 96, justifyContent: "space-between", alignItems: "flex-end" },
  weekYTickTop: { alignItems: "flex-end" },
  weekYTick: { fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.mutedForeground },
  weekYGoalTag: { fontFamily: fonts.sansBold, fontSize: 8, color: colors.water, marginTop: 1 },
  weekPlot: { flex: 1, minWidth: 0 },
  weekPlotSpacer: { height: 17 },
  weekBars: { flexDirection: "row", gap: 8, alignItems: "flex-end", height: 96 },
  weekBarCol: { flex: 1, alignItems: "center", height: "100%" },
  weekTrack: {
    width: "100%",
    maxWidth: 26,
    height: "100%",
    borderRadius: 10,
    backgroundColor: colors.track,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  weekTrackToday: {
    backgroundColor: colors.waterTint,
    borderWidth: 2,
    borderColor: colors.water,
  },
  weekFill: { width: "100%", borderRadius: 10 },
  weekLabels: { flexDirection: "row", gap: 8, marginTop: 8 },
  weekLabelCol: { flex: 1, alignItems: "center", gap: 1 },
  weekLabel: { fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.mutedForeground },
  weekLabelDate: { fontFamily: fonts.sans, fontSize: 9, color: colors.mutedForeground },
  weekLabelToday: { color: colors.water, fontFamily: fonts.sansBold },

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
