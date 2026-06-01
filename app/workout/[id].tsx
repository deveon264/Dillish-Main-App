import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ImageBackground, Image, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { getWorkout } from "@/constants/workouts";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { todayKey } from "@/lib/storage";
import { useInsets } from "@/hooks/useInsets";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

type Phase = "active" | "done";

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WorkoutPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useInsets();
  const { completeWorkout, completions, toggleFavorite, isFavorite } = useData();
  const { isAdmin } = useAuth();
  const workout = getWorkout(id);
  const fav = workout ? isFavorite(workout.id) : false;

  const [phase, setPhase] = useState<Phase>("active");
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(() => workout?.exercises[0]?.seconds ?? 0);
  const [paused, setPaused] = useState(true);
  const [tab, setTab] = useState<"exercises" | "guidance" | "progress">("exercises");
  const [toast, setToast] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState<keyof typeof Ionicons.glyphMap>("lock-closed");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const savedRef = useRef(false);

  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [controlsShown, setControlsShown] = useState(true);

  const showToast = (msg: string, icon: keyof typeof Ionicons.glyphMap = "lock-closed") => {
    setToast(msg);
    setToastIcon(icon);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setToast(null);
      });
    }, 1800);
  };

  const jumpTo = (i: number) => {
    if (i >= index) return;
    setIndex(i);
    setRemaining(workout!.exercises[i].seconds);
    setPaused(false);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(`Replaying ${workout!.exercises[i].name}`, "reload");
  };

  const togglePause = () => {
    setPaused((p) => {
      const next = !p;
      showToast(next ? "Paused" : "Resumed", next ? "pause" : "play");
      return next;
    });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleFav = () => {
    if (!workout) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(workout.id);
    showToast(fav ? "Removed from saved" : "Saved to favorites", fav ? "heart-dislike" : "heart");
  };

  const current = workout?.exercises[index];
  const total = workout?.exercises.length ?? 0;

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setControlsShown(false);
      });
    }, 3000);
  };

  const revealOverlay = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setControlsShown(true);
    Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (!paused) scheduleHide();
  };

  useEffect(() => {
    if (paused) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setControlsShown(true);
      Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      scheduleHide();
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  useEffect(() => {
    if (phase !== "active" || paused || !current || remaining <= 0) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase, index, current]);

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
    const kcalPct = `${Math.round(overall * 100)}%` as const;
    const bpm = 96 + Math.round(overall * 44);
    const zone = bpm < 110 ? "Light" : bpm < 135 ? "Moderate" : "Intense";
    const bpmPct = `${Math.min(100, Math.round(((bpm - 60) / 120) * 100))}%` as const;
    const completionDays = new Set(completions.map((c) => todayKey(new Date(c.ts))));
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const tkNow = todayKey();
    const weekMarks = WEEK_LABELS.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const k = todayKey(d);
      return { label, active: completionDays.has(k), isToday: k === tkNow };
    });
    let streak = 0;
    const sd = new Date();
    if (!completionDays.has(todayKey(sd))) sd.setDate(sd.getDate() - 1);
    while (completionDays.has(todayKey(sd))) {
      streak += 1;
      sd.setDate(sd.getDate() - 1);
    }
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
            <Pressable style={StyleSheet.absoluteFill} onPress={revealOverlay} />

            <Animated.View
              style={[styles.playerOverlay, { opacity: overlayOpacity, pointerEvents: controlsShown ? "auto" : "none" }]}
            >
              <View style={[styles.playerTop, { marginTop: insets.top + 8 }]}>
                <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color={colors.foreground} />
                </Pressable>
              </View>

              <View style={styles.playerControls}>
                <Pressable style={styles.playerCtrl} onPress={goPrev} disabled={index === 0}>
                  <Ionicons name="play-skip-back" size={26} color={index === 0 ? colors.mutedForeground : colors.foreground} />
                </Pressable>
                <Pressable style={styles.playerPlay} onPress={togglePause}>
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
            </Animated.View>
          </ImageBackground>

          <View style={styles.info}>
            <View style={styles.infoTop}>
              <View style={styles.rowCenter}>
                <View style={styles.catPill}>
                  <Text style={styles.catPillText}>{workout.category.toUpperCase()}</Text>
                </View>
                <Text style={styles.levelText}>{workout.level.toUpperCase()}</Text>
              </View>
              <View style={styles.infoActions}>
                <Pressable
                  style={styles.shareBtn}
                  hitSlop={8}
                  onPress={toggleFav}
                >
                  <Ionicons name={fav ? "heart" : "heart-outline"} size={18} color={fav ? colors.accent : colors.foreground} />
                </Pressable>
                <Pressable style={styles.shareBtn} hitSlop={8}>
                  <Ionicons name="share-social-outline" size={18} color={colors.foreground} />
                </Pressable>
              </View>
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
              <View style={{ gap: 14, marginTop: 20 }}>
                {workout.exercises.map((e, i) => {
                  const done = i < index;
                  const isCurrent = i === index;
                  const locked = i > index;
                  return (
                    <Pressable
                      key={e.id}
                      disabled={isCurrent}
                      onPress={() => (locked ? showToast("Complete the current exercise first") : jumpTo(i))}
                      style={({ pressed }) => [
                        styles.exCard,
                        isCurrent && styles.exCardActive,
                        locked && styles.exCardLocked,
                        pressed && done && styles.exCardPressed,
                      ]}
                    >
                      {isCurrent && (
                        <View style={styles.nowTag}>
                          <Text style={styles.nowTagText}>Now</Text>
                        </View>
                      )}
                      {done && (
                        <View style={styles.exCheck}>
                          <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
                        </View>
                      )}
                      <Image source={workout.image} style={styles.exThumb} />
                      <View style={{ flex: 1 }}>
                        {isCurrent && <Text style={styles.exEyebrow}>EXERCISE {i + 1}</Text>}
                        <Text style={[styles.exCardTitle, done && styles.exCardTitleDone]}>{e.name}</Text>
                        <View style={styles.exCardMeta}>
                          <Text style={styles.exCardMetaText}>{e.sets} sets · {e.seconds} sec</Text>
                          {isCurrent && (
                            <View style={styles.exChip}>
                              <Text style={styles.exChipText}>{e.detail}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.exRight}>
                        {isCurrent ? (
                          <Pressable style={styles.exPlay} onPress={togglePause} hitSlop={6}>
                            <Ionicons name={paused ? "play" : "pause"} size={18} color={colors.onPrimary} />
                          </Pressable>
                        ) : done ? (
                          <View style={styles.exReplay}>
                            <Ionicons name="reload" size={14} color={colors.accent} />
                            <Text style={styles.exReplayText}>Replay</Text>
                          </View>
                        ) : (
                          <View style={styles.exLock}>
                            <Ionicons name="lock-closed-outline" size={17} color={colors.muted} />
                          </View>
                        )}
                        {isAdmin && (
                          <Pressable
                            style={styles.exUpload}
                            onPress={() => router.push("/admin/upload-exercise")}
                            hitSlop={6}
                          >
                            <Ionicons name="cloud-upload-outline" size={17} color={colors.accent} />
                          </Pressable>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {tab === "guidance" && (
              <View style={{ marginTop: 18, gap: 16 }}>
                <View style={styles.guideCard}>
                  <View style={styles.guideHead}>
                    <Ionicons name="information-circle-outline" size={15} color={colors.accent} />
                    <Text style={styles.guideHeadText}>CURRENT EXERCISE</Text>
                  </View>
                  <Text style={styles.guideTitle}>
                    {current.name.split(" ").slice(0, -1).join(" ")}
                    {current.name.split(" ").length > 1 ? " " : ""}
                    <Text style={styles.guideTitleItalic}>{current.name.split(" ").slice(-1)[0]}</Text>
                  </Text>
                  <Text style={styles.guideDesc}>{current.description}</Text>
                </View>

                <View style={styles.guideCard}>
                  <View style={styles.guideHead}>
                    <Ionicons name="list-outline" size={15} color={colors.accent} />
                    <Text style={styles.guideHeadText}>KEY CUES</Text>
                  </View>
                  <View style={{ gap: 14, marginTop: 6 }}>
                    {current.cues.map((c, i) => (
                      <View key={i} style={styles.cueRow}>
                        <View style={styles.cueNum}>
                          <Text style={styles.cueNumText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.cueRowText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.guideCard}>
                  <View style={styles.guideHead}>
                    <Ionicons name="warning-outline" size={15} color={colors.accent} />
                    <Text style={styles.guideHeadText}>MODIFICATIONS</Text>
                  </View>
                  <Text style={styles.guideDesc}>{current.modifications}</Text>
                </View>
              </View>
            )}

            {tab === "progress" && (
              <View style={{ marginTop: 18, gap: 16 }}>
                <View style={styles.guideCard}>
                  <View style={styles.sessRow}>
                    <Text style={styles.guideHeadText}>SESSION PROGRESS</Text>
                    <Text style={styles.sessPct}>{Math.round(overall * 100)}%</Text>
                  </View>
                  <View style={[styles.progressBarBg, { marginTop: 14 }]}>
                    <LinearGradient
                      colors={colors.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressBarFill, { width: overallPct }]}
                    />
                  </View>
                  <View style={[styles.sessRow, { marginTop: 12 }]}>
                    <Text style={styles.sessMeta}>{fmt(elapsed)} elapsed</Text>
                    <Text style={styles.sessMeta}>{fmt(Math.max(0, totalSeconds - elapsed))} remaining</Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 14 }}>
                  <View style={[styles.guideCard, { flex: 1 }]}>
                    <View style={styles.statHead}>
                      <Ionicons name="flame-outline" size={15} color={colors.accent} />
                      <Text style={styles.statHeadText}>Calories</Text>
                    </View>
                    <Text style={styles.statBig}>{kcalBurned}</Text>
                    <Text style={styles.statSub}>of {workout.kcal} kcal</Text>
                    <View style={[styles.miniBar, { marginTop: 12 }]}>
                      <LinearGradient
                        colors={colors.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.miniBarFill, { width: kcalPct }]}
                      />
                    </View>
                  </View>
                  <View style={[styles.guideCard, { flex: 1 }]}>
                    <View style={styles.statHead}>
                      <Ionicons name="heart-outline" size={15} color={colors.accent} />
                      <Text style={styles.statHeadText}>Heart Rate</Text>
                    </View>
                    <Text style={styles.statBig}>{bpm}</Text>
                    <Text style={styles.statSub}>bpm · {zone}</Text>
                    <View style={[styles.miniBar, { marginTop: 12 }]}>
                      <LinearGradient
                        colors={colors.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.miniBarFill, { width: bpmPct }]}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.guideCard}>
                  <View style={styles.sessRow}>
                    <Text style={styles.guideHeadText}>WEEKLY STREAK</Text>
                    <Text style={styles.streakDaysText}>🔥 {streak} days</Text>
                  </View>
                  <View style={styles.weekRow}>
                    {weekMarks.map((d, i) => (
                      <View key={i} style={styles.weekCol}>
                        <View
                          style={[
                            styles.weekDot,
                            d.active && styles.weekDotDone,
                            d.isToday && !d.active && styles.weekDotToday,
                          ]}
                        >
                          {d.active ? (
                            <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                          ) : d.isToday ? (
                            <Ionicons name="barbell" size={15} color={colors.onPrimary} />
                          ) : (
                            <Text style={styles.weekDash}>–</Text>
                          )}
                        </View>
                        <Text style={[styles.weekLabel, d.isToday && styles.weekLabelToday]}>{d.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.guideCard}>
                  <Text style={styles.completeHint}>Complete the session to log your progress</Text>
                  <Pressable style={styles.completeBtn} onPress={finish}>
                    <Ionicons name="flag" size={16} color={colors.onPrimary} />
                    <Text style={styles.completeBtnText}>Mark as Complete</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {tab !== "progress" && (
              <Pressable style={styles.endBtn} onPress={finish}>
                <Ionicons name="stop" size={16} color={colors.accent} />
                <Text style={styles.endBtnText}>End Session</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
        {toast && (
          <Animated.View
            style={[
              styles.toast,
              {
                bottom: insets.bottom + 24,
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Ionicons name={toastIcon} size={14} color={colors.foreground} />
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        )}
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
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  player: { height: 360, justifyContent: "space-between" },
  playerOverlay: { flex: 1, justifyContent: "space-between" },
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
  infoActions: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  guideCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 18,
  },
  guideHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  guideHeadText: { fontFamily: fonts.sansSemibold, fontSize: 11.5, color: colors.accent, letterSpacing: 1.2 },
  guideTitle: { fontFamily: fonts.serif, fontSize: 26, color: colors.foreground },
  guideTitleItalic: { fontFamily: fonts.serifItalic, fontSize: 26, color: colors.foreground },
  guideDesc: { fontFamily: fonts.sans, fontSize: 14.5, color: colors.muted, lineHeight: 22, marginTop: 8 },
  cueRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cueNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginTop: 1 },
  cueNumText: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.onPrimary },
  cueRowText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.foreground, lineHeight: 21 },
  progressBarBg: { height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: "hidden" },
  progressBarFill: { height: 10, borderRadius: 5 },
  sessRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sessPct: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.primary },
  sessMeta: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  statHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  statHeadText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  statBig: { fontFamily: fonts.serifSemibold, fontSize: 32, color: colors.foreground },
  statSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  miniBar: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: "hidden" },
  miniBarFill: { height: 6, borderRadius: 3 },
  streakDaysText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.accent },
  weekRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  weekCol: { alignItems: "center", gap: 8 },
  weekDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(247,235,232,0.08)",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDotDone: { backgroundColor: "rgba(201,137,122,0.30)", borderColor: "transparent" },
  weekDotToday: { backgroundColor: colors.accent, borderColor: "transparent" },
  weekDash: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.muted },
  weekLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },
  weekLabelToday: { color: colors.primary },
  completeHint: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: 14 },
  completeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: colors.radius,
    backgroundColor: colors.primary,
  },
  completeBtnText: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.onPrimary },
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
  exCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    padding: 12,
    position: "relative",
  },
  exCardActive: { borderColor: colors.accent, backgroundColor: "rgba(201,137,122,0.12)" },
  exCardLocked: { opacity: 0.5 },
  exCardPressed: { opacity: 0.7 },
  nowTag: {
    position: "absolute",
    top: -9,
    left: 14,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  nowTagText: { fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.onPrimary, letterSpacing: 0.5 },
  exCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  exThumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.track },
  exEyebrow: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.accent, letterSpacing: 1, marginBottom: 2 },
  exCardTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  exCardTitleDone: { color: colors.muted, textDecorationLine: "line-through" },
  exCardMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  exCardMetaText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
  exChip: { backgroundColor: "rgba(247,235,232,0.10)", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  exChipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.accent },
  exRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  exPlay: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  exReplay: { flexDirection: "row", alignItems: "center", gap: 5 },
  exReplayText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.accent },
  exLock: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  toast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(28,22,21,0.95)",
    borderWidth: 1,
    borderColor: "rgba(247,235,232,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },
  toastText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  exUpload: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(242,212,204,0.12)",
    borderWidth: 1,
    borderColor: "rgba(242,212,204,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontFamily: fonts.serifSemibold, fontSize: 34, color: colors.foreground, marginTop: 24 },
  doneSub: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center", marginTop: 10, lineHeight: 23 },
  doneStats: { flexDirection: "row", alignItems: "center", marginTop: 32, backgroundColor: colors.card, borderRadius: colors.radiusLg, borderWidth: 1, borderColor: colors.cardBorder, paddingVertical: 20, paddingHorizontal: 10, alignSelf: "stretch", justifyContent: "space-around" },
  doneStat: { alignItems: "center", flex: 1 },
  doneStatNum: { fontFamily: fonts.serifSemibold, fontSize: 26, color: colors.accent },
  doneStatLbl: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  doneStatDivider: { width: 1, height: 40, backgroundColor: colors.cardBorder },
});
