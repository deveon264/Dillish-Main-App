import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useReducedMotion } from "react-native-reanimated";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { ProgressRing } from "@/components/ProgressRing";
import { MotionListItem } from "@/components/Motion";
import { haptics } from "@/lib/haptics";
import { analyzeStageStates, nextAnalyzeProgress } from "@/lib/analyzeStages";
import type { AppColors } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

const TICK_MS = 120;

// Staged analyzing experience for meal scanning: the photo dims under a
// scrim while a progress ring counts up and stages tick off, so the wait for
// the AI reads as work happening instead of a bare spinner. Progress is
// presentation-driven (see lib/analyzeStages); `done` snaps it to 100%.
export function AnalyzingCard({
  imageUri,
  done,
  labels,
}: {
  imageUri?: string | null;
  done: boolean;
  labels: string[];
}) {
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(done);
  doneRef.current = done;
  const prevStatesRef = useRef<string[]>([]);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setProgress((p) => nextAnalyzeProgress(p, doneRef.current));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  useEffect(() => {
    if (done) setProgress(1);
  }, [done]);

  const states = analyzeStageStates(progress);

  // A gentle tick as each stage completes; the result card's own success
  // haptic still marks the finish.
  useEffect(() => {
    const prev = prevStatesRef.current;
    if (prev.length && states.some((s, i) => s === "done" && prev[i] !== "done")) {
      haptics.selection();
    }
    prevStatesRef.current = states;
  }, [states]);

  return (
    <View style={styles.wrap}>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} /> : null}
      <View style={styles.scrim} />
      <View style={styles.content}>
        {reducedMotion ? (
          <View style={styles.staticRow}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.stageTextActive}>Analyzing your meal...</Text>
          </View>
        ) : (
          <>
            <ProgressRing
              size={112}
              strokeWidth={5}
              progress={progress}
              color="#FFFFFF"
              trackColor="rgba(255,255,255,0.28)"
              gradientId="analyzeRing"
            >
              <AnimatedNumber
                value={progress * 100}
                formatter={(n) => `${Math.round(n)}%`}
                style={styles.percent}
              />
            </ProgressRing>
            <View style={styles.stages}>
              {labels.map((label, i) => {
                const state = states[i] ?? "pending";
                if (state === "pending") return null;
                return (
                  <MotionListItem key={label} style={styles.stageRow}>
                    {state === "done" ? (
                      <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
                    ) : (
                      <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
                    )}
                    <Text style={state === "done" ? styles.stageTextDone : styles.stageTextActive}>
                      {label}
                    </Text>
                  </MotionListItem>
                );
              })}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: {
    height: 320,
    borderRadius: colors.radius,
    overflow: "hidden",
    backgroundColor: colors.foreground,
  },
  photo: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,17,17,0.55)" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 20 },
  percent: { fontFamily: fonts.serifMedium, fontSize: 26, color: "#FFFFFF" },
  stages: { gap: 10, alignItems: "flex-start" },
  stageRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 20 },
  stageTextDone: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: "#FFFFFF" },
  stageTextActive: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: "rgba(255,255,255,0.85)" },
  staticRow: { flexDirection: "row", alignItems: "center", gap: 10 },
});
