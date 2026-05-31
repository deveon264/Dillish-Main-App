import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { WaterCircle } from "@/components/WaterCircle";
import { ProgressBar } from "@/components/ProgressBar";
import { BarChart, BarDatum } from "@/components/BarChart";
import { useAuth } from "@/contexts/AuthContext";
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

const TABS = [
  { key: "water", label: "Water", icon: "water" as const },
  { key: "progress", label: "Progress", icon: "trending-up" as const },
  { key: "bmi", label: "BMI", icon: "body-outline" as const },
  { key: "photos", label: "Photos", icon: "images-outline" as const },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Water() {
  const insets = useInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { profile, waterLogs, completions, addWater, removeWater } = useData();

  const [tab, setTab] = useState("water");
  const [custom, setCustom] = useState("");

  const firstName = (user?.name ?? "there").split(" ")[0];

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

  const completionDays = useMemo(() => {
    const set = new Set<string>();
    completions.forEach((c) => set.add(todayKey(new Date(c.ts))));
    return set;
  }, [completions]);

  const streak = useMemo(() => {
    let count = 0;
    const d = new Date();
    if (!completionDays.has(todayKey(d))) d.setDate(d.getDate() - 1);
    while (completionDays.has(todayKey(d))) {
      count += 1;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [completionDays]);

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
              Water & <Text style={styles.titleItalic}>Progress</Text>
            </Text>
          </View>
          <View style={styles.streakPill}>
            <Text style={styles.streakFlame}>🔥</Text>
            <Text style={styles.streakNum}>{streak}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
          <Pressable style={styles.avatar} onPress={() => router.navigate("/(tabs)/profile")}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>

        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Pressable key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t.key)}>
                <Ionicons name={t.icon} size={15} color={active ? colors.onPrimary : colors.muted} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === "water" ? (
          <>
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
              <Text style={styles.cardTitle}>This week</Text>
              <View style={{ marginTop: 16, alignItems: "center" }}>
                <BarChart data={weekly} goal={goal / 1000} unit="L" />
              </View>
            </Card>

            <Text style={styles.section}>TODAY'S LOG</Text>
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
                      <View>
                        <Text style={styles.logMl}>{l.amountMl} ml</Text>
                        <Text style={styles.logTime}>
                          {new Date(l.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
                    </View>
                    <Pressable onPress={() => removeWater(l.id)} hitSlop={10}>
                      <Ionicons name="close-circle-outline" size={22} color={colors.mutedForeground} />
                    </Pressable>
                  </Card>
                ))}
              </View>
            )}
          </>
        ) : (
          <Card style={styles.comingSoon}>
            <Ionicons
              name={TABS.find((t) => t.key === tab)?.icon ?? "sparkles"}
              size={34}
              color={colors.accent}
            />
            <Text style={styles.comingTitle}>{TABS.find((t) => t.key === tab)?.label}</Text>
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
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  streakFlame: { fontSize: 13 },
  streakNum: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.foreground },
  streakLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(242,212,204,0.12)",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.accent },
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
  hydrationCard: { marginTop: 18, padding: 18 },
  hydrationHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hydrationEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.2, color: colors.muted },
  dateChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
  hydrationBody: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  dropWrap: { width: 110, height: 110, alignItems: "center", justifyContent: "center" },
  dropOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingTop: 22 },
  dropL: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
  dropOf: { fontFamily: fonts.sans, fontSize: 11, color: "rgba(247,235,232,0.85)", marginTop: -2 },
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
    backgroundColor: "rgba(242,212,204,0.10)",
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
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: 10 },
  logRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  logLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  logIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(242,212,204,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  logMl: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  logTime: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
  comingSoon: { marginTop: 18, alignItems: "center", paddingVertical: 48, gap: 8 },
  comingTitle: { fontFamily: fonts.serifSemibold, fontSize: 20, color: colors.foreground, marginTop: 6 },
  comingDesc: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
});
