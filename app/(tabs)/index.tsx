import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { ProgressRing } from "@/components/ProgressRing";
import { ProgressBar } from "@/components/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { WORKOUTS } from "@/constants/workouts";
import { todayKey } from "@/lib/storage";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const QUICK_ACCESS = [
  { icon: "barbell-outline" as const, title: "Workout Library", sub: "200+ videos", route: "/(tabs)/workouts" as const },
  { icon: "scan-outline" as const, title: "AI Food Log", sub: "Snap & track", route: "/(tabs)/calories" as const },
  { icon: "water-outline" as const, title: "Hydration", sub: "Track your intake", route: "/(tabs)/water" as const },
  { icon: "stats-chart-outline" as const, title: "My Progress", sub: "Photos & stats", route: "/(tabs)/progress" as const },
];

const WATER_QUICK = [250, 500, 750];

export default function Dashboard() {
  const router = useRouter();
  const insets = useInsets();
  const { user } = useAuth();
  const { profile, waterLogs, calorieLogs, completions, addWater, favorites, toggleFavorite } = useData();

  const tk = todayKey();
  const firstName = (user?.name ?? "there").split(" ")[0];

  const todayWaterMl = useMemo(
    () => waterLogs.filter((l) => todayKey(new Date(l.ts)) === tk).reduce((s, l) => s + l.amountMl, 0),
    [waterLogs, tk]
  );
  const todayCalories = useMemo(
    () => calorieLogs.filter((l) => todayKey(new Date(l.ts)) === tk),
    [calorieLogs, tk]
  );
  const consumed = todayCalories.reduce((s, l) => s + l.kcal, 0);
  const protein = todayCalories.reduce((s, l) => s + l.protein, 0);
  const carbs = todayCalories.reduce((s, l) => s + l.carbs, 0);
  const fats = todayCalories.reduce((s, l) => s + l.fats, 0);

  const burned = useMemo(
    () => completions.filter((c) => todayKey(new Date(c.ts)) === tk).reduce((s, c) => s + c.kcal, 0),
    [completions, tk]
  );

  const calorieGoal = profile.calorieGoal > 0 ? profile.calorieGoal : 1800;
  const consumedPct = Math.min(1, consumed / calorieGoal);
  const remainingKcal = Math.max(0, Math.round(calorieGoal - consumed + burned));
  const proteinGoal = Math.round((calorieGoal * 0.3) / 4);
  const carbsGoal = Math.round((calorieGoal * 0.4) / 4);
  const fatsGoal = Math.round((calorieGoal * 0.3) / 9);

  const waterGoalMl = profile.waterGoalMl > 0 ? profile.waterGoalMl : 2500;
  const waterPct = Math.min(1, todayWaterMl / waterGoalMl);
  const waterRemainingL = Math.max(0, (waterGoalMl - todayWaterMl) / 1000);

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

  const weekMarks = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const offset = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - offset);
    return WEEK_LABELS.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        label,
        active: completionDays.has(todayKey(d)),
        isToday: todayKey(d) === tk,
      };
    });
  }, [completionDays, tk]);

  const featured = WORKOUTS.find((w) => w.featured) ?? WORKOUTS[0];
  const saved = useMemo(() => WORKOUTS.filter((w) => favorites.includes(w.id)), [favorites]);

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>{greeting().toUpperCase()}</Text>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{firstName}</Text>
              <Text style={{ fontSize: 18, marginLeft: 8 }}>🌸</Text>
            </View>
          </View>
          <Pressable style={styles.iconBtn} hitSlop={6}>
            <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
            <View style={styles.notifDot} />
          </Pressable>
          <Pressable style={styles.avatar} onPress={() => router.navigate("/(tabs)/profile")}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>

        {/* Weekly Streak */}
        <Card style={styles.streakCard}>
          <View style={styles.streakHead}>
            <View style={styles.rowCenter}>
              <Text style={styles.streakFlame}>🔥</Text>
              <Text style={styles.streakTitle}>Weekly Streak</Text>
            </View>
            <Text style={styles.streakDays}>
              {streak} <Text style={styles.streakDaysUnit}>days</Text>
            </Text>
          </View>
          <View style={styles.streakRow}>
            {weekMarks.map((d, i) => (
              <View key={i} style={styles.streakDayCol}>
                {d.active ? (
                  <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.streakPill} />
                ) : (
                  <View style={[styles.streakPill, styles.streakPillOff]} />
                )}
                <Text style={[styles.streakDayLabel, d.isToday && styles.streakDayToday]}>{d.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Today's Workout hero */}
        <Pressable onPress={() => router.push(`/workout/${featured.id}`)} style={{ marginTop: 24 }}>
          <ImageBackground source={featured.image} style={styles.hero} imageStyle={styles.heroImg}>
            <LinearGradient colors={["rgba(44,36,34,0.1)", "rgba(44,36,34,0.88)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>TODAY'S WORKOUT</Text>
            </View>
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>{featured.title}</Text>
              <View style={styles.heroMeta}>
                <View style={styles.heroMetaItem}>
                  <Ionicons name="time-outline" size={14} color={colors.foreground} />
                  <Text style={styles.heroMetaText}>{featured.durationMin} min</Text>
                </View>
                <View style={styles.heroMetaItem}>
                  <Ionicons name="flame-outline" size={14} color={colors.foreground} />
                  <Text style={styles.heroMetaText}>{featured.kcal} kcal</Text>
                </View>
                <View style={styles.heroMetaItem}>
                  <Ionicons name="trending-up-outline" size={14} color={colors.foreground} />
                  <Text style={styles.heroMetaText}>{featured.level}</Text>
                </View>
              </View>
            </View>
            <View style={styles.heroPlay}>
              <Ionicons name="play" size={22} color={colors.onPrimary} />
            </View>
          </ImageBackground>
        </Pressable>

        {/* Calorie Summary */}
        <Card style={styles.calCard}>
          <View style={styles.calHead}>
            <View style={styles.rowCenter}>
              <Ionicons name="restaurant-outline" size={17} color={colors.accent} />
              <Text style={styles.calTitle}>Calorie Summary</Text>
            </View>
            <Pressable style={styles.logMealBtn} onPress={() => router.navigate("/(tabs)/calories")}>
              <Ionicons name="camera-outline" size={14} color={colors.onPrimary} />
              <Text style={styles.logMealText}>Log meal</Text>
            </Pressable>
          </View>

          <View style={styles.calBody}>
            <ProgressRing size={108} strokeWidth={10} progress={consumedPct} gradientId="calRing">
              <Text style={styles.calRingPct}>{Math.round(consumedPct * 100)}%</Text>
            </ProgressRing>
            <View style={styles.calStats}>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Consumed</Text>
                <Text style={styles.calStatValue}>{consumed.toLocaleString()} kcal</Text>
              </View>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Burned</Text>
                <Text style={styles.calStatValue}>{burned.toLocaleString()} kcal</Text>
              </View>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Remaining</Text>
                <Text style={[styles.calStatValue, { color: colors.accent }]}>{remainingKcal.toLocaleString()} kcal</Text>
              </View>
            </View>
          </View>

          <View style={styles.macroRow}>
            <MacroPill label="Protein" value={protein} goal={proteinGoal} color={colors.protein} />
            <MacroPill label="Carbs" value={carbs} goal={carbsGoal} color={colors.carbs} />
            <MacroPill label="Fats" value={fats} goal={fatsGoal} color={colors.fats} />
          </View>
        </Card>

        {/* Quick Access */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitleSm}>QUICK ACCESS</Text>
        </View>
        <View style={styles.qaGrid}>
          {QUICK_ACCESS.map((q) => (
            <Pressable key={q.title} style={styles.qaCard} onPress={() => router.navigate(q.route)}>
              <View style={styles.qaIcon}>
                <Ionicons name={q.icon} size={20} color={colors.accent} />
              </View>
              <Text style={styles.qaTitle}>{q.title}</Text>
              <Text style={styles.qaSub}>{q.sub}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.mutedForeground} style={{ marginTop: 10 }} />
            </Pressable>
          ))}
        </View>

        {/* Hydration */}
        <Card style={styles.hydrationCard}>
          <View style={styles.calHead}>
            <View style={styles.rowCenter}>
              <Ionicons name="water-outline" size={17} color={colors.accent} />
              <Text style={styles.calTitle}>Hydration</Text>
            </View>
            <Pressable style={styles.logMealBtn} onPress={() => router.navigate("/(tabs)/water")}>
              <Ionicons name="add" size={16} color={colors.onPrimary} />
              <Text style={styles.logMealText}>Add water</Text>
            </Pressable>
          </View>

          <View style={styles.calBody}>
            <ProgressRing size={108} strokeWidth={10} progress={waterPct} gradientId="waterRing">
              <Text style={styles.calRingPct}>{Math.round(waterPct * 100)}%</Text>
            </ProgressRing>
            <View style={styles.calStats}>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Consumed</Text>
                <Text style={styles.calStatValue}>{(todayWaterMl / 1000).toFixed(1)} L</Text>
              </View>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Remaining</Text>
                <Text style={styles.calStatValue}>{waterRemainingL.toFixed(1)} L</Text>
              </View>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Daily Goal</Text>
                <Text style={styles.calStatValue}>{(profile.waterGoalMl / 1000).toFixed(1)} L</Text>
              </View>
            </View>
          </View>

          <View style={styles.waterBtnRow}>
            {WATER_QUICK.map((ml) => (
              <Pressable key={ml} style={styles.waterBtn} onPress={() => addWater(ml)}>
                <Text style={styles.waterBtnText}>+ {ml}ml</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Saved Workouts */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitleSm}>SAVED WORKOUTS</Text>
          <Pressable onPress={() => router.navigate("/(tabs)/workouts")}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {saved.length === 0 ? (
          <Card style={styles.savedEmpty}>
            <Ionicons name="heart-outline" size={26} color={colors.muted} />
            <Text style={styles.savedEmptyText}>No saved workouts yet</Text>
            <Text style={styles.savedEmptySub}>Tap the heart on a workout to save it here</Text>
            <Pressable style={styles.savedEmptyBtn} onPress={() => router.navigate("/(tabs)/workouts")}>
              <Text style={styles.savedEmptyBtnText}>Browse library</Text>
            </Pressable>
          </Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
            {saved.map((w) => (
              <Pressable key={w.id} style={styles.savedCard} onPress={() => router.push(`/workout/${w.id}`)}>
                <ImageBackground source={w.image} style={styles.savedImg} imageStyle={{ borderRadius: colors.radiusLg }}>
                  <LinearGradient colors={["transparent", "rgba(44,36,34,0.92)"]} style={styles.savedOverlay} />
                  <Pressable
                    style={styles.savedHeart}
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleFavorite(w.id);
                    }}
                  >
                    <Ionicons name="heart" size={15} color={colors.accent} />
                  </Pressable>
                  <View style={styles.savedInfo}>
                    <Text style={styles.savedTitle} numberOfLines={1}>{w.title}</Text>
                    <Text style={styles.savedMeta}>{w.durationMin} min · {w.level}</Text>
                  </View>
                </ImageBackground>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

function MacroPill({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  return (
    <View style={styles.macroPill}>
      <Text style={styles.macroValue}>{Math.round(value)}<Text style={styles.macroUnit}>g</Text></Text>
      <Text style={styles.macroLabel}>{label}</Text>
      <ProgressBar progress={goal > 0 ? value / goal : 0} height={5} color={color} style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 22, gap: 12 },
  greet: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted, letterSpacing: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  name: { fontFamily: fonts.serif, fontSize: 34, color: colors.foreground },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.serifSemibold, fontSize: 19, color: colors.accent },

  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },

  streakCard: { paddingVertical: 18 },
  streakHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  streakFlame: { fontSize: 18, marginRight: 8 },
  streakTitle: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  streakDays: { fontFamily: fonts.serifSemibold, fontSize: 26, color: colors.foreground },
  streakDaysUnit: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  streakRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  streakDayCol: { alignItems: "center", flex: 1, gap: 8 },
  streakPill: { width: "100%", height: 8, borderRadius: 4 },
  streakPillOff: { backgroundColor: colors.track },
  streakDayLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },
  streakDayToday: { color: colors.accent },

  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 14 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.foreground },
  sectionTitleSm: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted, letterSpacing: 2 },
  seeAll: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent },

  hero: { height: 190, borderRadius: colors.radiusLg, overflow: "hidden", justifyContent: "flex-end" },
  heroImg: { borderRadius: colors.radiusLg },
  heroBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(44,36,34,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(247,235,232,0.18)",
  },
  heroBadgeText: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.foreground, letterSpacing: 1.5 },
  heroContent: { padding: 20 },
  heroTitle: { fontFamily: fonts.serifSemibold, fontSize: 28, color: colors.foreground },
  heroMeta: { flexDirection: "row", gap: 16, marginTop: 8, flexWrap: "wrap" },
  heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroMetaText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  heroPlay: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  calCard: { marginTop: 28, paddingVertical: 20 },
  calHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calTitle: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  logMealBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  logMealText: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.onPrimary },
  calBody: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 20 },
  calRingPct: { fontFamily: fonts.sansBold, fontSize: 22, color: colors.foreground },
  calStats: { flex: 1, gap: 10 },
  calStatRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calStatLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  calStatValue: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },

  macroRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  macroPill: {
    flex: 1,
    backgroundColor: colors.cardElevated,
    borderRadius: colors.radius,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  macroValue: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.foreground },
  macroUnit: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  macroLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },

  qaGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  qaCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 16,
  },
  qaIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(242,212,204,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  qaTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  qaSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },

  hydrationCard: { marginTop: 28, paddingVertical: 20 },
  waterBtnRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  waterBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingVertical: 13,
  },
  waterBtnText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },

  savedRow: { gap: 14, paddingRight: 8 },
  savedCard: { width: 165 },
  savedImg: { width: 165, height: 150, justifyContent: "flex-end" },
  savedOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: colors.radiusLg },
  savedHeart: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(44,36,34,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedInfo: { padding: 14 },
  savedTitle: { fontFamily: fonts.serifSemibold, fontSize: 17, color: colors.foreground },
  savedMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },

  savedEmpty: { alignItems: "center", paddingVertical: 28, gap: 6 },
  savedEmptyText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground, marginTop: 4 },
  savedEmptySub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: "center" },
  savedEmptyBtn: {
    marginTop: 14,
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  savedEmptyBtnText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.onPrimary },
});
