import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable as StructuralPressable, Image, Modal, useWindowDimensions } from "react-native";
import { Image as ExpoImage, ImageBackground } from "expo-image";
import { Asset } from "expo-asset";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { ProgressRing } from "@/components/ProgressRing";
import { ProgressBar } from "@/components/ProgressBar";
import { SectionLabel } from "@/components/PageHeader";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { MotionListItem } from "@/components/Motion";
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
import { buildWeekHistory, type WeekHistoryRow } from "@/lib/streakHistory";
import { avatarUri } from "@/lib/avatar";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics, waterAddFeedback } from "@/lib/haptics";

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

const QUICK_ACCESS = [
  { icon: "stats-chart-outline" as const, title: "My Progress", sub: "Photos & stats", route: "/(tabs)/tracker?mode=progress" as const },
];

const WATER_QUICK = [250, 500, 750];

const SPARKLE_PATH = "M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z";

// Decorative 4-point star scattered over the streak card. `glow` underlays a soft
// radial halo (react-native-svg has no drop-shadow filter).
function Sparkle({ size, fill, glow, style }: { size: number; fill: string; glow?: boolean; style: object }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={[{ position: "absolute" }, style]}>
      {glow && (
        <>
          <Defs>
            <RadialGradient id="sparkleGlow" cx="12" cy="12" r="12" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#F08CAD" stopOpacity="0.6" />
              <Stop offset="1" stopColor="#F08CAD" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={12} cy={12} r={12} fill="url(#sparkleGlow)" />
        </>
      )}
      <Path d={SPARKLE_PATH} fill={fill} />
    </Svg>
  );
}

export default function Dashboard() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { user } = useAuth();
  const { profile, waterLogs, calorieLogs, completions, addWater, favorites, toggleFavorite, notifications, unreadCount, markNotificationsRead, streak, streakBest, streakDays, updateProfile, welcomePending, dismissWelcome } = useData();
  const { refreshControl, scrollRef } = useDataRefresh();
  const [notifOpen, setNotifOpen] = useState(false);
  const [streakHistoryOpen, setStreakHistoryOpen] = useState(false);

  const openStreakHistory = () => {
    setStreakHistoryOpen(true);
  };

  const openNotifs = () => {
    setNotifOpen(true);
    if (unreadCount > 0) markNotificationsRead();
  };

  // Warm every workout card image into expo-image's disk cache once at launch,
  // so the hero, saved cards and the library render instantly afterwards. In
  // dev the assets cross the network only this once (they are bundled into
  // production builds anyway).
  useEffect(() => {
    const uris = WORKOUTS.map((w) => w.image)
      .filter((m): m is number => typeof m === "number")
      .map((m) => {
        try {
          return Asset.fromModule(m).uri;
        } catch {
          return null;
        }
      })
      .filter((u): u is string => !!u);
    if (uris.length) void ExpoImage.prefetch(uris, "memory-disk");
  }, []);

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
  const waterTotalRef = useRef(todayWaterMl);
  useEffect(() => {
    waterTotalRef.current = todayWaterMl;
  }, [todayWaterMl]);

  const logQuickWater = (amountMl: number) => {
    const currentMl = waterTotalRef.current;
    waterTotalRef.current = currentMl + amountMl;
    void addWater(amountMl);
    haptics[waterAddFeedback(currentMl, amountMl, waterGoalMl)]();
  };

  // This week plus the last 4 (Mon-start, newest first); week 0 feeds the
  // card's tracker, the full list feeds the streak history sheet. `tk` is a
  // dependency so the memo rolls over at midnight.
  const weekHistory = useMemo(() => buildWeekHistory(streakDays, 5), [streakDays, tk]);
  const weekMarks = weekHistory[0].days;
  const activeThisWeek = weekHistory[0].activeCount;
  const todayWorkoutLogged = completions.some((c) => todayKey(new Date(c.ts)) === tk);
  const nudgeEmoji = profile.gender === "female" ? "💗" : "🌸";
  const streakNudge = todayWorkoutLogged
    ? "You showed up for yourself today"
    : "You got this, work out today to keep it up";

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
  const heroCtaText =
    todayPlan?.source === "program" && todayPlan.dayNumber
      ? `Start Day ${todayPlan.dayNumber}`
      : todayPlan?.source === "recommended"
        ? "Start today's pick"
        : "Start workout";
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

        {/* Streak card ("17c") — the top number is the rolling consecutive-day
            streak (spans weeks); the pills below are the current Mon→Sun week. */}
        <Card style={styles.streakCard}>
          <LinearGradient
            colors={["#FDF1F5", "#FBE7EE"]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.streakSurface}
          >
            {/* Background décor: white glow wisp + scattered sparkles */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
              <Svg width={140} height={140} style={styles.streakWisp}>
                <Defs>
                  <RadialGradient id="streakWisp" cx="70" cy="70" r="70" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
                    <Stop offset="0.68" stopColor="#FFFFFF" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx={70} cy={70} r={70} fill="url(#streakWisp)" />
              </Svg>
              <Sparkle size={14} fill="#F2A9C1" glow style={{ top: 14, right: 16 }} />
              <Sparkle size={8} fill="#F5BCCF" style={{ top: 38, right: 38 }} />
              <Sparkle size={10} fill="#F5BCCF" style={{ top: 16, left: 150 }} />
              <Sparkle size={7} fill="#F5BCCF" style={{ top: 58, right: 20 }} />
              <Sparkle size={6} fill="#F5BCCF" style={{ top: 8, left: 120 }} />
              <Sparkle size={8} fill="#F2A9C1" style={{ top: 88, right: 44 }} />
              <Sparkle size={6} fill="#F5BCCF" style={{ top: 100, right: 14 }} />
            </View>

            {/* Top row: text block left, flame medallion right */}
            <View style={styles.streakTopRow}>
              <View style={styles.streakTextCol}>
                <View style={styles.streakTitleRow}>
                  <Text style={styles.streakTitle}>Keep It Going</Text>
                  <Sparkle size={13} fill="#F2A9C1" glow style={{ position: "relative" }} />
                  <Sparkle size={7} fill="#F5BCCF" style={{ position: "relative", marginBottom: 8 }} />
                </View>
                <View style={styles.streakCount}>
                  <Text style={styles.streakNum}>{streak}</Text>
                  <Text style={styles.streakUnit}>day streak</Text>
                </View>
                <View style={styles.streakNudgeRow}>
                  <Text style={styles.streakNudgeEmoji}>{nudgeEmoji}</Text>
                  <Text style={styles.streakNudge} numberOfLines={2}>{streakNudge}</Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.streakMedallion, pressed && styles.pressed]}
                hitSlop={6}
                onPress={openStreakHistory}
                accessibilityRole="button"
                accessibilityLabel="View streak history"
              >
                <Svg width={58} height={58} style={styles.streakHalo}>
                  <Defs>
                    <RadialGradient id="streakHalo" cx="29" cy="29" r="29" gradientUnits="userSpaceOnUse">
                      <Stop offset="0" stopColor="#F08CAD" stopOpacity="0.45" />
                      <Stop offset="0.7" stopColor="#F7B7CD" stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Circle cx={29} cy={29} r={29} fill="url(#streakHalo)" />
                </Svg>
                <LinearGradient
                  colors={colors.gradient}
                  start={{ x: 0.25, y: 0 }}
                  end={{ x: 0.75, y: 1 }}
                  style={styles.streakDisc}
                >
                  <Ionicons name="flame" size={20} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>

            <View style={styles.streakDivider} />

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
                      colors={colors.gradient}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={[styles.streakSeg, styles.streakSegOn]}
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
          </LinearGradient>
        </Card>

        {/* Today's workout hero */}
        <View style={{ marginTop: 22 }}>
          <SectionLabel style={{ marginBottom: 10 }}>{heroEyebrow}</SectionLabel>
          <Pressable pressedScale={0.985} ref={heroRef} onLayout={measureHero} onPress={() => router.push(`/workout/${featured.id}`)}>
            <ImageBackground
              source={featured.image}
              style={[styles.hero, { height: heroHeight }]}
              imageStyle={styles.heroImg}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
            >
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
                  <Text style={styles.heroCtaText}>{heroCtaText}</Text>
                </View>
                <View style={styles.heroPlay}>
                  <Ionicons name="chevron-forward" size={24} color={colors.onPrimary} />
                </View>
              </View>
            </ImageBackground>
          </Pressable>
          {todayPlan?.programComplete && todayPlan.program ? (
            todayPlan.nextProgram ? (
              <View style={styles.programNextCard}>
                <Text style={styles.programDoneNote}>
                  You finished {todayPlan.program.title}, beautiful work. Ready for the next phase?
                </Text>
                <Pressable
                  style={styles.programNextBtn}
                  onPress={() => {
                    const next = todayPlan.nextProgram;
                    if (next) void updateProfile({ programId: next.id, programStartedAt: Date.now() });
                  }}
                >
                  <Text style={styles.programNextBtnText}>Start {todayPlan.nextProgram.title}</Text>
                  <Ionicons name="arrow-forward" size={15} color={colors.onPrimary} />
                </Pressable>
              </View>
            ) : (
              <Text style={styles.programDoneNote}>
                You finished {todayPlan.program.title}, beautiful work. Here's a pick we think you'll love.
              </Text>
            )
          ) : null}
        </View>

        {/* Personalize prompt for accounts that predate the fitness questions */}
        {!hasFitnessProfile(profile) ? (
          <Pressable pressedScale={0.985} onPress={() => router.push("/onboarding/goal?mode=personalize" as any)}>
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
            <AnimatedNumber
              value={consumedPct * 100}
              formatter={(n) => `${Math.round(n)}%`}
              style={styles.calRingPct}
            />
            <Text style={styles.calRingGoal} numberOfLines={1}>Goal: {calorieGoal} kcal</Text>
          </View>
        </ProgressRing>
        <View style={styles.calStats}>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Consumed</Text>
                <AnimatedNumber value={consumed} formatter={(n) => `${Math.round(n).toLocaleString()} kcal`} style={styles.calStatValue} />
              </View>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Burned</Text>
                <AnimatedNumber value={burned} formatter={(n) => `${Math.round(n).toLocaleString()} kcal`} style={[styles.calStatValue, { color: colors.highlight }]} />
              </View>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>Remaining</Text>
                <AnimatedNumber value={remainingKcal} formatter={(n) => `${Math.round(n).toLocaleString()} kcal`} style={[styles.calStatValue, { color: colors.accent }]} />
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
            <Text style={styles.hydroMeta}>Drank: <AnimatedNumber value={todayWaterMl / 1000} formatter={(n) => `${n.toFixed(2)} L`} style={styles.hydroMeta} /></Text>
            <Text style={styles.hydroMeta}>Goal: {(waterGoalMl / 1000).toFixed(2)} L</Text>
          </View>
          <View style={styles.waterBtnRow}>
            {WATER_QUICK.map((ml) => (
              <Pressable
                key={ml}
                style={({ pressed }) => [styles.waterBtn, pressed && styles.pressed]}
                onPress={() => logQuickWater(ml)}
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
              pressedScale={0.985}
              key={q.title}
              style={({ pressed }) => [styles.qaCard, pressed && styles.pressed]}
              onPress={() => router.navigate(q.route)}
            >
              <View style={[styles.qaIcon, { backgroundColor: colors.track }]}>
                <Ionicons name={q.icon} size={18} color={colors.foreground} />
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
              <MotionListItem key={w.id}>
              <Pressable pressedScale={0.985} style={styles.savedCard} onPress={() => router.push(`/workout/${w.id}`)}>
                <ImageBackground
                  source={w.image}
                  style={styles.savedImg}
                  imageStyle={{ borderRadius: colors.radiusLg }}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                >
                  <LinearGradient colors={["transparent", "rgba(51,28,38,0.85)"]} style={styles.savedOverlay} />
                  <Pressable
                    style={styles.savedHeart}
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      haptics.selection();
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
              </MotionListItem>
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
      <StreakHistorySheet
        visible={streakHistoryOpen}
        history={weekHistory}
        streak={streak}
        streakBest={streakBest}
        onClose={() => setStreakHistoryOpen(false)}
        insets={insets}
      />
      <WelcomeModal visible={welcomePending} name={firstName} onClose={dismissWelcome} />
    </GradientBackground>
  );
}

// One-time greeting shown over the dashboard right after the onboarding
// thank-you video hands off here. Queued by the thank-you screen via
// DataContext's welcome_pending slice; dismissing clears it for good.
function WelcomeModal({
  visible,
  name,
  onClose,
}: {
  visible: boolean;
  name: string;
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <StructuralPressable style={styles.welcomeBackdrop} onPress={onClose}>
        <StructuralPressable style={styles.welcomeCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.welcomeHead}>
            <Logo showText={false} size="sm" />
            <Text style={styles.welcomeTitle}>Welcome to Florish 🌸</Text>
          </View>
          <Text style={styles.welcomeBody}>
            We're so glad you're here, {name}. Your plan is ready and your journey starts today,
            one beautiful session at a time.
          </Text>
          <Button label="Let's begin" onPress={onClose} style={styles.welcomeCta} />
        </StructuralPressable>
      </StructuralPressable>
    </Modal>
  );
}

const toneIcons = (colors: AppColors): Record<string, { color: string; tint: string }> => ({
  accent: { color: colors.accent, tint: colors.blush },
  highlight: { color: colors.highlight, tint: colors.highlightTint },
  water: { color: colors.water, tint: colors.waterTint },
  coach: { color: colors.highlight, tint: colors.highlightTint },
});

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
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const TONE_ICON = useMemo(() => toneIcons(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <StructuralPressable style={styles.notifBackdrop} onPress={onClose}>
        <StructuralPressable style={[styles.notifSheet, { paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.notifHandle} />
          <View style={styles.notifHead}>
            <Text style={styles.notifHeadTitle}>Notifications</Text>
            <Pressable style={styles.notifClose} hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.foreground} />
            </Pressable>
          </View>

          {notifications.length === 0 ? (
            <EmptyState
              compact
              icon="checkmark-done-outline"
              title="You're all caught up"
              description="No reminders right now. Browse a workout when you're ready to move."
              actionLabel="Browse workouts"
              onAction={() => {
                onClose();
                router.push("/(tabs)/workouts");
              }}
            />
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
                    {n.id === "welcome" ? (
                      <Logo showText={false} size="sm" />
                    ) : (
                      <View style={[styles.notifIcon, { backgroundColor: tone.tint }]}>
                        <Ionicons name={n.icon as React.ComponentProps<typeof Ionicons>["name"]} size={18} color={tone.color} />
                      </View>
                    )}
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
        </StructuralPressable>
      </StructuralPressable>
    </Modal>
  );
}

// Slide-up sheet with the last 8 weeks of day-level streak activity, opened by
// tapping the streak card's flame medallion.
function StreakHistorySheet({
  visible,
  history,
  streak,
  streakBest,
  onClose,
  insets,
}: {
  visible: boolean;
  history: WeekHistoryRow[];
  streak: number;
  streakBest: number;
  onClose: () => void;
  insets: { bottom: number };
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <StructuralPressable style={styles.notifBackdrop} onPress={onClose}>
        <StructuralPressable style={[styles.notifSheet, { paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.notifHandle} />
          <View style={styles.notifHead}>
            <Text style={styles.notifHeadTitle}>Streak History</Text>
            <Pressable style={styles.notifClose} hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={styles.streakHxSummary}>
            <Ionicons name="flame" size={16} color={colors.primary} />
            <Text style={styles.streakHxSummaryText}>
              {streak} day streak
              <Text style={styles.streakHxSummaryBest}>  ·  Best: {streakBest}</Text>
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={styles.streakHxList} showsVerticalScrollIndicator={false}>
            {history.map((week) => (
              <View key={week.days[0].key} style={styles.streakHxWeek}>
                <View style={styles.streakHxWeekHead}>
                  <Text style={styles.streakHxRange}>{week.rangeLabel}</Text>
                  <Text style={styles.streakActiveText}>{week.activeCount} / 7</Text>
                </View>
                <View style={styles.streakWeek}>
                  {week.days.map((d) => (
                    <View key={d.key} style={styles.streakDayCol}>
                      {d.active ? (
                        <LinearGradient
                          colors={colors.gradient}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={[styles.streakSeg, styles.streakSegOn]}
                        />
                      ) : (
                        <View style={[styles.streakSeg, styles.streakHxSegOff]} />
                      )}
                      <Text style={[styles.streakDayLabel, d.active && styles.streakDayLabelActive]}>
                        {d.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </StructuralPressable>
      </StructuralPressable>
    </Modal>
  );
}

function MacroPill({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.macroPill}>
      <Text style={styles.macroValue}><AnimatedNumber value={value} style={styles.macroValue} /><Text style={styles.macroUnit}> g</Text></Text>
      <Text style={styles.macroLabel}>{label}</Text>
      <ProgressBar progress={goal > 0 ? value / goal : 0} height={4} color={color} style={{ marginTop: 6 }} />
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
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
  greet: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.accentDark, letterSpacing: 2.4, marginBottom: 5 },
  nameRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  name: { fontFamily: fonts.serifMedium, fontSize: 28, color: colors.foreground, lineHeight: 32 },
  nameEmoji: { fontSize: 20, lineHeight: 22, marginBottom: 6 },
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
    borderColor: "rgba(228, 93, 135, 0.14)",
    overflow: "hidden",
    shadowColor: colors.foreground,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 28,
    elevation: 2,
  },
  streakSurface: {
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  streakWisp: {
    position: "absolute",
    top: -40,
    right: -30,
  },
  streakTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streakTextCol: {
    gap: 7,
    minWidth: 0,
    flexShrink: 1,
  },
  streakTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  streakTitle: {
    fontFamily: fonts.serifSemibold,
    fontSize: 19,
    lineHeight: 20,
    color: colors.accent,
  },
  streakCount: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    // The 34px serif digit carries ~9px of leading above its cap inside the
    // line box; pull the row up so the title/count/nudge gaps read evenly.
    marginTop: -6,
  },
  streakNum: {
    fontFamily: fonts.serifSemibold,
    fontSize: 34,
    lineHeight: 34,
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
  streakNudgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakNudgeEmoji: {
    fontSize: 13,
    lineHeight: 16,
  },
  streakNudge: {
    fontFamily: fonts.sansSemibold,
    fontSize: 12.5,
    lineHeight: 16,
    color: "rgba(62, 39, 51, 0.65)",
    flexShrink: 1,
  },
  streakMedallion: {
    width: 48,
    height: 48,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  streakHalo: {
    position: "absolute",
    top: -5,
    left: -5,
  },
  streakDisc: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#C8446E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  streakDivider: {
    height: 1,
    backgroundColor: "rgba(62, 39, 51, 0.08)",
    marginTop: 11,
    marginBottom: 9,
  },
  streakWeekHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
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
  streakSegOn: {
    shadowColor: "#E45D87",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 2,
  },
  streakSegOff: { backgroundColor: "rgba(255, 255, 255, 0.85)" },
  streakDayLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: 10,
    color: "rgba(62, 39, 51, 0.4)",
  },
  streakDayLabelActive: {
    fontFamily: fonts.sansBold,
    color: colors.accentDark,
  },
  streakHxSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  streakHxSummaryText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.foreground,
  },
  streakHxSummaryBest: {
    fontFamily: fonts.sansSemibold,
    fontSize: 12,
    color: colors.muted,
  },
  streakHxList: {
    gap: 10,
    paddingBottom: 4,
  },
  streakHxWeek: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  streakHxWeekHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  streakHxRange: {
    fontFamily: fonts.sansSemibold,
    fontSize: 12,
    color: colors.muted,
  },
  // On the sheet's white week cards the card's white-on-blush off pill would
  // vanish, so fall back to the faint ink tint.
  streakHxSegOff: { backgroundColor: "rgba(62, 39, 51, 0.08)" },

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
  heroCtaText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.onPrimary, marginTop: 12 },
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
  programNextCard: { paddingHorizontal: 2 },
  programNextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  programNextBtnText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.onPrimary },
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
  welcomeBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,17,17,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  welcomeCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 22,
  },
  welcomeHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  welcomeTitle: { flex: 1, fontFamily: fonts.serif, fontSize: 24, color: colors.foreground },
  welcomeBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.foreground, marginTop: 14 },
  welcomeCta: { marginTop: 22 },
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
