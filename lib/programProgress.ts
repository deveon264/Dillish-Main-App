// Program-day progression, derived entirely from existing workout completions
// so no extra storage slice is needed: completing a workout automatically
// advances the program next time the Home screen recomputes.
//
// Deliberately react-native-free (mirrors lib/streak.ts) so it can be
// unit-tested with tsx --test. The caller supplies dayKeyOf to turn a
// completion timestamp into a local day key.

import type { Program } from "@/constants/programs";

export type ProgramEntry = {
  dayNumber: number; // 1-based position in the program INCLUDING rest days
  weekIndex: number; // 0-based
  workoutId: string;
};

export type ProgramProgress =
  | { complete: true; daysAdvanced: number; totalWorkoutDays: number }
  | {
      complete: false;
      next: ProgramEntry;
      daysAdvanced: number;
      totalWorkoutDays: number;
    };

type CompletionLike = { workoutId: string; ts: number };

// Workout days in order, keeping the calendar day number so "Day 4" still
// reads correctly when day 3 was a rest day.
export function flattenProgram(program: Program): ProgramEntry[] {
  const entries: ProgramEntry[] = [];
  program.weeks.forEach((days, weekIndex) => {
    days.forEach((day, dayIndex) => {
      if (day.workoutId) {
        entries.push({
          dayNumber: weekIndex * 7 + dayIndex + 1,
          weekIndex,
          workoutId: day.workoutId,
        });
      }
    });
  });
  return entries;
}

export function programWorkoutIdSet(program: Program): Set<string> {
  return new Set(flattenProgram(program).map((e) => e.workoutId));
}

export function deriveProgramProgress(
  program: Program,
  programStartedAt: number,
  completions: CompletionLike[],
  dayKeyOf: (ts: number) => string
): ProgramProgress {
  const entries = flattenProgram(program);
  const ids = programWorkoutIdSet(program);

  // Distinct local days on which a program workout was completed. Repeating a
  // workout twice in one day advances the program once.
  const activeDays = new Set<string>();
  for (const c of completions) {
    if (c.ts >= programStartedAt && ids.has(c.workoutId)) {
      activeDays.add(dayKeyOf(c.ts));
    }
  }
  const daysAdvanced = activeDays.size;

  if (daysAdvanced >= entries.length) {
    return { complete: true, daysAdvanced, totalWorkoutDays: entries.length };
  }
  return {
    complete: false,
    next: entries[daysAdvanced],
    daysAdvanced,
    totalWorkoutDays: entries.length,
  };
}
