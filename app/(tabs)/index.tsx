import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { ProgressRing } from "@/components/ProgressRing";
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

export default function Dashboard() {
  const router = useRouter();
  const insets = useInsets();
  const { user } = useAuth();
  const { profile, waterLogs, calorieLogs, completions } = useData();

  const tk = todayKey();
  const todayWater = useMemo(
    () => waterLogs.filter((l) => todayKey(new Date(l.ts)) === tk).reduce((s, l) => s + l.amountMl, 0),
    [waterLogs, tk]
  );
  const todayKcal = useMemo(
    () => calorieLogs.filter((l) => todayKey(new Date(l.ts)) === tk).reduce((s, l) => s + l.kcal, 0),
    [calorieLogs, tk]
  );
  const todayWorkouts = useMemo(
    () => completions.filter((c) => todayKey(new Date(c.ts)) === tk).length,
    [completions, tk]
  );

  const featured = WORKOUTS.filter((w) => w.featured);
  const firstName = (user?.name ?? "there").split(" ")[0];

  const waterPct = Math.min(1, todayWater / profile.waterGoalMl);
  const kcalPct = Math.min(1, todayKcal / profile.calorieGoal);

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greet}>{greeting()},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <Pressable style={styles.avatar} onPress={() => router.navigate("/(tabs)/profile")}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>

        <Card style={styles.statsCard}>
          <View style={styles.statItem}>
            <ProgressRing size={74} strokeWidth={7} progress={kcalPct} gradientId="g1">
              <Ionicons name="flame-outline" size={20} color={colors.accent} />
            </ProgressRing>
            <Text style={styles.statValue}>{todayKcal}</Text>
            <Text style={styles.statLabel}>kcal</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ProgressRing size={74} strokeWidth={7} progress={waterPct} gradientId="g2">
              <Ionicons name="water-outline" size={20} color={colors.accent} />
            </ProgressRing>
            <Text style={styles.statValue}>{(todayWater / 1000).toFixed(1)}L</Text>
            <Text style={styles.statLabel}>water</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ProgressRing size={74} strokeWidth={7} progress={todayWorkouts > 0 ? 1 : 0} gradientId="g3">
              <Ionicons name="barbell-outline" size={20} color={colors.accent} />
            </ProgressRing>
            <Text style={styles.statValue}>{todayWorkouts}</Text>
            <Text style={styles.statLabel}>workouts</Text>
          </View>
        </Card>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Today's focus</Text>
        </View>

        {featured[0] ? (
          <Pressable onPress={() => router.push(`/workout/${featured[0].id}`)}>
            <ImageBackground source={featured[0].image} style={styles.hero} imageStyle={styles.heroImg}>
              <LinearGradient
                colors={["rgba(44,36,34,0.1)", "rgba(44,36,34,0.85)"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroContent}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{featured[0].category}</Text>
                </View>
                <Text style={styles.heroTitle}>{featured[0].title}</Text>
                <View style={styles.heroMeta}>
                  <View style={styles.heroMetaItem}>
                    <Ionicons name="time-outline" size={15} color={colors.foreground} />
                    <Text style={styles.heroMetaText}>{featured[0].durationMin} min</Text>
                  </View>
                  <View style={styles.heroMetaItem}>
                    <Ionicons name="flame-outline" size={15} color={colors.foreground} />
                    <Text style={styles.heroMetaText}>{featured[0].kcal} kcal</Text>
                  </View>
                </View>
              </View>
              <View style={styles.heroPlay}>
                <Ionicons name="play" size={20} color={colors.onPrimary} />
              </View>
            </ImageBackground>
          </Pressable>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recommended for you</Text>
          <Pressable onPress={() => router.navigate("/(tabs)/workouts")}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hList}
        >
          {featured.map((w) => (
            <Pressable key={w.id} style={styles.wCard} onPress={() => router.push(`/workout/${w.id}`)}>
              <ImageBackground source={w.image} style={styles.wImg} imageStyle={{ borderRadius: colors.radiusLg }}>
                <LinearGradient colors={["transparent", "rgba(44,36,34,0.9)"]} style={styles.wOverlay} />
                <View style={styles.wInfo}>
                  <Text style={styles.wLevel}>{w.level}</Text>
                  <Text style={styles.wTitle} numberOfLines={1}>{w.title}</Text>
                  <Text style={styles.wMeta}>{w.durationMin} min · {w.kcal} kcal</Text>
                </View>
              </ImageBackground>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  greet: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted },
  name: { fontFamily: fonts.serif, fontSize: 32, color: colors.foreground, marginTop: 2 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.serifSemibold, fontSize: 20, color: colors.accent },
  statsCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 20 },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontFamily: fonts.sansSemibold, fontSize: 17, color: colors.foreground, marginTop: 8 },
  statLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
  statDivider: { width: 1, height: 64, backgroundColor: colors.cardBorder },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 14 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.foreground },
  seeAll: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.accent },
  hero: { height: 200, borderRadius: colors.radiusLg, overflow: "hidden", justifyContent: "flex-end" },
  heroImg: { borderRadius: colors.radiusLg },
  heroContent: { padding: 20 },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(247,235,232,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  heroBadgeText: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.foreground, letterSpacing: 0.5 },
  heroTitle: { fontFamily: fonts.serifSemibold, fontSize: 26, color: colors.foreground },
  heroMeta: { flexDirection: "row", gap: 18, marginTop: 8 },
  heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroMetaText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  heroPlay: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  hList: { gap: 14, paddingRight: 8 },
  wCard: { width: 180 },
  wImg: { width: 180, height: 220, justifyContent: "flex-end" },
  wOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: colors.radiusLg },
  wInfo: { padding: 14 },
  wLevel: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.accent, letterSpacing: 0.5, marginBottom: 4 },
  wTitle: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.foreground },
  wMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 3 },
});
