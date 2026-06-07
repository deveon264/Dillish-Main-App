import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ImageBackground, Image, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";
import { GradientBackground } from "@/components/GradientBackground";
import { pageHeaderStyles } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { getWorkout } from "@/constants/workouts";
import { listWorkoutExercises, videoUrl, posterUrl } from "@/lib/exercises";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { todayKey, getJSON, setJSON } from "@/lib/storage";
import { useInsets } from "@/hooks/useInsets";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

type Phase = "active" | "rest" | "done";

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Rest gap (seconds) shown as a countdown between exercises before auto-advancing.
// 0 = "Off" (advance immediately). Persisted as a device preference.
const REST_OPTIONS = [0, 10, 15, 30, 60] as const;
const REST_GAP_KEY = "florish.restGapSeconds";
const DEFAULT_REST_GAP = 15;

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
  // Rest gap between exercises (device preference) and the live rest countdown.
  const [restGap, setRestGap] = useState<number>(DEFAULT_REST_GAP);
  const [restRemaining, setRestRemaining] = useState(0);
  // Guards an exercise from being "completed" twice (e.g. video end + countdown).
  // Reset whenever the exercise index changes.
  const completedIndexRef = useRef<number>(-1);
  // Holds the latest completion handler so the video "playToEnd" listener (set up
  // once, before the early returns) always calls the current-closure version.
  const onVideoEndRef = useRef<() => void>(() => {});
  // The exercise-video id currently confirmed-loaded into the player. A "playToEnd"
  // only completes the exercise when it matches the current exercise's video, so a
  // stale end event from an outgoing clip (mid-transition) can't advance the next
  // exercise. Reset to null while a new clip is loading.
  const loadedVideoIdRef = useRef<string | null>(null);
  const [tab, setTab] = useState<"exercises" | "guidance" | "progress">("exercises");
  const [toast, setToast] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState<keyof typeof Ionicons.glyphMap>("lock-closed");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const savedRef = useRef(false);

  // Each exercise in this workout can have its OWN uploaded video, keyed by the
  // exercise id. We load them up front and play the matching one in the header.
  const [videoMap, setVideoMap] = useState<Record<string, { id: string; hasPoster: boolean }>>({});
  // Live playback position/length of the currently loaded video. When a video is
  // present the progress bar reflects THESE (the real clip), not the simulated
  // per-exercise countdown.
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
  });
  // Read inside effects that must NOT re-run when paused toggles (reloading the
  // source would restart the video from the beginning).
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // Monotonic token so a slow video load for a previous exercise can't apply
  // (or auto-play) after the user has already moved to another exercise.
  const loadSeq = useRef(0);

  // Keep the progress bar in sync with the real video clip.
  useEventListener(player, "timeUpdate", (e: { currentTime: number }) => {
    setVideoTime(e?.currentTime ?? 0);
  });
  useEventListener(player, "statusChange", ({ status }: { status: string }) => {
    if (status === "readyToPlay") {
      const d = player.duration;
      if (typeof d === "number" && isFinite(d) && d > 0) setVideoDuration(d);
    }
  });
  // When the real clip reaches its end, the exercise is done — drive the rest
  // gap / auto-advance instead of leaving the player idle on the last frame.
  useEventListener(player, "playToEnd", () => {
    onVideoEndRef.current();
  });

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
    setPhase("active");
    setRestRemaining(0);
    setIndex(i);
    setRemaining(workout!.exercises[i].seconds);
    setPaused(false);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(`Replaying ${workout!.exercises[i].name}`, "reload");
  };

  const changeRestGap = (v: number) => {
    setRestGap(v);
    setJSON(REST_GAP_KEY, v);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(v === 0 ? "Rest off" : `Rest set to ${v}s`, "hourglass");
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
  const currentVideo = current ? videoMap[current.id] : undefined;

  // Jump forward/back by a fixed step. On a real video we seek the clip; with
  // no video we nudge the simulated countdown so the controls still do something.
  const SEEK_STEP = 15;
  const seekRelative = (delta: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(delta > 0 ? "Forward 15s" : "Back 15s", delta > 0 ? "play-forward" : "play-back");
    // Only seek the clip when a video is actually loaded (duration known). If a
    // mapped video failed to load we fall through to nudging the countdown so
    // the buttons stay responsive.
    if (currentVideo && videoDuration > 0.1) {
      try {
        player.seekBy(delta);
      } catch {
        // ignore transient player state errors
      }
      return;
    }
    setRemaining((r) => {
      const max = current?.seconds ?? r;
      return Math.max(0, Math.min(max, r - delta));
    });
  };

  // Restore the saved rest-gap preference once on mount.
  useEffect(() => {
    let on = true;
    getJSON<number>(REST_GAP_KEY, DEFAULT_REST_GAP).then((v) => {
      if (on && typeof v === "number" && REST_OPTIONS.includes(v as (typeof REST_OPTIONS)[number])) {
        setRestGap(v);
      }
    });
    return () => {
      on = false;
    };
  }, []);

  // A new exercise can be completed again (clears the double-fire guard).
  useEffect(() => {
    completedIndexRef.current = -1;
  }, [index]);

  // Fetch the videos uploaded for this workout and map each to its exercise.
  // Newest first from the server, so the first row per exercise wins.
  useEffect(() => {
    if (!workout) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await listWorkoutExercises(workout.id);
        if (cancelled) return;
        const map: Record<string, { id: string; hasPoster: boolean }> = {};
        for (const it of items) {
          const exId = it.workoutExerciseId;
          if (exId && !map[exId]) map[exId] = { id: it.id, hasPoster: it.hasPoster };
        }
        setVideoMap(map);
      } catch {
        // No videos / offline: the player falls back to the workout image.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workout?.id]);

  // Load the current exercise's video into the player when it changes. A
  // monotonic token makes the swap race-safe: if the exercise changes again
  // while a load is in flight, the stale load is ignored on completion. We read
  // `paused` via a ref so this never re-runs (and restarts the clip) on a
  // play/pause toggle. The player only plays here if the user has ALREADY
  // started the session — opening a workout stays paused.
  useEffect(() => {
    const seq = ++loadSeq.current;
    const isStale = () => seq !== loadSeq.current;
    setVideoTime(0);
    setVideoDuration(0);
    // No clip confirmed-loaded until the swap below succeeds.
    loadedVideoIdRef.current = null;
    (async () => {
      if (!currentVideo) {
        try {
          await player.replaceAsync(null);
        } catch {
          // ignore
        }
        return;
      }
      try {
        let finalUrl = videoUrl(currentVideo.id);
        if (Platform.OS !== "web") {
          const resp = await fetch(finalUrl, {
            redirect: "follow",
            headers: { Range: "bytes=0-0" },
          });
          if (!resp.ok) throw new Error(`status ${resp.status}`);
          finalUrl = resp.url || finalUrl;
        }
        if (isStale()) return;
        await player.replaceAsync(finalUrl);
        if (isStale()) return;
        loadedVideoIdRef.current = currentVideo.id;
        if (!pausedRef.current) player.play();
      } catch {
        // Leave the header image fallback in place if the video can't load.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.id]);

  // Mirror the user's play/pause onto the real video so the existing play button
  // (and the simulated countdown) drive it together. Keyed only on `paused` so
  // it reacts to user intent, not to exercise changes (those are handled above).
  useEffect(() => {
    if (!currentVideo) return;
    try {
      if (paused) player.pause();
      else player.play();
    } catch {
      // ignore transient player state errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

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

  const hideOverlay = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setControlsShown(false);
    });
  };

  const toggleOverlay = () => {
    if (controlsShown) hideOverlay();
    else revealOverlay();
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

  // For exercises with no playable video, the countdown reaching zero is the
  // completion signal. When a video IS loaded, the "playToEnd" event drives it
  // instead (so a clip shorter/longer than the set time advances at the clip's
  // real end rather than leaving the player idle).
  useEffect(() => {
    if (phase !== "active" || remaining !== 0 || !current) return;
    const hasLoadedVideo = !!currentVideo && videoDuration > 0.1;
    if (hasLoadedVideo) return;
    completeExercise("timer");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase, index, current, currentVideo, videoDuration]);

  // Rest countdown between exercises. Ticks down once per second (pausable), then
  // advances to the next exercise and auto-plays its video.
  useEffect(() => {
    if (phase !== "rest" || paused) return;
    if (restRemaining <= 0) {
      goNext();
      return;
    }
    const t = setTimeout(() => {
      if (Platform.OS !== "web" && restRemaining <= 4) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setRestRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, restRemaining]);

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
      setRestRemaining(0);
      setPhase("active");
      setIndex(ni);
      setRemaining(workout.exercises[ni].seconds);
    } else {
      finish();
    }
  };

  // Marks the current exercise complete (from a video end or a countdown). Guards
  // against firing twice for the same exercise, then either finishes the workout,
  // advances immediately (rest "Off"), or opens the rest countdown. A "video"
  // completion is ignored unless the clip that ended is the one loaded for the
  // current exercise (defends against stale end events during a transition).
  const completeExercise = (source: "video" | "timer") => {
    if (phase !== "active" || !current) return;
    if (source === "video" && (!currentVideo || loadedVideoIdRef.current !== currentVideo.id)) return;
    if (completedIndexRef.current === index) return;
    completedIndexRef.current = index;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (index + 1 >= total) {
      finish();
      return;
    }
    if (restGap <= 0) {
      goNext();
      return;
    }
    setRestRemaining(restGap);
    setPhase("rest");
  };
  onVideoEndRef.current = () => completeExercise("video");

  const finish = () => {
    if (timer.current) clearInterval(timer.current);
    if (!savedRef.current) {
      savedRef.current = true;
      completeWorkout({ workoutId: workout.id, kcal: workout.kcal, durationMin: workout.durationMin });
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase("done");
  };

  if (phase === "rest" && current && index + 1 < total) {
    const next = workout.exercises[index + 1];
    const restPct = `${restGap > 0 ? Math.max(0, Math.min(100, Math.round(((restGap - restRemaining) / restGap) * 100))) : 0}%` as const;
    return (
      <GradientBackground>
        <ImageBackground source={next.image ?? workout.image} style={styles.restScreen}>
          <LinearGradient
            colors={["rgba(16,17,17,0.55)", "rgba(16,17,17,0.78)", "rgba(16,17,17,0.95)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.restTop, { marginTop: insets.top + 8 }]}>
            <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.onPrimary} />
            </Pressable>
            <Pressable style={styles.roundBtn} onPress={togglePause} hitSlop={8}>
              <Ionicons name={paused ? "play" : "pause"} size={20} color={colors.onPrimary} />
            </Pressable>
          </View>

          <View style={styles.restBody}>
            <Text style={styles.restEyebrow}>REST</Text>
            <Text style={styles.restCount}>{restRemaining}</Text>
            <Text style={styles.restCountUnit}>seconds</Text>
            <View style={styles.restTrack}>
              <View style={[styles.restFill, { width: restPct }]} />
            </View>
            <Text style={styles.restUpNext}>UP NEXT · {index + 2}/{total}</Text>
            <Text style={styles.restNextName}>{next.name}</Text>
            <Text style={styles.restNextMeta}>
              {next.detail} · {next.sets} sets · {next.seconds} sec
            </Text>
          </View>

          <View style={[styles.restActions, { paddingBottom: insets.bottom + 24 }]}>
            <Pressable style={styles.restAddBtn} onPress={() => setRestRemaining((r) => r + 15)} hitSlop={8}>
              <Ionicons name="add" size={18} color={colors.onPrimary} />
              <Text style={styles.restAddText}>15s</Text>
            </Pressable>
            <Pressable style={styles.restStartBtn} onPress={goNext}>
              <Ionicons name="play" size={18} color={colors.onPrimaryStrong} />
              <Text style={styles.restStartText}>Start now</Text>
            </Pressable>
          </View>
        </ImageBackground>
      </GradientBackground>
    );
  }

  if (phase === "active" && current) {
    const totalSeconds = workout.exercises.reduce((s, e) => s + e.seconds, 0);
    const priorSeconds = workout.exercises.slice(0, index).reduce((s, e) => s + e.seconds, 0);
    const elapsed = priorSeconds + (current.seconds - remaining);
    const overall = totalSeconds > 0 ? elapsed / totalSeconds : 0;
    const overallPct = `${Math.round(overall * 100)}%` as const;
    // When this exercise has an uploaded video, the bar always tracks the clip:
    // 0:00 / empty while it loads, then the real clip time. Exercises with no
    // video keep the whole-workout simulated timeline.
    const hasMappedVideo = !!currentVideo;
    const barElapsed = hasMappedVideo ? Math.min(videoTime, videoDuration) : elapsed;
    const barTotal = hasMappedVideo ? videoDuration : totalSeconds;
    const barPct = `${Math.round((barTotal > 0 ? barElapsed / barTotal : 0) * 100)}%` as const;
    // While a mapped clip loads, show its poster (the video's own frame) instead
    // of the generic stock thumbnail. No poster → neutral dark background.
    const playerImage = hasMappedVideo
      ? currentVideo!.hasPoster
        ? { uri: posterUrl(currentVideo!.id) }
        : undefined
      : current.image ?? workout.image;
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
          <ImageBackground source={playerImage} style={styles.player}>
            {currentVideo && (
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={false}
                pointerEvents="none"
              />
            )}
            <LinearGradient
              colors={["rgba(16,17,17,0.5)", "rgba(16,17,17,0.2)", "rgba(16,17,17,0.85)"]}
              style={StyleSheet.absoluteFill}
            />
            <Pressable style={StyleSheet.absoluteFill} onPress={toggleOverlay} />

            <Animated.View
              style={[styles.playerOverlay, { opacity: overlayOpacity, pointerEvents: controlsShown ? "auto" : "none" }]}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={toggleOverlay} />

              <View style={[styles.playerTop, { marginTop: insets.top + 8, pointerEvents: "box-none" }]}>
                <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color={colors.onPrimary} />
                </Pressable>
              </View>

              <View style={[styles.playerControls, { pointerEvents: "box-none" }]}>
                <Pressable style={styles.playerCtrl} onPress={() => seekRelative(-SEEK_STEP)} hitSlop={8}>
                  <Ionicons name="play-back" size={24} color={colors.onPrimary} />
                  <Text style={styles.seekLabel}>15</Text>
                </Pressable>
                <Pressable style={styles.playerPlay} onPress={togglePause}>
                  <Ionicons name={paused ? "play" : "pause"} size={34} color={colors.onPrimary} />
                </Pressable>
                <Pressable style={styles.playerCtrl} onPress={() => seekRelative(SEEK_STEP)} hitSlop={8}>
                  <Ionicons name="play-forward" size={24} color={colors.onPrimary} />
                  <Text style={styles.seekLabel}>15</Text>
                </Pressable>
              </View>

              <View style={[styles.playerBar, { pointerEvents: "none" }]}>
                <Text style={styles.playerTime}>{fmt(barElapsed)}</Text>
                <View style={styles.playerTrack}>
                  <View style={[styles.playerFill, { width: barPct }]} />
                  <View style={[styles.playerThumb, { left: barPct }]} />
                </View>
                <Text style={styles.playerTime}>{fmt(barTotal)}</Text>
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
                <Text style={pageHeaderStyles.titleAccent}>{titleTail}</Text>
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
                <Ionicons name="flame" size={18} color={colors.highlight} />
                <Text style={[styles.statNum, { color: colors.highlight }]}>{kcalBurned}</Text>
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

            <View style={styles.restPickRow}>
              <View style={styles.restPickLabel}>
                <Ionicons name="hourglass-outline" size={14} color={colors.muted} />
                <Text style={styles.restPickLabelText}>Rest between exercises</Text>
              </View>
              <View style={styles.restPickChips}>
                {REST_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[styles.restChip, restGap === opt && styles.restChipOn]}
                    onPress={() => changeRestGap(opt)}
                    hitSlop={4}
                  >
                    <Text style={[styles.restChipText, restGap === opt && styles.restChipTextOn]}>
                      {opt === 0 ? "Off" : `${opt}s`}
                    </Text>
                  </Pressable>
                ))}
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
                      <Image source={e.image ?? workout.image} style={styles.exThumb} />
                      <View style={{ flex: 1, minWidth: 0 }}>
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
                            onPress={() =>
                              router.push({
                                pathname: "/admin/upload-exercise",
                                params: {
                                  workoutId: workout.id,
                                  exerciseId: e.id,
                                  title: e.name,
                                  category: workout.category,
                                  level: workout.level,
                                },
                              })
                            }
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
  player: { height: 360, justifyContent: "space-between", backgroundColor: "#000" },
  playerOverlay: { flex: 1, justifyContent: "space-between" },
  playerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(16,17,17,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  playerControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 },
  playerCtrl: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(16,17,17,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  seekLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: 10,
    color: "#FFFFFF",
    marginTop: 1,
  },
  playerPlay: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  playerBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 18 },
  playerTime: { fontFamily: fonts.sansMedium, fontSize: 12, color: "#FFFFFF" },
  playerTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", justifyContent: "center" },
  playerFill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  playerThumb: {
    position: "absolute",
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
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
    backgroundColor: colors.track,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDotDone: { backgroundColor: colors.accentFill, borderColor: "transparent" },
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
  exCardActive: { borderColor: colors.accent, backgroundColor: colors.accentTint },
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
  exCardMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 3 },
  exCardMetaText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
  exChip: { backgroundColor: "rgba(16,17,17,0.06)", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },
  toastText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  exUpload: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentTint,
    borderWidth: 1,
    borderColor: colors.accentBorderLg,
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
  restPickRow: { marginTop: 16, gap: 10 },
  restPickLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  restPickLabelText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted, letterSpacing: 0.3 },
  restPickChips: { flexDirection: "row", gap: 8 },
  restChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  restChipOn: { backgroundColor: colors.accent, borderColor: "transparent" },
  restChipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  restChipTextOn: { color: colors.onPrimary },
  restScreen: { flex: 1, justifyContent: "space-between" },
  restTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  restBody: { alignItems: "center", paddingHorizontal: 24 },
  restEyebrow: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent, letterSpacing: 3 },
  restCount: { fontFamily: fonts.serifSemibold, fontSize: 96, lineHeight: 104, color: "#FFFFFF" },
  restCountUnit: { fontFamily: fonts.sansMedium, fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: -4 },
  restTrack: {
    width: "70%",
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
    marginTop: 22,
  },
  restFill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  restUpNext: { fontFamily: fonts.sansSemibold, fontSize: 11.5, color: "rgba(255,255,255,0.7)", letterSpacing: 1.4, marginTop: 30 },
  restNextName: { fontFamily: fonts.serifSemibold, fontSize: 30, color: "#FFFFFF", marginTop: 8, textAlign: "center" },
  restNextMeta: { fontFamily: fonts.sans, fontSize: 13.5, color: "rgba(255,255,255,0.7)", marginTop: 6, textAlign: "center" },
  restActions: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24 },
  restAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 54,
    paddingHorizontal: 20,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(16,17,17,0.4)",
  },
  restAddText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: "#FFFFFF" },
  restStartBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: colors.radius,
    backgroundColor: colors.primary,
  },
  restStartText: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.onPrimaryStrong },
});
