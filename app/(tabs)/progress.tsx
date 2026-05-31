import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
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

export default function Progress() {
  const insets = useInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { completions } = useData();

  const [tab, setTab] = useState("progress");

  const firstName = (user?.name ?? "there").split(" ")[0];

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

  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

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
            const isActive = t.key === tab;
            return (
              <Pressable key={t.key} style={[styles.tab, isActive && styles.tabActive]} onPress={() => setTab(t.key)}>
                <Ionicons name={t.icon} size={15} color={isActive ? colors.onPrimary : colors.muted} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Card style={styles.comingSoon}>
          <Ionicons name={active.icon} size={34} color={colors.accent} />
          <Text style={styles.comingTitle}>{active.label}</Text>
          <Text style={styles.comingDesc}>Coming soon</Text>
        </Card>
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
  comingSoon: { marginTop: 18, alignItems: "center", paddingVertical: 48, gap: 8 },
  comingTitle: { fontFamily: fonts.serifSemibold, fontSize: 20, color: colors.foreground, marginTop: 6 },
  comingDesc: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
});
