// Pure, testable hydration-week math shared by the Water tracker's weekly card.
// Mirrors the shape and Monday-first weekday logic of `lib/calorieWeek.ts` so
// both weekly views derive their days the same way.

export type HydrationLog = {
  amountMl: number;
  ts: number;
};

export type HydrationWeekDay = {
  label: string;
  dayOfMonth: number;
  totalMl: number;
  isToday: boolean;
  reached: boolean;
};

export type HydrationWeek = {
  days: HydrationWeekDay[];
  range: string;
  // Mean of daily totals over the elapsed days of this week (Monday..today),
  // in millilitres. Zero-intake days count so the average stays honest.
  dailyAvgMl: number;
  // Days this week whose total reached the goal.
  goalDays: number;
  // Consecutive days up to today whose total reached the goal. Today only
  // breaks the streak once it has passed with the goal unmet; while today is
  // still in progress the streak is measured through yesterday.
  streak: number;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(value: Date): Date {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

function safeMl(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function dayKey(ts: number): number {
  return startOfLocalDay(new Date(ts)).getTime();
}

export function buildHydrationWeek(
  logs: readonly HydrationLog[],
  goalMl: number,
  today: Date = new Date(),
): HydrationWeek {
  const goal = safeMl(goalMl);
  const base = startOfLocalDay(today);
  const mondayOffset = (base.getDay() + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - mondayOffset);
  const todayMs = base.getTime();

  // Pre-aggregate every log into its local-day bucket once, so both the visible
  // week and the (open-ended) streak read from the same totals.
  const totalsByDay = new Map<number, number>();
  for (const log of logs) {
    const key = dayKey(log.ts);
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + safeMl(log.amountMl));
  }

  const days = DAY_LABELS.map((label, index) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() + index);
    const startMs = start.getTime();
    const totalMl = totalsByDay.get(startMs) ?? 0;
    return {
      label,
      dayOfMonth: start.getDate(),
      totalMl,
      isToday: startMs === todayMs,
      reached: goal > 0 && totalMl >= goal,
    };
  });

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const rangeStart = `${MONTH_LABELS[monday.getMonth()]} ${monday.getDate()}`;
  const rangeEnd =
    monday.getMonth() === sunday.getMonth()
      ? `${sunday.getDate()}`
      : `${MONTH_LABELS[sunday.getMonth()]} ${sunday.getDate()}`;

  const elapsedDays = Math.min(7, Math.max(1, Math.round((todayMs - monday.getTime()) / MS_PER_DAY) + 1));
  const elapsedTotal = days.slice(0, elapsedDays).reduce((sum, day) => sum + day.totalMl, 0);
  const dailyAvgMl = Math.round(elapsedTotal / elapsedDays);
  const goalDays = days.reduce((count, day) => (day.reached ? count + 1 : count), 0);

  // Walk backwards from today counting reached days. A still-in-progress today
  // that has not reached the goal is skipped rather than breaking the streak.
  let streak = 0;
  if (goal > 0) {
    let cursor = todayMs;
    if ((totalsByDay.get(cursor) ?? 0) < goal) cursor -= MS_PER_DAY; // today still open
    while ((totalsByDay.get(cursor) ?? 0) >= goal) {
      streak += 1;
      cursor -= MS_PER_DAY;
    }
  }

  return { days, range: `${rangeStart} – ${rangeEnd}`, dailyAvgMl, goalDays, streak };
}
