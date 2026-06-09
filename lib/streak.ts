// Canonical streak shape + helpers shared by the client (contexts/DataContext,
// the home/profile/workout screens) and the server (lib/userStore,
// app/api/streak). Kept free of any react-native imports so it is safe to
// import from both the app and the Metro-Node API routes. The server is the
// source of truth for the persisted state; the device keeps an offline cache.
//
// The streak stays alive on any day the member is active: they either signed in
// / opened the app OR completed a workout. Sign-in (active) days are persisted
// account-side here; workout-completion days live in device-local storage. The
// displayed streak is computed over the UNION of the two so it reads the same
// everywhere it appears.

export type StreakState = {
  // Running count of consecutive active (sign-in) days ending at lastActiveDay.
  // Persisted so a streak longer than the rolling window below still restores on
  // a fresh device.
  count: number;
  // The most recent active-day key ("YYYY-MM-DD"), or null if never recorded.
  lastActiveDay: string | null;
  // Bounded, ascending rolling window of recent active-day keys. Enough to drive
  // the home 7-day pill row and the live consecutive-day computation, while
  // staying small so the stored blob can't grow without limit.
  recentDays: string[];
  updatedAt: number;
};

// Rolling window size. Large enough that the live union computation covers the
// vast majority of real streaks, small enough to stay bounded (~60 keys).
export const STREAK_WINDOW_DAYS = 60;

export const DEFAULT_STREAK_STATE: StreakState = {
  count: 0,
  lastActiveDay: null,
  recentDays: [],
  updatedAt: 0,
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Local-date day key, identical in shape to lib/storage's todayKey but defined
// here so this module stays react-native-free for the server.
export function dayKeyOf(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isDayKey(v: unknown): v is string {
  return typeof v === "string" && DAY_RE.test(v);
}

// Shifts a date-only key by whole days. Uses UTC arithmetic on the date parts so
// it is immune to DST: the key carries no time-of-day, so adding/subtracting
// days must not be affected by a local clock change.
function shiftKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = `${dt.getUTCMonth() + 1}`.padStart(2, "0");
  const dd = `${dt.getUTCDate()}`.padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Dedupes, sorts ascending and bounds a list of day keys to the rolling window.
function pruneWindow(keys: string[]): string[] {
  const unique = Array.from(new Set(keys.filter(isDayKey))).sort();
  return unique.length > STREAK_WINDOW_DAYS
    ? unique.slice(unique.length - STREAK_WINDOW_DAYS)
    : unique;
}

// Coerces a stored (possibly partial, legacy or hand-edited) blob into a full,
// sane StreakState so bad data can't surface broken values.
export function sanitizeStreakState(input: unknown): StreakState {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const rawCount = Number(src.count);
  const count = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;
  const lastActiveDay = isDayKey(src.lastActiveDay) ? src.lastActiveDay : null;
  const recentDays = pruneWindow(Array.isArray(src.recentDays) ? (src.recentDays as unknown[]).filter(isDayKey) as string[] : []);
  const rawUpdated = Number(src.updatedAt);
  const updatedAt = Number.isFinite(rawUpdated) ? Math.max(0, rawUpdated) : 0;
  return { count, lastActiveDay, recentDays, updatedAt };
}

// Records `day` as an active day and returns the next state. Idempotent: calling
// it again with the same day yields an equivalent state. The running count only
// advances when `day` moves the frontier forward (a new latest day): consecutive
// with the previous frontier increments it, a gap restarts it at 1. An older or
// equal day only joins the window (it can't extend a streak that already ended).
export function recordActiveDay(prev: StreakState, day: string, now: number = Date.now()): StreakState {
  if (!isDayKey(day)) return prev;
  let count = prev.count;
  let lastActiveDay = prev.lastActiveDay;
  if (!prev.lastActiveDay) {
    count = 1;
    lastActiveDay = day;
  } else if (day > prev.lastActiveDay) {
    count = shiftKey(prev.lastActiveDay, 1) === day ? prev.count + 1 : 1;
    lastActiveDay = day;
  }
  const recentDays = pruneWindow([...prev.recentDays, day]);
  const unchanged =
    count === prev.count &&
    lastActiveDay === prev.lastActiveDay &&
    recentDays.length === prev.recentDays.length &&
    recentDays.every((k, i) => k === prev.recentDays[i]);
  if (unchanged) return prev;
  return { count, lastActiveDay, recentDays, updatedAt: now };
}

// Merges extra active-day keys into the state's rolling window without touching
// the running count or frontier. Used to reconcile days that were recorded
// offline on the device into the server window on the next successful sync, so
// the pills and the live union streak recover even if the count itself drifted.
export function mergeWindow(prev: StreakState, days: string[], now: number = Date.now()): StreakState {
  const recentDays = pruneWindow([...prev.recentDays, ...days]);
  const same =
    recentDays.length === prev.recentDays.length &&
    recentDays.every((k, i) => k === prev.recentDays[i]);
  if (same) return prev;
  return { ...prev, recentDays, updatedAt: now };
}

// Consecutive-day streak ending today (or yesterday when today is not present),
// counting backwards over the given day set.
export function computeStreak(days: Set<string>, today: string = dayKeyOf()): number {
  let cursor = days.has(today) ? today : shiftKey(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = shiftKey(cursor, -1);
  }
  return count;
}

// The combined active-OR-workout day set: the union of persisted active (sign-in)
// days and device-local workout-completion days. Drives both the streak number
// and the home/workout pill rows so they are always consistent.
export function combineDays(activeDays: string[], completionDays: string[]): Set<string> {
  const s = new Set<string>();
  for (const d of activeDays) if (isDayKey(d)) s.add(d);
  for (const d of completionDays) if (isDayKey(d)) s.add(d);
  return s;
}

// The single streak value shown everywhere: the longer of the live consecutive
// run over the union of active + workout days, and the server-tracked sign-in
// streak when it is still alive (its last active day is today or yesterday). The
// server count covers streaks older than the rolling window on a fresh device;
// the live union covers workout-only days and offline-recorded days.
export function displayStreak(
  state: StreakState,
  combinedDays: Set<string>,
  today: string = dayKeyOf()
): number {
  const live = computeStreak(combinedDays, today);
  const serverAlive =
    state.lastActiveDay === today || state.lastActiveDay === shiftKey(today, -1)
      ? state.count
      : 0;
  return Math.max(live, serverAlive);
}
