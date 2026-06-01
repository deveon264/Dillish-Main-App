import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { HelpButton } from "@/components/HelpButton";
import { WaterCircle } from "@/components/WaterCircle";
import { ProgressBar } from "@/components/ProgressBar";
import { BarChart, BarDatum } from "@/components/BarChart";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { todayKey } from "@/lib/storage";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const QUICK = [
  { ml: 150, label: "Sip", icon: "water-outline" as const },
  { ml: 250, label: "Glass", icon: "water" as const },
  { ml: 400, label: "Bottle", icon: "water" as const },
  { ml: 500, label: "Large", icon: "water" as const },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

export default function Water() {
  const insets = useInsets();
  const { profile, waterLogs, addWater, removeWater } = useData();

  const [custom, setCustom] = useState("");

  const tk = todayKey();
  const todayLogs = useMemo(
    () => waterLogs.filter((l) => todayKey(new Date(l.ts)) === tk),
    [waterLogs, tk]
  );
  const todayTotal = todayLogs.reduce((s, l) => s + l.amountMl, 0);
  const goal = profile.waterGoalMl || 2500;
  const pct = Math.min(1, todayTotal / goal);
  const remaining = Math.max(0, goal - todayTotal);

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
      addWater(ml);
      setCustom("");
    }
  };

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
              Stay <Text style={styles.titleItalic}>Hydrated</Text>
            </Text>
          </View>
          <HelpButton
            title="Stay Hydrated"
            intro="Keep your water intake on track every day."
            points={[
              "Log each glass with a tap as you drink through the day.",
              "Watch your progress fill toward your daily hydration goal.",
              "Switch days to review how well you stayed hydrated before.",
            ]}
          />
        </View>

        <Card style={styles.hydrationCard}>
              <View style={styles.hydrationHead}>
                <Text style={styles.hydrationEyebrow}>TODAY'S HYDRATION</Text>
                <View style={styles.dateChip}>
                  <Ionicons name="calendar-outline" size={13} color={colors.muted} />
                  <Text style={styles.dateText}>{dateStr}</Text>
                </View>
              </View>
              <View style={styles.hydrationBody}>
                <View style={styles.dropWrap}>
                  <WaterCircle size={110} progress={pct} />
                  <View style={[styles.dropOverlay, { pointerEvents: "none" }]}>
                    <Text style={styles.dropL}>{(todayTotal / 1000).toFixed(1)}L</Text>
                    <Text style={styles.dropOf}>of {(goal / 1000).toFixed(1)}L</Text>
                  </View>
                </View>
                <View style={styles.hydrationInfo}>
                  <View style={styles.bigRow}>
                    <Text style={styles.bigNum}>{todayTotal.toLocaleString()}</Text>
                    <Text style={styles.bigUnit}> / {goal.toLocaleString()} ml</Text>
                  </View>
                  <Text style={styles.subInfo}>
                    {remaining.toLocaleString()} ml remaining · {Math.round(pct * 100)}%
                  </Text>
                  <ProgressBar progress={pct} height={8} style={{ marginTop: 14 }} />
                </View>
              </View>
            </Card>

            <Text style={styles.section}>QUICK ADD</Text>
            <View style={styles.quickRow}>
              {QUICK.map((q) => (
                <Pressable key={q.ml} style={styles.quick} onPress={() => addWater(q.ml)}>
                  <View style={styles.quickIcon}>
                    <Ionicons name={q.icon} size={20} color={colors.accent} />
                  </View>
                  <Text style={styles.quickMl}>{q.ml}ml</Text>
                  <Text style={styles.quickLabel}>{q.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.customRow}>
              <View style={styles.customInputWrap}>
                <Ionicons name="water-outline" size={18} color={colors.muted} />
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
              <Pressable style={styles.addBtn} onPress={addCustom}>
                <LinearGradient
                  colors={colors.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addBtnGrad}
                >
                  <Ionicons name="add" size={24} color={colors.onPrimary} />
                </LinearGradient>
              </Pressable>
            </View>

            <Card style={{ marginTop: 24 }}>
              <View style={styles.weekHead}>
                <Text style={styles.weekEyebrow}>WEEKLY HYDRATION</Text>
                <Text style={styles.weekRange}>{weekRange}</Text>
              </View>
              <View style={{ marginTop: 18 }}>
                <BarChart data={weekly} goal={goal / 1000} unit="L" />
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
              <Card style={{ alignItems: "center", paddingVertical: 28 }}>
                <Ionicons name="water-outline" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>No water logged yet today</Text>
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                {todayLogs.map((l) => (
                  <Card key={l.id} style={styles.logRow}>
                    <View style={styles.logLeft}>
                      <View style={styles.logIcon}>
                        <Ionicons name="water" size={18} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.logMl}>{l.amountMl} ml</Text>
                        <Text style={styles.logLabel}>{amountLabel(l.amountMl)}</Text>
                      </View>
                    </View>
                    <View style={styles.logRight}>
                      <Text style={styles.logTime}>{fmtTime(l.ts)}</Text>
                      <Pressable onPress={() => removeWater(l.id)} hitSlop={10}>
                        <Ionicons name="close-circle-outline" size={22} color={colors.mutedForeground} />
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

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.6, color: colors.muted },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.foreground, marginTop: 2 },
  titleItalic: { fontFamily: fonts.serifItalic, color: colors.foreground },
  hydrationCard: { marginTop: 18, padding: 18 },
  hydrationHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hydrationEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.2, color: colors.muted },
  dateChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
  hydrationBody: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  dropWrap: { width: 110, height: 110, alignItems: "center", justifyContent: "center" },
  dropOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingTop: 22 },
  dropL: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
  dropOf: { fontFamily: fonts.sans, fontSize: 11, color: "rgba(58,22,32,0.85)", marginTop: -2 },
  hydrationInfo: { flex: 1, paddingLeft: 6 },
  bigRow: { flexDirection: "row", alignItems: "baseline" },
  bigNum: { fontFamily: fonts.sansBold, fontSize: 34, color: colors.foreground },
  bigUnit: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted },
  subInfo: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, marginTop: 2 },
  section: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.4, color: colors.muted, marginTop: 28, marginBottom: 14 },
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
    backgroundColor: "rgba(233,75,114,0.10)",
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
  addBtn: { borderRadius: 16, overflow: "hidden" },
  addBtnGrad: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.foreground },
  weekHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.4, color: colors.muted },
  weekRange: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: 10 },
  logRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  logLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  logIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(233,75,114,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  logMl: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  logLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  logRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  logTime: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  logHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 14,
  },
  logHeadTitle: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.4, color: colors.muted },
  entryCount: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.primary },
});
