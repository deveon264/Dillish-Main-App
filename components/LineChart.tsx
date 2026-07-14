import React, { useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from "react-native-svg";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

export type LinePoint = { label: string; value: number };

type Props = {
  data: LinePoint[];
  unit?: string;
  height?: number;
  goal?: number | null;
};

const Y_TICKS = 5;
const Y_AXIS_WIDTH = 30;

function niceDomain(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 2;
    max += 2;
  }
  const pad = (max - min) * 0.15;
  return { min: Math.floor(min - pad), max: Math.ceil(max + pad) };
}

export function LineChart({ data, unit = "", height = 150, goal = null }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const [plotW, setPlotW] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setPlotW(e.nativeEvent.layout.width);

  const domainValues = goal == null ? data.map((d) => d.value) : [...data.map((d) => d.value), goal];
  const { min, max } = niceDomain(domainValues);
  const span = max - min || 1;

  const ticks = Array.from({ length: Y_TICKS }, (_, i) => Math.round(max - (span / (Y_TICKS - 1)) * i));

  const toX = (i: number) => (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const toY = (v: number) => height - ((v - min) / span) * height;

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.value), ...d }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
      : "";
  const goalY = goal == null ? null : toY(goal);

  return (
    <View>
      <View style={[styles.row, { height }]}>
        <View style={styles.yAxis}>
          {ticks.map((t) => (
            <Text key={t} style={styles.yLabel}>
              {t}
            </Text>
          ))}
        </View>

        <View style={styles.plot} onLayout={onLayout}>
          {ticks.map((t, i) => (
            <View key={t} style={[styles.grid, { top: (height / (Y_TICKS - 1)) * i }]} />
          ))}

          {plotW > 0 ? (
            <Svg width={plotW} height={height} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity="0.28" />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              {areaPath ? <Path d={areaPath} fill="url(#weightArea)" /> : null}
              {goalY != null ? (
                <Line
                  x1={0}
                  x2={plotW}
                  y1={goalY}
                  y2={goalY}
                  stroke={colors.accentBorderMd}
                  strokeWidth={1.5}
                  strokeDasharray="6 6"
                />
              ) : null}
              {linePath ? (
                <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
              {points.map((p, i) => (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={i === points.length - 1 ? 5.5 : 4}
                  fill={i === points.length - 1 ? colors.card : colors.primary}
                  stroke={colors.primary}
                  strokeWidth={i === points.length - 1 ? 2.5 : 0}
                />
              ))}
            </Svg>
          ) : null}
          {goalY != null && plotW > 0 ? (
            <Text style={[styles.goalLabel, { top: Math.max(0, Math.min(height - 16, goalY - 18)) }]}>
              goal {goal}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.xRow, { marginLeft: Y_AXIS_WIDTH }]}>
        {data.map((d, i) => (
          <Text key={i} style={styles.xLabel} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  row: { flexDirection: "row" },
  yAxis: {
    width: Y_AXIS_WIDTH,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: 6,
    paddingVertical: 0,
  },
  yLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.muted, lineHeight: 12 },
  plot: { flex: 1, position: "relative" },
  grid: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.track,
  },
  goalLabel: {
    position: "absolute",
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.card,
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.accentDark,
  },
  xRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  xLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.muted, flex: 1, textAlign: "center" },
});
