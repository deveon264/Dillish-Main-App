export type CalorieWeekLog = {
  kcal: number;
  ts: number;
};

export type CalorieWeekDay = {
  label: string;
  dayOfMonth: number;
  fullDateLabel: string;
  total: number;
  isToday: boolean;
};

export type CalorieWeek = {
  days: CalorieWeekDay[];
  range: string;
};

export type CalorieWeekScale = {
  maximum: number;
  midpoint: number;
  goal: number;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfLocalDay(value: Date): Date {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

function safeCalories(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function buildCalorieWeek(logs: readonly CalorieWeekLog[], today: Date = new Date()): CalorieWeek {
  const base = startOfLocalDay(today);
  const mondayOffset = (base.getDay() + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - mondayOffset);
  const todayMs = base.getTime();

  const days = DAY_LABELS.map((label, index) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() + index);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const total = logs.reduce((sum, log) => {
      return log.ts >= start.getTime() && log.ts < end.getTime()
        ? sum + safeCalories(log.kcal)
        : sum;
    }, 0);

    return {
      label,
      dayOfMonth: start.getDate(),
      fullDateLabel: start.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      total,
      isToday: start.getTime() === todayMs,
    };
  });

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const rangeStart = `${MONTH_LABELS[monday.getMonth()]} ${monday.getDate()}`;
  const rangeEnd =
    monday.getMonth() === sunday.getMonth()
      ? `${sunday.getDate()}`
      : `${MONTH_LABELS[sunday.getMonth()]} ${sunday.getDate()}`;

  return { days, range: `${rangeStart} – ${rangeEnd}` };
}

export function getCalorieWeekScale(
  days: readonly Pick<CalorieWeekDay, "total">[],
  calorieGoal: number,
): CalorieWeekScale {
  const goal = safeCalories(calorieGoal);
  const highestTotal = days.reduce((highest, day) => Math.max(highest, safeCalories(day.total)), 0);
  const highestValue = Math.max(goal, highestTotal);
  const maximum =
    goal > 0 && highestTotal <= goal
      ? goal
      : Math.max(500, Math.ceil(highestValue / 500) * 500);

  return {
    maximum,
    midpoint: maximum / 2,
    goal,
  };
}
