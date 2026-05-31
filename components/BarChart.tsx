import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect, Line } from "react-native-svg";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

export type BarDatum = { label: string; value: number };

export function BarChart({
  data,
  goal,
  unit = "",
  height = 160,
}: {
  data: BarDatum[];
  goal?: number;
  unit?: string;
  height?: number;
}) {
  const maxVal = Math.max(goal ?? 0, ...data.map((d) => d.value), 1);
  const chartH = height;
  const barW = 26;
  const gap = 14;
  const width = data.length * (barW + gap);
  const goalY = goal ? chartH - (goal / maxVal) * chartH : null;

  return (
    <View>
      <Svg width={width} height={chartH + 24}>
        <Defs>
          <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.primary} />
          </LinearGradient>
        </Defs>
        {goalY != null ? (
          <Line
            x1={0}
            y1={goalY}
            x2={width}
            y2={goalY}
            stroke={colors.cardBorder}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ) : null}
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / maxVal) * chartH);
          const x = i * (barW + gap) + gap / 2;
          const y = chartH - h;
          const reached = goal ? d.value >= goal : true;
          return (
            <Rect
              key={d.label + i}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={7}
              fill={reached ? "url(#barGrad)" : colors.track}
            />
          );
        })}
      </Svg>
      <View style={[styles.labels, { width }]}>
        {data.map((d, i) => (
          <Text key={d.label + i} style={[styles.label, { width: barW + gap }]} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: "row", marginTop: -18 },
  label: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
  },
});
