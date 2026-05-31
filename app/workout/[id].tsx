import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { ProgressRing } from "@/components/ProgressRing";
import { getWorkout } from "@/constants/workouts";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

type Phase = "overview" | "active" | "done";

export default function WorkoutPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useInsets();
  const { completeWorkout } = useData();
  const workout = getWorkout(id);

  const [phase, setPhase] = useState<Phase>("overview");
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
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

  const start = () => {
    setIndex(0);
    setRemaining(workout.exercises[0].seconds);
    setPhase("active");
  };

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

  if (phase === "overview") {
    return (
      <GradientBackground>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
          <ImageBackground source={workout.image} style={[styles.cover, { paddingTop: insets.top }]}>
            <LinearGradient colors={["rgba(44,36,34,0.2)", "rgba(44,36,34,0.95)"]} style={StyleSheet.absoluteFill} />
            <Pressable style={[styles.closeBtn, { top: insets.top + 8 }]} onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
            <View style={styles.coverContent}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{workout.level}</Text>
              </View>
              <Text style={styles.coverCat}>{workout.category}</Text>
              <Text style={styles.coverTitle}>{workout.title}</Text>
              <View style={styles.coverMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={16} color={colors.foreground} />
                  <Text style={styles.metaText}>{workout.durationMin} min</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="flame-outline" size={16} color={colors.foreground} />
                  <Text style={styles.metaText}>{workout.kcal} kcal</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="list-outline" size={16} color={colors.foreground} />
                  <Text style={styles.metaText}>{total} moves</Text>
                </View>
              </View>
            </View>
          </ImageBackground>

          <View style={styles.body}>
            <Text style={styles.desc}>{workout.description}</Text>
            <Text style={styles.sectionTitle}>The flow</Text>
            <View style={{ gap: 10 }}>
              {workout.exercises.map((e, i) => (
                <View key={e.id} style={styles.exRow}>
                  <View style={styles.exNum}>
                    <Text style={styles.exNumText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exName}>{e.name}</Text>
                    <Text style={styles.exDetail}>{e.detail}</Text>
                  </View>
                  <Text style={styles.exTime}>{e.seconds}s</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button label="Begin Workout" icon="play" onPress={start} />
        </View>
      </GradientBackground>
    );
  }

  if (phase === "active" && current) {
    const progress = (current.seconds - remaining) / current.seconds;
    return (
      <GradientBackground>
        <View style={[styles.activeWrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.activeHead}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.foreground} />
            </Pressable>
            <Text style={styles.activeCount}>{index + 1} / {total}</Text>
            <Pressable onPress={finish} hitSlop={10}>
              <Text style={styles.skipAll}>End</Text>
            </Pressable>
          </View>

          <View style={styles.progressTrack}>
            {workout.exercises.map((e, i) => (
              <View
                key={e.id}
                style={[
                  styles.progressSeg,
                  { backgroundColor: i < index ? colors.accent : i === index ? colors.primary : colors.track },
                ]}
              />
            ))}
          </View>

          <View style={styles.timerArea}>
            <ProgressRing size={240} strokeWidth={12} progress={progress}>
              <Text style={styles.timerValue}>{remaining}</Text>
              <Text style={styles.timerUnit}>seconds</Text>
            </ProgressRing>
          </View>

          <View style={styles.exInfo}>
            <Text style={styles.activeName}>{current.name}</Text>
            <Text style={styles.activeDetail}>{current.detail}</Text>
            <View style={styles.cueBox}>
              <Ionicons name="bulb-outline" size={16} color={colors.accent} />
              <Text style={styles.cueText}>{current.cue}</Text>
            </View>
          </View>

          <View style={styles.controls}>
            <Pressable style={styles.ctrlSecondary} onPress={goPrev} disabled={index === 0}>
              <Ionicons name="play-skip-back" size={22} color={index === 0 ? colors.mutedForeground : colors.foreground} />
            </Pressable>
            <Pressable style={styles.ctrlMain} onPress={() => setPaused((p) => !p)}>
              <Ionicons name={paused ? "play" : "pause"} size={30} color={colors.onPrimary} />
            </Pressable>
            <Pressable style={styles.ctrlSecondary} onPress={goNext}>
              <Ionicons name="play-skip-forward" size={22} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
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
  activeWrap: { flex: 1, paddingHorizontal: 24 },
  activeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  activeCount: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  skipAll: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.accent },
  progressTrack: { flexDirection: "row", gap: 4, marginTop: 20 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  timerArea: { alignItems: "center", justifyContent: "center", flex: 1 },
  timerValue: { fontFamily: fonts.serifLight, fontSize: 84, color: colors.foreground },
  timerUnit: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted, marginTop: -8 },
  exInfo: { alignItems: "center" },
  activeName: { fontFamily: fonts.serifSemibold, fontSize: 30, color: colors.foreground, textAlign: "center" },
  activeDetail: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 4 },
  cueBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, marginTop: 18 },
  cueText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28, marginTop: 32 },
  ctrlSecondary: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  ctrlMain: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  doneIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontFamily: fonts.serifSemibold, fontSize: 34, color: colors.foreground, marginTop: 24 },
  doneSub: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center", marginTop: 10, lineHeight: 23 },
  doneStats: { flexDirection: "row", alignItems: "center", marginTop: 32, backgroundColor: colors.card, borderRadius: colors.radiusLg, borderWidth: 1, borderColor: colors.cardBorder, paddingVertical: 20, paddingHorizontal: 10, alignSelf: "stretch", justifyContent: "space-around" },
  doneStat: { alignItems: "center", flex: 1 },
  doneStatNum: { fontFamily: fonts.serifSemibold, fontSize: 26, color: colors.accent },
  doneStatLbl: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  doneStatDivider: { width: 1, height: 40, backgroundColor: colors.cardBorder },
});
