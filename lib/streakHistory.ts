import { dayKeyOf } from "@/lib/streak";

// Weekly streak history for the home-card sheet. Pure and react-native-free so
// it can be unit tested; weeks run Monday→Sunday to match the card's tracker.

export type WeekDayMark = {
  label: string;
  key: string;
  active: boolean;
  isToday: boolean;
};

export type WeekHistoryRow = {
  rangeLabel: string;
  days: WeekDayMark[];
  activeCount: number;
  isCurrent: boolean;
};

export const WEEK_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Jun 15 – 21" within one month, "May 26 – Jun 1" across months (en dash).
function rangeLabelOf(monday: Date, sunday: Date): string {
  const from = `${MONTHS[monday.getMonth()]} ${monday.getDate()}`;
  const to =
    monday.getMonth() === sunday.getMonth()
      ? `${sunday.getDate()}`
      : `${MONTHS[sunday.getMonth()]} ${sunday.getDate()}`;
  return `${from} – ${to}`;
}

// Newest week first: index 0 is the week containing `today`.
export function buildWeekHistory(days: Set<string>, weeks: number, today: Date = new Date()): WeekHistoryRow[] {
  const todayKey = dayKeyOf(today);
  const mondayOffset = (today.getDay() + 6) % 7;
  const rows: WeekHistoryRow[] = [];

  for (let w = 0; w < weeks; w++) {
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset - 7 * w);
    const marks: WeekDayMark[] = WEEK_DAY_LABELS.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = dayKeyOf(d);
      return { label, key, active: days.has(key), isToday: key === todayKey };
    });
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    rows.push({
      rangeLabel: w === 0 ? "This week" : w === 1 ? "Last week" : rangeLabelOf(monday, sunday),
      days: marks,
      activeCount: marks.filter((m) => m.active).length,
      isCurrent: w === 0,
    });
  }
  return rows;
}
