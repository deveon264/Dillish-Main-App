import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ImageBackground, Image, Modal, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { ProgressRing } from "@/components/ProgressRing";
import { ProgressBar } from "@/components/ProgressBar";
import { SectionLabel } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useDataRefresh } from "@/hooks/useDataRefresh";
import { useInsets } from "@/hooks/useInsets";
import { WORKOUTS } from "@/constants/workouts";
import { PROGRAMS } from "@/constants/programs";
import { getTodayWorkout } from "@/lib/recommendation";
import { hasFitnessProfile } from "@/lib/profile";
import { DEFAULT_REST_GAP, workoutDurationMinutes } from "@/lib/workoutDuration";
import { todayKey } from "@/lib/storage";
import { avatarUri } from "@/lib/avatar";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Sky-tint band geometry. SKY_BAND is the visible tint→transparent fade behind
// the header; SKY_FILL extends the solid tint above the content top so a pull-to-
// refresh overscroll shows the tint instead of the bare cream background (no white
// band). The fade stays within the bottom SKY_BAND via `locations`.
const SKY_BAND = 170;
const SKY_FILL = 400;

// Soft sky tint behind the header that shifts with the time of day, fading to
// transparent over the app background.
function skyTint(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "rgba(252, 226, 220, 0.9)"; // morning blush
  if (h >= 12 && h < 17) return "rgba(247, 235, 215, 0.9)"; // afternoon gold
  if (h >= 17 && h < 21) return "rgba(240, 222, 233, 0.95)"; // evening rose
  return "rgba(226, 215, 229, 0.95)"; // night lavender
}

// Rotates daily with one polished, encouraging line from Dillish under the hero.
const QUOTES = [
  "Show up for yourself today. You are worth the care.",
  "Small steps repeated daily become real change.",
  "Strength is built one thoughtful session at a time.",
  "Your only competition is yesterday's version of you.",
  "Rest is part of progress. Balance is strength.",
  "Twenty focused minutes can keep your momentum alive.",
  "Progress matters more than perfection. Keep going.",
  "Move with intention today, and let confidence follow.",
  "Every rep is a quiet promise to yourself.",
  "Fuel your body, trust your pace, and begin again.",
  "Consistency grows when you make today simple.",
  "A gentle start still counts. Meet yourself where you are.",
  "Your body is learning. Give it patience and care.",
  "One good choice can set the tone for the day.",
];

function dailyQuote(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const quote = QUOTES[day % QUOTES.length]?.trim();
  return quote || "Progress matters more than perfection. Keep going.";
}

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const QUICK_ACCESS = [
  { icon: "stats-chart-outline" as const, title: "My Progress", sub: "Photos & stats", route: "/(tabs)/tracker?mode=progress" as const, tint: colors.track, color: colors.foreground },
];

const WATER_QUICK = [250, 500, 750];

// Gentle continuous "breathing" pulse for the streak flame icon.
function PulsingFlame() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.12 }],
    opacity: 0.85 + pulse.value * 0.15,
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name="flame" size={24} color={colors.primary} />
    </Animated.View>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const insets = useInsets();
  const { user } = useAuth();
  const { profile, waterLogs, calorieLogs, completions, addWater, favorites, toggleFavorite, notifications, unreadCount, markNotificationsRead, streak, streakDays } = useData();
  const { refreshControl, scrollRef } = useDataRefresh();
  const [notifOpen, setNotifOpen] = useState(false);

  const openNotifs = () => {
    setNotifOpen(true);
    if (unreadCount > 0) markNotificationsRead();
  };

  const tk = todayKey();
  const firstName = (user?.name ?? "there").split(" ")[0];
  const avatar = avatarUri(user);
  const initial = (firstName[0] ?? "?").toUpperCase();
  const greetingEmoji = profile.gender === "female" ? "🌸" : "💗";

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
        active: streakDays.has(todayKey(d)),
        isToday: todayKey(d) === tk,
      };
    });
  }, [streakDays, tk]);

  const activeThisWeek = weekMarks.filter((d) => d.active).length;
  const todayWorkoutLogged = completions.some((c) => todayKey(new Date(c.ts)) === tk);
  const nudgeEmoji = profile.gender === "female" ? "💗" : "🌸";
  const streakNudge = todayWorkoutLogged
    ? "Beautiful work, today's session is logged"
    : `${nudgeEmoji} You got this, work out today to keep it going`;

  // Personalized hero: the next workout from the user's program (or their top
  // recommendation). Accounts without a fitness profile keep the classic
  // featured workout and get a personalize prompt below the hero instead.
  const todayPlan = useMemo(
    () => getTodayWorkout(profile, completions, WORKOUTS, PROGRAMS, (ts) => todayKey(new Date(ts))),
    [profile, completions]
  );
  const featured = todayPlan
    ? WORKOUTS.find((w) => w.id === todayPlan.workout.id) ?? WORKOUTS[0]
    : WORKOUTS.find((w) => w.featured) ?? WORKOUTS[0];
  const heroEyebrow =
    todayPlan?.source === "program" && todayPlan.program && todayPlan.dayNumber
      ? `DAY ${todayPlan.dayNumber} OF YOUR ${todayPlan.program.title.toUpperCase()}`
      : "TODAY'S WORKOUT WITH DILLISH";
  const saved = useMemo(() => WORKOUTS.filter((w) => favorites.includes(w.id)), [favorites]);
  const featuredDuration = workoutDurationMinutes(featured.exercises, DEFAULT_REST_GAP);

  // Size the "Today's Workout" hero so its base sits just above the floating tab
  // bar on the default (unscrolled) view — otherwise its bottom (title/meta/play)
  // hides behind the bar. Start near the final value to avoid a first-frame
  // flash, then refine from the hero's measured on-screen top.
  const { height: windowHeight } = useWindowDimensions();
  const heroRef = useRef<View>(null);
  const [heroHeight, setHeroHeight] = useState(Math.min(430, Math.round(windowHeight * 0.42)));
  const measureHero = () => {
    heroRef.current?.measureInWindow((_x, y) => {
      if (y > 0) {
        // Tab-bar footprint ≈ insets.bottom + ~72; 84 leaves a ~12px gap above it.
        const available = windowHeight - insets.bottom - 84 - y;
        setHeroHeight(Math.max(300, Math.min(430, available)));
      }
    });
  };

  const tint = skyTint();

  return (
    <GradientBackground>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {/* Time-of-day sky tint behind the header. The solid tint extends above
            the content top (SKY_FILL) so a pull-to-refresh overscroll stays tinted
            rather than exposing the cream background; the fade is kept in the
            bottom SKY_BAND band via `locations`. */}
        <LinearGradient
          colors={[tint, tint, "rgba(253, 252, 250, 0)"]}
          locations={[0, SKY_FILL / (SKY_BAND + SKY_FILL), 1]}
          style={styles.sky}
          pointerEvents="none"
        />

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>{greeting().toUpperCase()}</Text>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{firstName}</Text>
              <Text style={styles.nameEmoji}>{greetingEmoji}</Text>
            </View>
          </View>
          <Pressable style={styles.iconBtn} hitSlop={6} onPress={openNotifs}>
            <Ionicons name="notifications-outline" size={19} color={colors.foreground} />
            {unreadCount > 0 ? <View style={styles.notifDot} /> : null}
          </Pressable>
          <Pressable style={styles.avatarBtn} hitSlop={6} onPress={() => router.navigate("/(tabs)/profile")}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Streak card — the top number is the rolling consecutive-day streak
            (spans weeks); the pills below are the current Mon→Sun week. */}
        <Card style={styles.streakCard}>
          <LinearGradient
            colors={["#FDF0F5", "#FBE7EE"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.streakHead}
          >
            <View style={styles.streakHeadTop}>
              <View style={styles.streakFlameChip}>
                <PulsingFlame />
              </View>
              <View style={styles.streakTextRow}>
                <View style={styles.streakCount}>
                  <Text style={styles.streakNum}>{streak}</Text>
                  <Text style={styles.streakUnit}>day streak</Text>
                </View>
              </View>
            </View>
            <Text style={styles.streakNudge} numberOfLines={2}>{streakNudge}</Text>
          </LinearGradient>
          <View style={styles.streakBody}>
            <View style={styles.streakWeekHead}>
              <Text style={styles.streakWeekLabel}>THIS WEEK</Text>
              <Text style={styles.streakActiveText}>
                {activeThisWeek} / 7 active
              </Text>
            </View>
            <View style={styles.streakWeek}>
              {weekMarks.map((d, i) => (
                <View key={i} style={styles.streakDayCol}>
                  {d.active ? (
                    <LinearGradient
                      colors={["#F08CAD", "#E45D87"]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.streakSeg}
                    />
                  ) : (
                    <View style={[styles.streakSeg, styles.streakSegOff]} />
                  )}
                  <Text style={[styles.streakDayLabel, d.active && styles.streakDayLabelActive]}>
                    {d.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* Today's workout hero */}
        <View style={{ marginTop: 22 }}>
          <SectionLabel style={{ marginBottom: 10 }}>{heroEyebrow}</SectionLabel>
          <Pressable ref={heroRef} onLayout={measureHero} onPress={() => router.push(`/workout/${featured.id}`)}>
            <ImageBackground source={featured.image} style={[styles.hero, { height: heroHeight }]} imageStyle={styles.heroImg}>
              <LinearGradient
                colors={colors.photoOverlay}
                locations={[0.48, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroContent}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{featured.title}</Text>
                  <View style={styles.heroMeta}>
                    <Text style={styles.heroMetaText}>{featuredDuration} min</Text>
                    <Text style={styles.heroMetaText}>{featured.kcal} kcal</Text>
                    <Text style={styles.heroMetaText}>{featured.level}</Text>
                  </View>
                </View>
                <View style={styles.heroPlay}>
                  <Ionicons name="chevron-forward" size={24} color={colors.onPrimary} />
                </View>
              </View>
            </ImageBackground>
          </Pressable>
          {todayPlan?.programComplete && todayPlan.program ? (
            <Text style={styles.programDoneNote}>
              You finished {todayPlan.program.title}, beautiful work. Here's a pick we think you'll love.
            </Text>
          ) : null}
        </View>

        {/* Personalize prompt for accounts that predate the fitness questions */}
        {!hasFitnessProfile(profile) ? (
          <Pressable onPress={() => router.push("/onboarding/goal?mode=personalize" as any)}>
            <Card style={styles.personalizeCard}>
              <View style={[styles.chipIcon, { backgroundColor: colors.accentTint, width: 38, height: 38, borderRadius: 12 }]}>
                <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personalizeTitle}>Personalize your plan</Text>
                <Text style={styles.personalizeDesc}>Answer 7 quick questions for workouts picked for you</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Card>
          </Pressable>
        ) : null}

        {/* Dillish quote of the day */}
        <View style={styles.quoteWrap}>
          <Text style={styles.quoteText}>"{dailyQuote()}"</Text>
          <Text style={styles.quoteBy}>DILLISH'S QUOTE OF THE DAY</Text>
        </View>

        {/* Calorie summary */}
        <Card style={styles.calCard}>
          <View style={styles.cardHead}>
            <View style={styles.rowCenter}>
              <View style={[styles.chipIcon, { backgroundColor: colors.blush }]}>
                <Ionicons name="restaurant-outline" size={13} color={colors.accent} />
              </View>
              <View style={styles.cardTitleStack}>
                <Text style={styles.cardTodayLabel}>Today's</Text>
                <Text style={styles.cardEyebrow}>CALORIE SUMMARY</Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.logMealBtn, pressed && styles.pressed]}
              onPress={() => router.navigate("/(tabs)/tracker?mode=calories")}
            >
              <Text style={styles.logMealText}>Log meal</Text>
            </Pressable>
          </View>

      <View style={styles.calBody}>
        <ProgressRing size={116} strokeWidth={10} progress={consumedPct} gradientId="calRing">
          <View style={styles.calRingContent}>
            <Text style={styles.calRingPct}>{Math.round(consumedPct * 100)}%</Text>
            <Text style={styles.calRingGoal} numberOfLines={1}>Goal: {calorieGoal} kcal</Text>
          </View>
        </ProgressRing>
        <View style={styles.calStats}>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Consumed</Text>
                <Text style={styles.calStatValue}>{consumed.toLocaleString()} kcal</Text>
              </View>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Burned</Text>
                <Text style={[styles.calStatValue, { color: colors.highlight }]}>{burned.toLocaleString()} kcal</Text>
              </View>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Remaining</Text>
                <Text style={[styles.calStatValue, { color: colors.accent }]}>{remainingKcal.toLocaleString()} kcal</Text>
              </View>
            </View>
          </View>

          <View style={styles.macroRow}>
            <MacroPill label={`Protein · ${proteinGoal} g`} value={protein} goal={proteinGoal} color={colors.protein} />
            <MacroPill label={`Carbs · ${carbsGoal} g`} value={carbs} goal={carbsGoal} color={colors.carbs} />
            <MacroPill label={`Fats · ${fatsGoal} g`} value={fats} goal={fatsGoal} color={colors.fats} />
          </View>
        </Card>

        {/* Hydration */}
        <Card style={styles.hydrationCard}>
          <View style={styles.cardHead}>
            <View style={styles.rowCenter}>
              <View style={[styles.chipIcon, { backgroundColor: colors.waterTint }]}>
                <Ionicons name="water-outline" size={13} color={colors.water} />
              </View>
              <View style={styles.cardTitleStack}>
                <Text style={styles.cardTodayLabel}>Today's</Text>
                <Text style={styles.cardEyebrow}>HYDRATION</Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.logMealBtn, styles.logWaterBtn, pressed && styles.pressed]}
              onPress={() => router.navigate("/(tabs)/tracker?mode=water")}
            >
              <Text style={styles.logMealText}>Log water</Text>
            </Pressable>
          </View>
          <ProgressBar progress={waterPct} height={6} color={colors.water} style={{ marginTop: 14 }} />
          <View style={styles.hydroMetaRow}>
            <Text style={styles.hydroMeta}>Drank: {(todayWaterMl / 1000).toFixed(2)} L</Text>
            <Text style={styles.hydroMeta}>Goal: {(waterGoalMl / 1000).toFixed(2)} L</Text>
          </View>
          <View style={styles.waterBtnRow}>
            {WATER_QUICK.map((ml) => (
              <Pressable
                key={ml}
                style={({ pressed }) => [styles.waterBtn, pressed && styles.pressed]}
                onPress={() => addWater(ml)}
              >
                <Text style={styles.waterBtnText}>+ {ml} ml</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Quick access */}
        <View style={styles.sectionHead}>
          <SectionLabel>QUICK ACCESS</SectionLabel>
        </View>
        <View style={styles.qaGrid}>
          {QUICK_ACCESS.map((q) => (
            <Pressable
              key={q.title}
              style={({ pressed }) => [styles.qaCard, pressed && styles.pressed]}
              onPress={() => router.navigate(q.route)}
            >
              <View style={[styles.qaIcon, { backgroundColor: q.tint }]}>
                <Ionicons name={q.icon} size={18} color={q.color} />
              </View>
              <Text style={styles.qaTitle}>{q.title}</Text>
              <Text style={styles.qaSub}>{q.sub}</Text>
            </Pressable>
          ))}
        </View>

        {/* Saved workouts */}
        <View style={styles.sectionHead}>
          <SectionLabel>SAVED WORKOUTS</SectionLabel>
          <Pressable onPress={() => router.navigate("/(tabs)/workouts")}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {saved.length === 0 ? (
          <Card style={styles.savedEmpty}>
            <Ionicons name="heart-outline" size={26} color={colors.muted} />
            <Text style={styles.savedEmptyText}>No saved workouts yet</Text>
            <Text style={styles.savedEmptySub}>Tap the heart on a workout to save it here</Text>
            <Pressable
              style={({ pressed }) => [styles.savedEmptyBtn, pressed && styles.pressed]}
              onPress={() => router.navigate("/(tabs)/workouts")}
            >
              <Text style={styles.savedEmptyBtnText}>Browse library</Text>
            </Pressable>
          </Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
            {saved.map((w) => (
              <Pressable key={w.id} style={styles.savedCard} onPress={() => router.push(`/workout/${w.id}`)}>
                <ImageBackground source={w.image} style={styles.savedImg} imageStyle={{ borderRadius: colors.radiusLg }}>
                  <LinearGradient colors={["transparent", "rgba(51,28,38,0.85)"]} style={styles.savedOverlay} />
                  <Pressable
                    style={styles.savedHeart}
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleFavorite(w.id);
                    }}
                  >
                    <Ionicons name="heart" size={15} color={colors.primary} />
                  </Pressable>
                  <View style={styles.savedInfo}>
                    <Text style={styles.savedTitle} numberOfLines={1}>{w.title}</Text>
                    <Text style={styles.savedMeta}>
                      {workoutDurationMinutes(w.exercises, DEFAULT_REST_GAP)} min · {w.level}
                    </Text>
                  </View>
                </ImageBackground>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </ScrollView>

      <NotificationsSheet
        visible={notifOpen}
        notifications={notifications}
        onClose={() => setNotifOpen(false)}
        insets={insets}
      />
    </GradientBackground>
  );
}

const TONE_ICON: Record<string, { color: string; tint: string }> = {
  accent: { color: colors.accent, tint: colors.blush },
  highlight: { color: colors.highlight, tint: colors.highlightTint },
  water: { color: colors.water, tint: colors.waterTint },
  coach: { color: colors.highlight, tint: colors.highlightTint },
};

function timeAgo(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function NotificationsSheet({
  visible,
  notifications,
  onClose,
  insets,
}: {
  visible: boolean;
  notifications: import("@/contexts/DataContext").AppNotification[];
  onClose: () => void;
  insets: { bottom: number };
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.notifBackdrop} onPress={onClose}>
        <Pressable style={[styles.notifSheet, { paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.notifHandle} />
          <View style={styles.notifHead}>
            <Text style={styles.notifHeadTitle}>Notifications</Text>
            <Pressable style={styles.notifClose} hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.foreground} />
            </Pressable>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.notifEmpty}>
              <View style={styles.notifEmptyIcon}>
                <Ionicons name="checkmark-done-outline" size={28} color={colors.accent} />
              </View>
              <Text style={styles.notifEmptyTitle}>You're all caught up</Text>
              <Text style={styles.notifEmptySub}>
                No reminders right now. We'll nudge you about your streaks, hydration, and meals.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 440 }}
              contentContainerStyle={styles.notifList}
              showsVerticalScrollIndicator={false}
            >
              {notifications.map((n) => {
                const tone = TONE_ICON[n.tone] ?? TONE_ICON.accent;
                return (
                  <View key={n.id} style={styles.notifItem}>
                    <View style={[styles.notifIcon, { backgroundColor: tone.tint }]}>
                      <Ionicons name={n.icon as React.ComponentProps<typeof Ionicons>["name"]} size={18} color={tone.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.notifItemHead}>
                        <Text style={styles.notifItemTitle}>{n.title}</Text>
                        {!n.read ? <View style={styles.notifItemDot} /> : null}
                      </View>
                      <Text style={styles.notifItemBody}>{n.body}</Text>
                      <Text style={styles.notifItemTime}>{timeAgo(n.ts)}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MacroPill({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  return (
    <View style={styles.macroPill}>
      <Text style={styles.macroValue}>{Math.round(value)}<Text style={styles.macroUnit}> g</Text></Text>
      <Text style={styles.macroLabel}>{label}</Text>
      <ProgressBar progress={goal > 0 ? value / goal : 0} height={4} color={color} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  pressed: { transform: [{ scale: 0.96 }] },
  sky: {
    position: "absolute",
    top: -SKY_FILL,
    left: 0,
    right: 0,
    height: SKY_BAND + SKY_FILL,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  greet: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accentDark, letterSpacing: 2.4, marginBottom: 5 },
  nameRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  name: { fontFamily: fonts.serifMedium, fontSize: 32, color: colors.foreground, lineHeight: 36 },
  nameEmoji: { fontSize: 20, lineHeight: 22, marginBottom: 8 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(62, 39, 51, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.accent },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },

  streakCard: {
    marginTop: 20,
    padding: 0,
    backgroundColor: colors.card,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: colors.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 2,
  },
  streakHead: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  streakHeadTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  streakFlameChip: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 3,
  },
  streakTextRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  streakCount: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  streakNum: {
    fontFamily: fonts.serifSemibold,
    fontSize: 34,
    lineHeight: 36,
    color: colors.foreground,
  },
  streakUnit: {
    fontFamily: fonts.sansSemibold,
    fontSize: 13,
    color: colors.muted,
  },
  streakActiveText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.accentDark,
  },
  streakBody: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.card,
  },
  streakNudge: {
    fontFamily: fonts.sansSemibold,
    fontSize: 11.5,
    lineHeight: 15,
    color: "rgba(62, 39, 51, 0.6)",
    marginLeft: 0,
  },
  streakWeekHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  streakWeekLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: "rgba(62, 39, 51, 0.4)",
    textTransform: "uppercase",
  },
  streakWeek: {
    flexDirection: "row",
    gap: 6,
  },
  streakDayCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  streakSeg: {
    width: "100%",
    height: 7,
    borderRadius: 99,
  },
  streakSegOff: { backgroundColor: "rgba(62, 39, 51, 0.08)" },
  streakDayLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: 10,
    color: "rgba(62, 39, 51, 0.4)",
  },
  streakDayLabelActive: {
    fontFamily: fonts.sansBold,
    color: colors.accentDark,
  },

  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 26, marginBottom: 12 },
  seeAll: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.accentDark },

  hero: {
    height: 430,
    borderRadius: colors.radiusLg,
    overflow: "hidden",
    justifyContent: "flex-end",
    shadowColor: "#3E2733",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 8,
  },
  heroImg: { borderRadius: colors.radiusLg },
  heroContent: { padding: 20, flexDirection: "row", alignItems: "flex-end", gap: 12 },
  heroTitle: { fontFamily: fonts.serifMedium, fontSize: 27, lineHeight: 31, color: colors.onPrimary },
  heroMeta: { flexDirection: "row", gap: 14, marginTop: 8, flexWrap: "wrap" },
  heroMetaText: { fontFamily: fonts.sansSemibold, fontSize: 12, color: "rgba(255,255,255,0.85)" },
  heroPlay: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 6,
  },
  programDoneNote: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  personalizeCard: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  personalizeTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  personalizeDesc: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },

  quoteWrap: { alignItems: "center", gap: 6, paddingVertical: 22, paddingHorizontal: 12 },
  quoteText: {
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    lineHeight: 24,
    color: colors.foreground,
    textAlign: "center",
  },
  quoteBy: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.6, color: colors.accentDark },

  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitleStack: { gap: 2 },
  cardTodayLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.foreground,
  },
  cardEyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.mutedForeground,
  },
  cardHeadAccent: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.accentDark },
  chipIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  hydrationCard: { marginTop: 20, padding: 18 },
  hydroMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, marginBottom: 14 },
  hydroMeta: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.mutedForeground },
  waterBtnRow: { flexDirection: "row", gap: 8 },
  waterBtn: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(62, 39, 51, 0.12)",
    borderRadius: 999,
    paddingVertical: 10,
  },
  waterBtnText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },

  calCard: { marginTop: 16, padding: 18 },
  logMealBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  logWaterBtn: {
    backgroundColor: colors.water,
    shadowColor: colors.water,
  },
  logMealText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.onPrimary },
  calBody: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 16 },
  calRingContent: { alignItems: "center", justifyContent: "center" },
  calRingPct: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
  calRingGoal: { fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.mutedForeground, marginTop: 1 },
  calStats: { flex: 1, gap: 9 },
  calStatRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calStatLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  calStatValue: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.foreground },

  macroRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(62, 39, 51, 0.07)",
    paddingTop: 14,
  },
  macroPill: { flex: 1 },
  macroValue: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.foreground },
  macroUnit: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.mutedForeground },
  macroLabel: { fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.mutedForeground, marginTop: 2 },

  qaGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  qaCard: {
    width: "100%",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    padding: 16,
  },
  qaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  qaTitle: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  qaSub: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.mutedForeground, marginTop: 2 },

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
    backgroundColor: "rgba(51, 28, 38, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedInfo: { padding: 14 },
  savedTitle: { fontFamily: fonts.serifMedium, fontSize: 17, color: colors.onPrimary },
  savedMeta: { fontFamily: fonts.sans, fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },

  savedEmpty: { alignItems: "center", paddingVertical: 28, gap: 6 },
  savedEmptyText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.foreground, marginTop: 4 },
  savedEmptySub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, textAlign: "center" },
  savedEmptyBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 26,
    paddingVertical: 11,
    borderRadius: 999,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  savedEmptyBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.onPrimary },

  notifBackdrop: { flex: 1, backgroundColor: "rgba(51, 28, 38, 0.45)", justifyContent: "flex-end" },
  notifSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: colors.radiusLg,
    borderTopRightRadius: colors.radiusLg,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  notifHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.track,
    marginBottom: 14,
  },
  notifHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  notifHeadTitle: { fontFamily: fonts.serifMedium, fontSize: 24, color: colors.foreground },
  notifClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  notifList: { gap: 10, paddingBottom: 4 },
  notifItem: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    padding: 14,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  notifItemHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  notifItemTitle: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  notifItemDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  notifItemBody: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, marginTop: 3, lineHeight: 19 },
  notifItemTime: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.muted, marginTop: 6 },

  notifEmpty: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 16, gap: 8 },
  notifEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.blush,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  notifEmptyTitle: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  notifEmptySub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: "center", lineHeight: 19 },
});
