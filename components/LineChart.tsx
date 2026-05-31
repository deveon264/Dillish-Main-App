import React, { useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

export type LinePoint = { label: string; value: number };

type Props = {
  data: LinePoint[];
  unit?: string;
  height?: number;
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

export function LineChart({ data, unit = "", height = 150 }: Props) {
  const [plotW, setPlotW] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setPlotW(e.nativeEvent.layout.width);

  const { min, max } = niceDomain(data.map((d) => d.value));
  const span = max - min || 1;

  const ticks = Array.from({ length: Y_TICKS }, (_, i) => Math.round(max - (span / (Y_TICKS - 1)) * i));

  const toX = (i: number) => (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const toY = (v: number) => height - ((v - min) / span) * height;

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.value), ...d }));

  const segments = points.slice(1).map((p, i) => {
    const p0 = points[i];
    const dx = p.x - p0.x;
    const dy = p.y - p0.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const mx = (p0.x + p.x) / 2;
    const my = (p0.y + p.y) / 2;
    return { length, angle, left: mx - length / 2, top: my - 1, key: `${i}` };
  });

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

          {plotW > 0 && (
            <>
              {segments.map((s) => (
                <View
                  key={s.key}
                  style={[
                    styles.segment,
                    {
                      width: s.length,
                      left: s.left,
                      top: s.top,
                      transform: [{ rotate: `${s.angle}deg` }],
                    },
                  ]}
                />
              ))}
              {points.map((p, i) => (
                <View key={i} style={[styles.dot, { left: p.x - 5, top: p.y - 5 }]} />
              ))}
            </>
          )}
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

const styles = StyleSheet.create({
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
  segment: {
    position: "absolute",
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  dot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },
  xRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  xLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.muted, flex: 1, textAlign: "center" },
});
