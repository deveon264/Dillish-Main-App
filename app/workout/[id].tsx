import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { getWorkout } from "@/constants/workouts";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

type Phase = "active" | "done";

export default function WorkoutPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useInsets();
  const { completeWorkout } = useData();
  const workout = getWorkout(id);

  const [phase, setPhase] = useState<Phase>("active");
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(() => workout?.exercises[0]?.seconds ?? 0);
  const [paused, setPaused] = useState(false);
  const [tab, setTab] = useState<"exercises" | "guidance" | "progress">("exercises");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedRef = useRef(false);

  const current = workout?.exercises[index];
  const total = workout?.exercises.length ?? 0;

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "active" || paused || !current) return;
    timer.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [phase, paused, index, current]);

  useEffect(() => {
    if (phase === "active" && remaining === 0 && current) {
      goNext();
    }
  }, [remaining, phase]);

  if (!workout) {
    return (
      <GradientBackground>
        <View style={styles.center}>
          <Text style={styles.notFound}>Workout not found</Text>
          <Button label="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: 16, width: 200 }} />
        </View>
      </GradientBackground>
    );
  }

  const goNext = () => {
    if (index + 1 < total) {
      const ni = index + 1;
      setIndex(ni);
      setRemaining(workout.exercises[ni].seconds);
    } else {
      finish();
    }
  };

  const goPrev = () => {
    if (index > 0) {
      const pi = index - 1;
      setIndex(pi);
      setRemaining(workout.exercises[pi].seconds);
    }
  };

  const finish = () => {
    if (timer.current) clearInterval(timer.current);
    if (!savedRef.current) {
      savedRef.current = true;
      completeWorkout({ workoutId: workout.id, kcal: workout.kcal, durationMin: workout.durationMin });
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase("done");
  };

  if (phase === "active" && current) {
    const totalSeconds = workout.exercises.reduce((s, e) => s + e.seconds, 0);
    const priorSeconds = workout.exercises.slice(0, index).reduce((s, e) => s + e.seconds, 0);
    const elapsed = priorSeconds + (current.seconds - remaining);
    const overall = totalSeconds > 0 ? elapsed / totalSeconds : 0;
    const overallPct = `${Math.round(overall * 100)}%` as const;
    const kcalBurned = Math.round(workout.kcal * overall);
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    const parts = workout.title.split(" ");
    const titleTail = parts.length > 1 ? parts.pop()! : "";
    const titleHead = parts.join(" ");

    return (
      <GradientBackground>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          <ImageBackground source={workout.image} style={styles.player}>
            <LinearGradient
              colors={["rgba(44,36,34,0.5)", "rgba(44,36,34,0.2)", "rgba(44,36,34,0.85)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.playerTop, { marginTop: insets.top + 8 }]}>
              <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color={colors.foreground} />
              </Pressable>
              <View style={styles.nowPlaying}>
                <Text style={styles.nowPlayingText}>NOW PLAYING</Text>
              </View>
              <Pressable style={styles.roundBtn} hitSlop={8}>
                <Ionicons name="heart-outline" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.playerControls}>
              <Pressable style={styles.playerCtrl} onPress={goPrev} disabled={index === 0}>
                <Ionicons name="play-skip-back" size={26} color={index === 0 ? colors.mutedForeground : colors.foreground} />
              </Pressable>
              <Pressable style={styles.playerPlay} onPress={() => setPaused((p) => !p)}>
                <Ionicons name={paused ? "play" : "pause"} size={34} color={colors.foreground} />
              </Pressable>
              <Pressable style={styles.playerCtrl} onPress={goNext}>
                <Ionicons name="play-skip-forward" size={26} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.playerBar}>
              <Text style={styles.playerTime}>{fmt(elapsed)}</Text>
              <View style={styles.playerTrack}>
                <View style={[styles.playerFill, { width: overallPct }]} />
                <View style={[styles.playerThumb, { left: overallPct }]} />
              </View>
              <Text style={styles.playerTime}>{fmt(totalSeconds)}</Text>
            </View>
          </ImageBackground>

          <View style={styles.info}>
            <View style={styles.infoTop}>
              <View style={styles.rowCenter}>
                <View style={styles.catPill}>
                  <Text style={styles.catPillText}>{workout.category.toUpperCase()}</Text>
                </View>
                <Text style={styles.levelText}>{workout.level.toUpperCase()}</Text>
              </View>
              <Pressable style={styles.shareBtn} hitSlop={8}>
                <Ionicons name="share-social-outline" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.titleRow}>
              <Text style={styles.playerTitle}>
                {titleHead}
                {titleHead ? " " : ""}
                <Text style={styles.playerTitleItalic}>{titleTail}</Text>
              </Text>
              <View style={styles.rating}>
                <Ionicons name="star" size={14} color={colors.accent} />
                <Text style={styles.ratingText}>4.9</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={15} color={colors.muted} />
                <Text style={styles.metaText2}>{workout.durationMin} min</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="flame-outline" size={15} color={colors.muted} />
                <Text style={styles.metaText2}>{workout.kcal} kcal</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={15} color={colors.muted} />
                <Text style={styles.metaText2}>Florish</Text>
              </View>
            </View>

            <View style={styles.statCards}>
              <View style={styles.statCard}>
                <Ionicons name="flame" size={18} color={colors.accent} />
                <Text style={styles.statNum}>{kcalBurned}</Text>
                <Text style={styles.statLbl}>kcal burned</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="time" size={18} color={colors.accent} />
                <Text style={styles.statNum}>{fmt(elapsed)}</Text>
                <Text style={styles.statLbl}>elapsed</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="list" size={18} color={colors.accent} />
                <Text style={styles.statNum}>{index + 1}/{total}</Text>
                <Text style={styles.statLbl}>exercises</Text>
              </View>
            </View>

            <View style={styles.tabs}>
              {(["exercises", "guidance", "progress"] as const).map((t) => (
                <Pressable key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
                  <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === "exercises" && (
              <View style={{ gap: 10, marginTop: 16 }}>
                {workout.exercises.map((e, i) => (
                  <View key={e.id} style={[styles.exRow, i === index && styles.exRowActive]}>
                    <View style={[styles.exNum, i < index && styles.exNumDone, i === index && styles.exNumActive]}>
                      {i < index ? (
                        <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                      ) : (
                        <Text style={[styles.exNumText, i === index && { color: colors.onPrimary }]}>{i + 1}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exName}>{e.name}</Text>
                      <Text style={styles.exDetail}>{e.detail}</Text>
                    </View>
                    <Text style={styles.exTime}>{e.seconds}s</Text>
                  </View>
                ))}
              </View>
            )}

            {tab === "guidance" && (
              <View style={{ marginTop: 16, gap: 8 }}>
                <Text style={styles.guidanceName}>{current.name}</Text>
                <Text style={styles.guidanceDetail}>{current.detail}</Text>
                <View style={styles.cueBox}>
                  <Ionicons name="bulb-outline" size={16} color={colors.accent} />
                  <Text style={styles.cueText}>{current.cue}</Text>
                </View>
              </View>
            )}

            {tab === "progress" && (
              <View style={{ marginTop: 18, gap: 12 }}>
                <View style={styles.progressBarBg}>
                  <LinearGradient
                    colors={colors.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressBarFill, { width: overallPct }]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {Math.round(overall * 100)}% complete · {index + 1} of {total} exercises
                </Text>
              </View>
            )}

            <Pressable style={styles.endBtn} onPress={finish}>
              <Ionicons name="stop" size={16} color={colors.accent} />
              <Text style={styles.endBtnText}>End Session</Text>
            </Pressable>
          </View>
        </ScrollView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <View style={[styles.center, { paddingHorizontal: 32 }]}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={48} color={colors.onPrimary} />
        </View>
        <Text style={styles.doneTitle}>Beautifully done</Text>
        <Text style={styles.doneSub}>You completed {workout.title}. Take a breath and feel proud.</Text>
        <View style={styles.doneStats}>
          <View style={styles.doneStat}>
            <Text style={styles.doneStatNum}>{workout.kcal}</Text>
            <Text style={styles.doneStatLbl}>kcal burned</Text>
          </View>
          <View style={styles.doneStatDivider} />
          <View style={styles.doneStat}>
            <Text style={styles.doneStatNum}>{workout.durationMin}</Text>
            <Text style={styles.doneStatLbl}>minutes</Text>
          </View>
          <View style={styles.doneStatDivider} />
          <View style={styles.doneStat}>
            <Text style={styles.doneStatNum}>{total}</Text>
            <Text style={styles.doneStatLbl}>moves</Text>
          </View>
        </View>
        <Button label="Finish" icon="checkmark" onPress={() => router.back()} style={{ marginTop: 32 }} />
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFound: { fontFamily: fonts.serif, fontSize: 22, color: colors.foreground },
  cover: { height: 320, justifyContent: "flex-end" },
  closeBtn: {
    position: "absolute",
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(44,36,34,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverContent: { padding: 24 },
  badge: { alignSelf: "flex-start", backgroundColor: "rgba(247,235,232,0.18)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, marginBottom: 10 },
  badgeText: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.foreground, letterSpacing: 0.5 },
  coverCat: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.accent, letterSpacing: 1 },
  coverTitle: { fontFamily: fonts.serifSemibold, fontSize: 34, color: colors.foreground, marginTop: 4 },
  coverMeta: { flexDirection: "row", gap: 20, marginTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  body: { padding: 24 },
  desc: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, lineHeight: 23 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.foreground, marginTop: 26, marginBottom: 14 },
  exRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    padding: 14,
  },
  exNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(242,212,204,0.10)", alignItems: "center", justifyContent: "center" },
  exNumText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.accent },
  exName: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  exDetail: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 1 },
  exTime: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.accent },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: "rgba(30,22,20,0.9)",
  },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  player: { height: 360, justifyContent: "space-between" },
  playerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(44,36,34,0.45)",
    borderWidth: 1,
    borderColor: "rgba(247,235,232,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  nowPlaying: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(44,36,34,0.5)",
    borderWidth: 1,
    borderColor: "rgba(247,235,232,0.15)",
  },
  nowPlayingText: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.foreground, letterSpacing: 1.5 },
  playerControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 },
  playerCtrl: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(44,36,34,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  playerPlay: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(247,235,232,0.22)",
    borderWidth: 1,
    borderColor: "rgba(247,235,232,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  playerBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 18 },
  playerTime: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground },
  playerTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(247,235,232,0.25)", justifyContent: "center" },
  playerFill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  playerThumb: {
    position: "absolute",
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.foreground,
    marginLeft: -6,
  },
  info: { paddingHorizontal: 24, paddingTop: 22 },
  infoTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catPill: { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  catPillText: { fontFamily: fonts.sansSemibold, fontSize: 10.5, color: colors.onPrimary, letterSpacing: 0.8 },
  levelText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.muted, letterSpacing: 1 },
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  playerTitle: { flex: 1, fontFamily: fonts.serifSemibold, fontSize: 30, color: colors.foreground },
  playerTitleItalic: { fontFamily: fonts.serifItalic, fontStyle: "italic", color: colors.foreground },
  rating: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 10 },
  ratingText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  metaRow: { flexDirection: "row", gap: 18, marginTop: 12, flexWrap: "wrap" },
  metaText2: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.muted },
  statCards: { flexDirection: "row", gap: 10, marginTop: 22 },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingVertical: 16,
  },
  statNum: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
  statLbl: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
  tabs: {
    flexDirection: "row",
    gap: 4,
    marginTop: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 999,
    padding: 4,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 999 },
  tabOn: { backgroundColor: colors.accent },
  tabText: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.muted },
  tabTextOn: { color: colors.onPrimary },
  exRowActive: { borderColor: colors.accent },
  exNumActive: { backgroundColor: colors.accent },
  exNumDone: { backgroundColor: colors.accent },
  guidanceName: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground },
  guidanceDetail: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  cueBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, marginTop: 6 },
  cueText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  progressBarBg: { height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: "hidden" },
  progressBarFill: { height: 10, borderRadius: 5 },
  progressLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  endBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 26,
    paddingVertical: 15,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  endBtnText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.accent },
  doneIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontFamily: fonts.serifSemibold, fontSize: 34, color: colors.foreground, marginTop: 24 },
  doneSub: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center", marginTop: 10, lineHeight: 23 },
  doneStats: { flexDirection: "row", alignItems: "center", marginTop: 32, backgroundColor: colors.card, borderRadius: colors.radiusLg, borderWidth: 1, borderColor: colors.cardBorder, paddingVertical: 20, paddingHorizontal: 10, alignSelf: "stretch", justifyContent: "space-around" },
  doneStat: { alignItems: "center", flex: 1 },
  doneStatNum: { fontFamily: fonts.serifSemibold, fontSize: 26, color: colors.accent },
  doneStatLbl: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  doneStatDivider: { width: 1, height: 40, backgroundColor: colors.cardBorder },
});
