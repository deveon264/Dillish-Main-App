import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { WaterDroplet } from "@/components/WaterDroplet";
import { BarChart, BarDatum } from "@/components/BarChart";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { todayKey } from "@/lib/storage";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const QUICK = [
  { ml: 250, label: "Glass" },
  { ml: 500, label: "Bottle" },
  { ml: 750, label: "Large" },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Water() {
  const insets = useInsets();
  const { profile, waterLogs, addWater, removeWater } = useData();

  const tk = todayKey();
  const todayLogs = useMemo(
    () => waterLogs.filter((l) => todayKey(new Date(l.ts)) === tk),
    [waterLogs, tk]
  );
  const todayTotal = todayLogs.reduce((s, l) => s + l.amountMl, 0);
  const pct = Math.min(1, todayTotal / profile.waterGoalMl);

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

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Hydration</Text>
        <Text style={styles.subtitle}>Sip by sip, you're glowing.</Text>

        <View style={styles.heroCard}>
          <WaterDroplet size={150} progress={pct} />
          <View style={styles.heroInfo}>
            <Text style={styles.heroValue}>{(todayTotal / 1000).toFixed(2)}<Text style={styles.heroUnit}>L</Text></Text>
            <Text style={styles.heroGoal}>of {(profile.waterGoalMl / 1000).toFixed(1)}L goal</Text>
            <View style={styles.heroPctBadge}>
              <Text style={styles.heroPctText}>{Math.round(pct * 100)}% complete</Text>
            </View>
          </View>
        </View>

        <Text style={styles.section}>Add water</Text>
        <View style={styles.quickRow}>
          {QUICK.map((q) => (
            <Pressable key={q.ml} style={styles.quick} onPress={() => addWater(q.ml)}>
              <View style={styles.quickIcon}>
                <Ionicons name="water" size={22} color={colors.accent} />
              </View>
              <Text style={styles.quickMl}>{q.ml}ml</Text>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        <Card style={{ marginTop: 24 }}>
          <Text style={styles.cardTitle}>This week</Text>
          <View style={{ marginTop: 16, alignItems: "center" }}>
            <BarChart data={weekly} goal={profile.waterGoalMl / 1000} unit="L" />
          </View>
        </Card>

        <Text style={styles.section}>Today's log</Text>
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
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  title: { fontFamily: fonts.serif, fontSize: 36, color: colors.foreground },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 4 },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 20,
    marginTop: 20,
  },
  heroInfo: { flex: 1, alignItems: "flex-start" },
  heroValue: { fontFamily: fonts.serifSemibold, fontSize: 46, color: colors.foreground },
  heroUnit: { fontFamily: fonts.serif, fontSize: 26, color: colors.muted },
  heroGoal: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: -4 },
  heroPctBadge: {
    backgroundColor: "rgba(242,212,204,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  heroPctText: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.accent },
  section: { fontFamily: fonts.serif, fontSize: 22, color: colors.foreground, marginTop: 28, marginBottom: 14 },
  quickRow: { flexDirection: "row", gap: 12 },
  quick: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    paddingVertical: 18,
  },
  quickIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(242,212,204,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickMl: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  quickLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
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
});
