import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

export type BarDatum = { label: string; value: number };

const Y_AXIS_W = 40;
const MAUVE: [string, string] = ["#9B6E6A", "#6E4F4A"];
const GREEN: [string, string] = ["#84B27E", "#5E8C5A"];

const fmt = (n: number, unit: string) => `${Math.round(n * 100) / 100}${unit}`;

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
  const barW = 22;
  const goalTop = goal != null ? chartH - (goal / maxVal) * chartH : null;

  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.yAxis, { height: chartH }]}>
          <Text style={styles.yLabel}>{fmt(maxVal, unit)}</Text>
          <Text style={styles.yLabel}>{fmt(maxVal / 2, unit)}</Text>
          <Text style={styles.yLabel}>0</Text>
        </View>

        <View style={[styles.plot, { height: chartH }]}>
          {goalTop != null ? (
            <View style={[styles.goalLine, { top: goalTop }]} />
          ) : null}
          <View style={styles.barsRow}>
            {data.map((d, i) => {
              const h = d.value > 0 ? Math.max(4, (d.value / maxVal) * chartH) : 0;
              const reached = goal ? d.value >= goal : false;
              return (
                <View key={d.label + i} style={styles.barCol}>
                  {h > 0 ? (
                    <LinearGradient
                      colors={reached ? GREEN : MAUVE}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{ width: barW, height: h, borderTopLeftRadius: 6, borderTopRightRadius: 6 }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={[styles.labels, { marginLeft: Y_AXIS_W }]}>
        {data.map((d, i) => (
          <Text key={d.label + i} style={styles.label} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  yAxis: {
    width: Y_AXIS_W,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: 8,
  },
  yLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.mutedForeground },
  plot: { flex: 1, position: "relative", justifyContent: "flex-end" },
  goalLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1,
    borderColor: colors.cardBorder,
    borderStyle: "dashed",
  },
  barsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around" },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  labels: { flexDirection: "row", marginTop: 8 },
  label: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
  },
});
