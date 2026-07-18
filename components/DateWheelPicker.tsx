import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable as RNPressable,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import type { AppColors } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

// A Florish-styled bottom-sheet date picker: three snap-scrolling wheels
// (Day / Month / Year) with a center highlight band, instead of typing
// dd/mm/yyyy on a keyboard. Pure JS (ScrollView + snapToInterval), so it feels
// and looks identical on iOS, Android, and web, and needs no native module.

const ITEM_H = 44;
const VISIBLE_ROWS = 5;
const WHEEL_H = ITEM_H * VISIBLE_ROWS;
const WHEEL_PAD = (WHEEL_H - ITEM_H) / 2;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDate(d: Date, min?: Date, max?: Date): Date {
  if (min && d < min) return new Date(min);
  if (max && d > max) return new Date(max);
  return d;
}

// One snap-scrolling column. Items snap to ITEM_H; the parent's highlight band
// marks the selected row. Selection settles on drag/momentum end.
function Wheel({
  items,
  index,
  onChange,
}: {
  items: string[];
  index: number;
  onChange: (i: number) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const ref = useRef<ScrollView>(null);
  // The index this wheel last reported, so a programmatic scroll (clamping,
  // reopening) doesn't re-fire onChange with a stale value.
  const settled = useRef(index);

  // react-native-web ignores the contentOffset prop, so position the wheel on
  // mount explicitly (the frame delay lets the ScrollView lay out first).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      ref.current?.scrollTo({ y: settled.current * ITEM_H, animated: false });
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (settled.current !== index) {
      settled.current = index;
      ref.current?.scrollTo({ y: index * ITEM_H, animated: true });
    }
  }, [index]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (i !== settled.current) {
      settled.current = i;
      haptics.selection();
      onChange(i);
    }
  };

  return (
    <ScrollView
      ref={ref}
      style={styles.wheel}
      contentOffset={{ x: 0, y: index * ITEM_H }}
      contentContainerStyle={{ paddingVertical: WHEEL_PAD }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
      nestedScrollEnabled
    >
      {items.map((label, i) => (
        <RNPressable
          key={label + i}
          style={styles.item}
          onPress={() => {
            if (i === settled.current) return;
            settled.current = i;
            ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
            haptics.selection();
            onChange(i);
          }}
        >
          <Text style={[styles.itemText, i === index && styles.itemTextActive]}>{label}</Text>
        </RNPressable>
      ))}
    </ScrollView>
  );
}

export function DateWheelPicker({
  visible,
  value,
  minimumDate,
  maximumDate,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onConfirm: (d: Date) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  const now = new Date();
  const maxYear = (maximumDate ?? now).getFullYear();
  const minYear = (minimumDate ?? new Date(maxYear - 5, 0, 1)).getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = minYear; y <= maxYear; y++) list.push(y);
    return list;
  }, [minYear, maxYear]);

  const [day, setDay] = useState(value.getDate());
  const [month, setMonth] = useState(value.getMonth());
  const [year, setYear] = useState(value.getFullYear());

  // Re-seed the wheels from `value` each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setDay(value.getDate());
    setMonth(value.getMonth());
    setYear(Math.max(minYear, Math.min(maxYear, value.getFullYear())));
    // `value` is intentionally read only at open time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dayCount = daysInMonth(year, month);
  // Month/year change can strand the day past the month's end (e.g. Jan 31 ->
  // Feb); clamp and let the day wheel animate to the new position.
  useEffect(() => {
    if (day > dayCount) setDay(dayCount);
  }, [day, dayCount]);

  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => String(i + 1)),
    [dayCount]
  );

  const confirm = () => {
    // Noon, matching the app's parseDateInput convention, so timezone shifts
    // never move the date across midnight.
    const picked = clampDate(new Date(year, month, day, 12, 0, 0), minimumDate, maximumDate);
    haptics.selection();
    onConfirm(picked);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <RNPressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close date picker" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Pressable onPress={onClose} hitSlop={8} style={styles.headBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Pick a date</Text>
            <Pressable onPress={confirm} hitSlop={8} style={styles.headBtn}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.wheels}>
            <View style={styles.band} pointerEvents="none" />
            <Wheel items={days} index={Math.min(day, dayCount) - 1} onChange={(i) => setDay(i + 1)} />
            <Wheel items={MONTHS} index={month} onChange={setMonth} />
            <Wheel
              items={years.map(String)}
              index={Math.max(0, years.indexOf(year))}
              onChange={(i) => setYear(years[i])}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
    padding: 18,
  },
  sheet: {
    backgroundColor: colors.background,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
    marginBottom: 12,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  headBtn: { paddingVertical: 6, paddingHorizontal: 4, minWidth: 60 },
  title: { fontFamily: fonts.serifSemibold, fontSize: 19, color: colors.foreground },
  cancelText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.muted },
  doneText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.accentDark, textAlign: "right" },

  wheels: { flexDirection: "row", height: WHEEL_H, marginTop: 6 },
  wheel: { flex: 1 },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    top: WHEEL_PAD,
    height: ITEM_H,
    borderRadius: 14,
    backgroundColor: colors.track,
  },
  item: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  itemText: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.mutedForeground },
  itemTextActive: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.foreground },
});
