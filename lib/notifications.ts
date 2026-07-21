// Notification model + the pure builder that derives the member's notification
// feed from their real activity. Kept free of any react-native / expo imports
// (it depends only on the server-safe `@/lib/streak` day-key helper and
// `@/lib/profile` type) so it is safe to import from the data context AND to
// exercise directly under the node:test + tsx suite without a RN renderer.
import { dayKeyOf } from "@/lib/streak";
import type { Profile } from "@/lib/profile";

export type WaterLog = { id: string; amountMl: number; ts: number };
export type CalorieLog = {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  ts: number;
  photoUri?: string;
  mealType?: string;
};
export type WorkoutCompletion = {
  id: string;
  workoutId: string;
  ts: number;
  kcal: number;
  durationMin: number;
};

export type NotifTone = "accent" | "highlight" | "water" | "coach";
export type AppNotification = {
  id: string;
  icon: string;
  tone: NotifTone;
  title: string;
  body: string;
  ts: number;
  read: boolean;
};

// Notifications are derived from the member's real activity rather than being a
// static feed: hydration gaps, an unfinished workout, unlogged meals, and streak
// milestones. Each has a date-stable id so its read state persists for the day.
// The streak number is passed in (not recomputed here) so it matches the value
// shown on the home, profile and workout-completion screens exactly.
export function buildNotifications(args: {
  waterLogs: WaterLog[];
  calorieLogs: CalorieLog[];
  completions: WorkoutCompletion[];
  profile: Profile;
  streak: number;
  // The record value to celebrate when the member has just beaten their
  // personal best today, or null when there is nothing new to celebrate.
  newBest: number | null;
}): Omit<AppNotification, "read">[] {
  const { waterLogs, calorieLogs, completions, profile, streak, newBest } = args;
  const tk = dayKeyOf();
  const now = Date.now();
  const out: Omit<AppNotification, "read">[] = [];

  // A brand-new member has no activity of any kind yet. Greet them warmly the
  // moment they reach home; the card clears itself as soon as they log water, a
  // meal, or a workout, so it shows exactly while they are getting started. Its
  // id is not date-keyed, so once read it stays read (no daily resurfacing).
  const isNewMember =
    completions.length === 0 && waterLogs.length === 0 && calorieLogs.length === 0;
  if (isNewMember) {
    out.push({
      id: "welcome",
      icon: "sparkles-outline",
      tone: "accent",
      title: "Welcome to Shape! 🌸",
      body: "We're so glad you're here. This is the start of your fitness journey, one beautiful session at a time.",
      ts: now + 2,
    });
  }

  // A genuinely new all-time record beats a plain milestone, so when both would
  // fire on the same day we show only the personal-best celebration.
  const celebratingBest = newBest != null && newBest > 0;
  if (celebratingBest) {
    out.push({
      id: `pb:${tk}`,
      icon: "trophy-outline",
      tone: "highlight",
      title: `New personal best: ${newBest} ${newBest === 1 ? "day" : "days"}! 🎉`,
      body: "You just beat your longest streak. Keep the momentum going.",
      ts: now + 1,
    });
  }

  const workoutToday = completions.some((c) => dayKeyOf(new Date(c.ts)) === tk);

  if (!workoutToday) {
    out.push({
      id: `workout:${tk}`,
      icon: "barbell-outline",
      tone: "accent",
      title: "Today's workout is waiting",
      body:
        streak > 0
          ? `Keep your ${streak}-day streak alive. Finish today's session.`
          : "Move your body today and start a new streak.",
      ts: now,
    });
  } else if (!celebratingBest && [3, 7, 14, 21, 30, 50, 100].includes(streak)) {
    out.push({
      id: `streak:${tk}`,
      icon: "flame-outline",
      tone: "highlight",
      title: `${streak}-day streak! 🔥`,
      body: "You showed up again today. Amazing consistency, keep it going.",
      ts: now,
    });
  }

  const todayWaterMl = waterLogs
    .filter((l) => dayKeyOf(new Date(l.ts)) === tk)
    .reduce((s, l) => s + l.amountMl, 0);
  const waterGoalMl = profile.waterGoalMl > 0 ? profile.waterGoalMl : 2500;
  if (todayWaterMl < waterGoalMl) {
    const remL = ((waterGoalMl - todayWaterMl) / 1000).toFixed(1);
    out.push({
      id: `hydration:${tk}`,
      icon: "water-outline",
      tone: "water",
      title: "Time to hydrate",
      body: `You're ${remL} L away from today's water goal.`,
      ts: now - 1,
    });
  }

  const mealsToday = calorieLogs.filter((l) => dayKeyOf(new Date(l.ts)) === tk).length;
  if (mealsToday === 0) {
    out.push({
      id: `meals:${tk}`,
      icon: "restaurant-outline",
      tone: "coach",
      title: "Log your meals",
      body: "Snap a photo of your food to keep your nutrition on track.",
      ts: now - 2,
    });
  }

  return out;
}

// Stamps each freshly built notification with its read state from the persisted
// id set. A notification whose date-stable id (e.g. `pb:<day>`) is already in
// the read set is marked read, so reopening the app the same day does not
// resurface an already-seen celebration as unread.
export function applyReadState(
  base: Omit<AppNotification, "read">[],
  readIds: string[]
): AppNotification[] {
  return base.map((n) => ({ ...n, read: readIds.includes(n.id) }));
}
