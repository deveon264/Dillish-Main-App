import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable as StructuralPressable, Image, Modal, Platform, useWindowDimensions } from "react-native";
import { Image as ExpoImage, ImageBackground } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { Asset } from "expo-asset";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { ProgressRing } from "@/components/ProgressRing";
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
import { haptics } from "@/lib/haptics";

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

export default function Dashboard() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { user } = useAuth();
  const { profile, waterLogs, calorieLogs, completions, favorites, toggleFavorite, notifications, unreadCount, markNotificationsRead, streak, streakBest, streakDays, updateProfile, welcomePending, dismissWelcome } = useData();
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
  // This week plus the last 4 (Mon-start, newest first); week 0 feeds the
  // card's tracker, the full list feeds the streak history sheet. `tk` is a
  // dependency so the memo rolls over at midnight.
  const weekHistory = useMemo(() => buildWeekHistory(streakDays, 5), [streakDays, tk]);
  const weekMarks = weekHistory[0].days;
  const todayWorkoutLogged = completions.some((c) => todayKey(new Date(c.ts)) === tk);
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

  const { height: windowHeight } = useWindowDimensions();
  const heroHeight = Math.max(520, Math.min(560, Math.round(windowHeight * 0.64)));

  return (
    <View style={styles.polishScreen}>
      <StatusBar style="light" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <ImageBackground
          source={featured.image}
          style={[styles.polishHero, { height: heroHeight }]}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        >
          <LinearGradient
            colors={["rgba(51,28,38,0.55)", "rgba(51,28,38,0)", "rgba(51,28,38,0)", "rgba(51,28,38,0.88)"]}
            locations={[0, 0.26, 0.46, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Pressable
            motion="timing"
            pressedScale={0.985}
            style={StyleSheet.absoluteFill}
            onPress={() => router.push(`/workout/${featured.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${heroCtaText}: ${featured.title}`}
          />

          <View style={[styles.polishHeroHeader, { top: (Platform.OS === "web" ? Math.max(insets.top, 50) : insets.top) + 14 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.polishGreeting}>{greeting().toUpperCase()}</Text>
              <Text style={styles.polishName} numberOfLines={1}>{firstName}</Text>
            </View>
            <Pressable
              motion="timing"
              pressedScale={0.94}
              style={styles.polishHeaderButton}
              hitSlop={6}
              onPress={openNotifs}
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
            >
              <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
              {unreadCount > 0 ? <View style={styles.polishNotifDot} /> : null}
            </Pressable>
            <Pressable
              motion="timing"
              pressedScale={0.94}
              style={styles.polishAvatar}
              hitSlop={6}
              onPress={() => router.navigate("/(tabs)/profile")}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.polishAvatarFallback}>
                  <Text style={styles.polishAvatarInitial}>{initial}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.polishHeroBottom}>
            <View style={styles.polishHeroCopy}>
              <Text style={styles.polishHeroEyebrow}>{heroEyebrow}</Text>
              <Text style={styles.polishHeroTitle} numberOfLines={2}>{featured.title}</Text>
              <View style={styles.polishHeroMeta}>
                <Text style={styles.polishHeroMetaText}>{featuredDuration} min</Text>
                <Text style={styles.polishHeroMetaText}>~{featured.kcal} kcal</Text>
                <Text style={styles.polishHeroMetaText}>{featured.level}</Text>
              </View>
            </View>
            <Pressable
              motion="timing"
              pressedScale={0.96}
              style={styles.polishHeroCta}
              onPress={() => router.push(`/workout/${featured.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${heroCtaText}: ${featured.title}`}
            >
              <Text style={styles.polishHeroCtaText} numberOfLines={1}>{heroCtaText}</Text>
              <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        </ImageBackground>

        <View style={styles.polishContent}>
          {todayPlan?.programComplete && todayPlan.program ? (
            <View style={styles.polishConditionalCard}>
              <View style={styles.polishConditionalIcon}>
                <Ionicons name="checkmark" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.polishConditionalTitle}>Program complete</Text>
                <Text style={styles.polishConditionalText}>
                  You finished {todayPlan.program.title}, beautiful work.
                </Text>
              </View>
              {todayPlan.nextProgram ? (
                <Pressable
                  motion="timing"
                  pressedScale={0.96}
                  style={styles.polishConditionalCta}
                  onPress={() => void updateProfile({ programId: todayPlan.nextProgram!.id, programStartedAt: Date.now() })}
                >
                  <Text style={styles.polishConditionalCtaText}>Start next</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {!hasFitnessProfile(profile) ? (
            <Pressable
              motion="timing"
              pressedScale={0.98}
              style={styles.polishConditionalCard}
              onPress={() => router.push("/onboarding/goal?mode=personalize" as any)}
            >
              <View style={styles.polishConditionalIcon}>
                <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.polishConditionalTitle}>Personalize your plan</Text>
                <Text style={styles.polishConditionalText}>Answer 7 quick questions for workouts picked for you</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
            </Pressable>
          ) : null}

          <Pressable
            motion="timing"
            pressedScale={0.98}
            style={styles.polishStreak}
            onPress={openStreakHistory}
            accessibilityRole="button"
            accessibilityLabel="View streak history"
          >
            <View style={styles.polishStreakIcon}>
              <Ionicons name="flame" size={18} color={colors.primary} />
            </View>
            <View style={styles.polishStreakCopy}>
              <Text style={styles.polishStreakTitle}>{streak}-day streak</Text>
              <Text style={styles.polishStreakText} numberOfLines={1}>{streakNudge}</Text>
            </View>
            <View style={styles.polishStreakDots}>
              {weekMarks.map((day) => (
                <View key={day.key} style={[styles.polishStreakDot, day.active && styles.polishStreakDotActive]} />
              ))}
            </View>
          </Pressable>

          <View style={styles.polishQuote}>
            <Text style={styles.polishQuoteMark}>“</Text>
            <Text style={styles.polishQuoteText}>
              {dailyQuote()} <Text style={styles.polishQuoteBy}>— DILLISH&apos;S QUOTE OF THE DAY</Text>
            </Text>
          </View>

          <Card style={styles.polishTodayCard}>
            <View style={styles.polishTodayHead}>
              <SectionLabel>TODAY</SectionLabel>
              <View style={styles.polishTodayActions}>
                <Pressable
                  motion="timing"
                  pressedScale={0.96}
                  style={styles.polishOutlineButton}
                  onPress={() => router.navigate("/(tabs)/tracker?mode=water")}
                >
                  <Text style={styles.polishOutlineButtonText}>Log water</Text>
                </Pressable>
                <Pressable
                  motion="timing"
                  pressedScale={0.96}
                  style={styles.polishFilledButton}
                  onPress={() => router.navigate("/(tabs)/tracker?mode=calories")}
                >
                  <Text style={styles.polishFilledButtonText}>Log meal</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.polishRings}>
              <View style={styles.polishRingColumn}>
                <ProgressRing
                  size={104}
                  strokeWidth={10}
                  progress={consumedPct}
                  color={colors.primary}
                  trackColor={colors.ringTrack}
                  durationMs={600}
                  gradientId="home-calories"
                >
                  <AnimatedNumber value={consumedPct * 100} formatter={(value) => `${Math.round(value)}%`} style={styles.polishRingValue} />
                  <Text style={styles.polishRingGoal}>of {calorieGoal.toLocaleString()} kcal</Text>
                </ProgressRing>
                <Text style={styles.polishRingLabel}>Calories</Text>
                <Text style={styles.polishRingStatus} numberOfLines={1}>
                  ~{remainingKcal.toLocaleString()} kcal left{burned > 0 ? ` · ~${Math.round(burned)} burned` : ""}
                </Text>
              </View>

              <View style={styles.polishRingColumn}>
                <ProgressRing
                  size={104}
                  strokeWidth={10}
                  progress={waterPct}
                  color={colors.hydrationAccent}
                  trackColor={colors.hydrationRingTrack}
                  durationMs={600}
                  gradientId="home-hydration"
                >
                  <AnimatedNumber value={todayWaterMl / 1000} formatter={(value) => `${value.toFixed(1)}L`} style={styles.polishRingValue} />
                  <Text style={styles.polishRingGoal}>of {(waterGoalMl / 1000).toFixed(2)} L</Text>
                </ProgressRing>
                <Text style={styles.polishRingLabel}>Hydration</Text>
                <Text style={styles.polishHydrationStatus}>Drank {(todayWaterMl / 1000).toFixed(2)} L</Text>
              </View>
            </View>

            <View style={styles.polishMacros}>
              <MacroPill label={`Protein · ${proteinGoal}g`} value={protein} goal={proteinGoal} color={colors.protein} />
              <MacroPill label={`Carbs · ${carbsGoal}g`} value={carbs} goal={carbsGoal} color={colors.carbs} />
              <MacroPill label={`Fats · ${fatsGoal}g`} value={fats} goal={fatsGoal} color={colors.fats} />
            </View>
          </Card>

          <View>
            <SectionLabel style={styles.polishSectionLabel}>QUICK ACCESS</SectionLabel>
            {QUICK_ACCESS.map((item) => (
              <Pressable
                key={item.title}
                motion="timing"
                pressedScale={0.98}
                style={styles.polishRowCard}
                onPress={() => router.navigate(item.route)}
              >
                <View style={styles.polishRowIcon}>
                  <Ionicons name={item.icon} size={19} color={colors.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.polishRowTitle}>{item.title}</Text>
                  <Text style={styles.polishRowSub}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(62,39,51,0.30)" />
              </Pressable>
            ))}
          </View>

          <View>
            <View style={styles.polishSectionHead}>
              <SectionLabel>SAVED WORKOUTS</SectionLabel>
              <Pressable hitSlop={8} onPress={() => router.navigate("/(tabs)/workouts")}>
                <Text style={styles.polishSeeAll}>See all</Text>
              </Pressable>
            </View>
            {saved.length === 0 ? (
              <Card style={styles.savedEmpty}>
                <Ionicons name="heart-outline" size={26} color={colors.muted} />
                <Text style={styles.savedEmptyText}>No saved workouts yet</Text>
                <Text style={styles.savedEmptySub}>Tap the heart on a workout to save it here</Text>
                <Pressable
                  motion="timing"
                  pressedScale={0.96}
                  style={styles.savedEmptyBtn}
                  onPress={() => router.navigate("/(tabs)/workouts")}
                >
                  <Text style={styles.savedEmptyBtnText}>Browse library</Text>
                </Pressable>
              </Card>
            ) : (
              <View style={styles.polishSavedGrid}>
                {saved.map((workout) => (
                  <MotionListItem key={workout.id} style={styles.polishSavedGridItem}>
                    <Pressable
                      motion="timing"
                      pressedScale={0.98}
                      style={styles.polishSavedCard}
                      onPress={() => router.push(`/workout/${workout.id}`)}
                    >
                      <ImageBackground
                        source={workout.image}
                        style={styles.polishSavedImage}
                        imageStyle={styles.polishSavedImageRadius}
                        contentFit="cover"
                        transition={150}
                        cachePolicy="memory-disk"
                      >
                        <LinearGradient colors={["transparent", "rgba(51,28,38,0.78)"]} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />
                        <Pressable
                          motion="timing"
                          pressedScale={0.9}
                          style={styles.polishSavedHeart}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${workout.title} from saved workouts`}
                          onPress={(event) => {
                            event.stopPropagation();
                            haptics.selection();
                            void toggleFavorite(workout.id);
                          }}
                        >
                          <Ionicons name="heart" size={14} color={colors.hydrationAccent} />
                        </Pressable>
                        <View style={styles.polishSavedInfo}>
                          <Text style={styles.polishSavedTitle} numberOfLines={1}>{workout.title}</Text>
                          <Text style={styles.polishSavedMeta} numberOfLines={1}>
                            {workoutDurationMinutes(workout.exercises, DEFAULT_REST_GAP)} min · {workout.level}
                          </Text>
                        </View>
                      </ImageBackground>
                    </Pressable>
                  </MotionListItem>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <NotificationsSheet visible={notifOpen} notifications={notifications} onClose={() => setNotifOpen(false)} insets={insets} />
      <StreakHistorySheet
        visible={streakHistoryOpen}
        history={weekHistory}
        streak={streak}
        streakBest={streakBest}
        onClose={() => setStreakHistoryOpen(false)}
        insets={insets}
      />
      <WelcomeModal visible={welcomePending} name={firstName} onClose={dismissWelcome} />
    </View>
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
            <Pressable accessibilityLabel="Close notifications" style={styles.notifClose} hitSlop={8} onPress={onClose}>
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
            <Pressable accessibilityLabel="Close streak history" style={styles.notifClose} hitSlop={8} onPress={onClose}>
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
  const styles = useThemedStyles(createStyles);
  void goal;
  void color;
  return (
    <View style={styles.macroPill}>
      <Text style={styles.macroValue}><AnimatedNumber value={value} formatter={(n) => `${Math.round(n)}`} style={styles.macroValue} /><Text style={styles.macroUnit}>g</Text></Text>
      <Text style={styles.macroLabel}>{label}</Text>
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

  polishScreen: { flex: 1, backgroundColor: colors.background },
  polishHero: { width: "100%", position: "relative" },
  polishHeroHeader: {
    position: "absolute",
    left: 24,
    right: 24,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  polishGreeting: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 5,
  },
  polishName: { fontFamily: fonts.serifMedium, fontSize: 30, lineHeight: 32, color: "#FFFFFF" },
  polishHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  polishNotifDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.9)",
  },
  polishAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
  },
  polishAvatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  polishAvatarInitial: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.accent },
  polishHeroBottom: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 24,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  polishHeroCopy: { flex: 1, minWidth: 0 },
  polishHeroEyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.70)",
    marginBottom: 8,
  },
  polishHeroTitle: { fontFamily: fonts.serifMedium, fontSize: 30, lineHeight: 34, color: "#FFFFFF" },
  polishHeroMeta: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 },
  polishHeroMetaText: { fontFamily: fonts.sansSemibold, fontSize: 12, color: "rgba(255,255,255,0.85)" },
  polishHeroCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    maxWidth: 142,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  polishHeroCtaText: { flexShrink: 1, fontFamily: fonts.sansBold, fontSize: 13.5, color: "#FFFFFF" },
  polishContent: { paddingHorizontal: 24, paddingTop: 18, gap: 18 },
  polishConditionalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  polishConditionalIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  polishConditionalTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
  polishConditionalText: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 16, color: colors.muted, marginTop: 2 },
  polishConditionalCta: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.primary },
  polishConditionalCtaText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.onPrimary },
  polishStreak: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  polishStreakIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  polishStreakCopy: { flex: 1, minWidth: 0 },
  polishStreakTitle: { fontFamily: fonts.sansBold, fontSize: 14.5, lineHeight: 17, color: colors.foreground },
  polishStreakText: { fontFamily: fonts.sans, fontSize: 11.5, color: "rgba(62,39,51,0.50)", marginTop: 1 },
  polishStreakDots: { flexDirection: "row", gap: 4, flexShrink: 0 },
  polishStreakDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(62,39,51,0.12)" },
  polishStreakDotActive: { backgroundColor: colors.primary },
  polishQuote: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 6, paddingVertical: 2 },
  polishQuoteMark: { fontFamily: fonts.serifSemibold, fontSize: 28, lineHeight: 24, color: "rgba(228,93,135,0.35)" },
  polishQuoteText: {
    flex: 1,
    fontFamily: fonts.serifItalicLight,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(62,39,51,0.75)",
  },
  polishQuoteBy: {
    fontFamily: fonts.sansBold,
    fontStyle: "normal",
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.accentDark,
  },
  polishTodayCard: { padding: 18, borderRadius: 22 },
  polishTodayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  polishTodayActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  polishOutlineButton: {
    paddingHorizontal: 14,
    paddingVertical: 7.5,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  polishOutlineButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accentDark },
  polishFilledButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  },
  polishFilledButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.onPrimary },
  polishRings: { flexDirection: "row", gap: 14, marginTop: 18, marginBottom: 16 },
  polishRingColumn: { flex: 1, alignItems: "center", minWidth: 0 },
  polishRingValue: { fontFamily: fonts.serifSemibold, fontSize: 21, lineHeight: 24, color: colors.foreground },
  polishRingGoal: { fontFamily: fonts.sansSemibold, fontSize: 9, color: "rgba(62,39,51,0.40)", marginTop: 2 },
  polishRingLabel: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.foreground, marginTop: 10 },
  polishRingStatus: { maxWidth: "100%", fontFamily: fonts.sansSemibold, fontSize: 10.5, color: colors.accentDark, marginTop: 2 },
  polishHydrationStatus: { fontFamily: fonts.sansSemibold, fontSize: 10.5, color: "rgba(62,39,51,0.50)", marginTop: 2 },
  polishMacros: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(62,39,51,0.07)",
  },
  polishSectionLabel: { marginBottom: 10 },
  polishRowCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  polishRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(62,39,51,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  polishRowTitle: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.foreground },
  polishRowSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  polishSectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
  polishSeeAll: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.accentDark },
  polishSavedGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  polishSavedGridItem: { width: "48.5%" },
  polishSavedCard: { width: "100%", height: 150, borderRadius: 20, overflow: "hidden" },
  polishSavedImage: { width: "100%", height: 150, justifyContent: "flex-end" },
  polishSavedImageRadius: { borderRadius: 20 },
  polishSavedHeart: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  polishSavedInfo: { paddingHorizontal: 12, paddingBottom: 10 },
  polishSavedTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: "#FFFFFF" },
  polishSavedMeta: { fontFamily: fonts.sans, fontSize: 10.5, color: "rgba(255,255,255,0.80)", marginTop: 2 },

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
