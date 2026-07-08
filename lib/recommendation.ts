// Workout and program recommendation logic. React-native-free: works on a
// structural RecWorkout shape that constants/workouts.ts Workout satisfies, so
// unit tests can rank small synthetic fixtures and the app passes WORKOUTS.
//
// Hard rules (isEligible) are absolute for recommendations: a workout that
// needs equipment the user lacks, ignores one of their limitations, or is
// Advanced for a beginner is never suggested. Everything else is soft scoring.

import type {
  Profile,
  GoalId,
  EquipmentId,
  BodyFocusId,
  LimitationId,
  DurationPreference,
  FitnessLevel,
} from "@/lib/profile";
import { hasFitnessProfile, secondaryGoalsOf } from "@/lib/profile";
import type { Program } from "@/constants/programs";
import { deriveProgramProgress, type ProgramEntry } from "@/lib/programProgress";

export type RecWorkout = {
  id: string;
  title: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  durationMin: number;
  category: string;
  focusAreas?: string[];
  primaryGoals: GoalId[];
  secondaryGoals?: GoalId[];
  equipment: EquipmentId[];
  bodyFocus: BodyFocusId[];
  suitableFor: LimitationId[];
  intensity: "low" | "moderate" | "high";
};

const LEVEL_ORDER: Record<RecWorkout["level"], number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
};

const PROFILE_LEVEL_ORDER: Record<FitnessLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

// Duration preference bands over the authored durationMin, with one band of
// tolerance scoring partial credit.
const DURATION_BANDS: Record<DurationPreference, (min: number) => boolean> = {
  "10_15": (m) => m <= 17,
  "20_30": (m) => m >= 18 && m <= 32,
  "30_45": (m) => m >= 33 && m <= 47,
  "45_plus": (m) => m >= 48,
};
const BAND_ORDER: DurationPreference[] = ["10_15", "20_30", "30_45", "45_plus"];

function bandIndexOf(min: number): number {
  const i = BAND_ORDER.findIndex((b) => DURATION_BANDS[b](min));
  return i === -1 ? BAND_ORDER.length - 1 : i;
}

// The equipment the user can actually train with. "none" is a UI answer, not
// gear; gym access implies dumbbells.
function effectiveEquipment(profile: Profile): Set<EquipmentId> {
  const set = new Set<EquipmentId>(profile.equipment.filter((e) => e !== "none"));
  if (set.has("gym_equipment")) set.add("dumbbells");
  return set;
}

export function isEligible(profile: Profile, w: RecWorkout): boolean {
  const owned = effectiveEquipment(profile);
  for (const needed of w.equipment) {
    if (!owned.has(needed)) return false;
  }
  for (const limitation of profile.limitations) {
    if (!w.suitableFor.includes(limitation)) return false;
  }
  if (profile.fitnessLevel === "beginner" && w.level === "Advanced") return false;
  return true;
}

export function scoreWorkout(profile: Profile, w: RecWorkout): number {
  let score = 0;
  const primary = profile.primaryGoal;
  const secondary = secondaryGoalsOf(profile);
  const wSecondary = w.secondaryGoals ?? [];

  if (primary && (w.primaryGoals as string[]).includes(primary)) score += 40;
  else if (primary && (wSecondary as string[]).includes(primary)) score += 15;

  let secPrimary = 0;
  let secSecondary = 0;
  for (const g of secondary) {
    if ((w.primaryGoals as string[]).includes(g)) secPrimary += 12;
    else if ((wSecondary as string[]).includes(g)) secSecondary += 6;
  }
  score += Math.min(24, secPrimary) + Math.min(12, secSecondary);

  if (profile.fitnessLevel) {
    const gap = Math.abs(PROFILE_LEVEL_ORDER[profile.fitnessLevel] - LEVEL_ORDER[w.level]);
    if (gap === 0) score += 25;
    else if (gap === 1) score += 10;
  }

  if (profile.durationPreference) {
    const wanted = BAND_ORDER.indexOf(profile.durationPreference);
    const actual = bandIndexOf(w.durationMin);
    if (wanted === actual) score += 20;
    else if (Math.abs(wanted - actual) === 1) score += 8;
  }

  let focus = 0;
  for (const f of profile.bodyFocus) {
    if (w.bodyFocus.includes(f)) focus += 8;
  }
  score += Math.min(16, focus);

  return score;
}

const byScoreThenTitle =
  (profile: Profile) =>
  (a: RecWorkout, b: RecWorkout): number => {
    const diff = scoreWorkout(profile, b) - scoreWorkout(profile, a);
    return diff !== 0 ? diff : a.title.localeCompare(b.title);
  };

// Safe default ordering for accounts without a fitness profile: gentle
// beginner sessions first, full-body and mobility leading.
function fallbackOrder<T extends RecWorkout>(workouts: T[]): T[] {
  const gentle = (w: RecWorkout) =>
    w.level === "Beginner" && (w.bodyFocus.includes("full_body") || w.bodyFocus.includes("mobility"));
  const intensityRank = { low: 0, moderate: 1, high: 2 };
  return [...workouts].sort((a, b) => {
    const ga = gentle(a) ? 0 : 1;
    const gb = gentle(b) ? 0 : 1;
    if (ga !== gb) return ga - gb;
    const la = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
    if (la !== 0) return la;
    const ia = intensityRank[a.intensity] - intensityRank[b.intensity];
    if (ia !== 0) return ia;
    return a.title.localeCompare(b.title);
  });
}

// Best matches for the user, hard rules applied. Never empty as long as the
// catalog isn't: with no fitness profile it falls back to gentle defaults.
export function getRecommendedWorkouts<T extends RecWorkout>(profile: Profile, workouts: T[]): T[] {
  if (!hasFitnessProfile(profile)) return fallbackOrder(workouts);
  const eligible = workouts.filter((w) => isEligible(profile, w));
  if (eligible.length === 0) return fallbackOrder(workouts);
  return [...eligible].sort(byScoreThenTitle(profile));
}

// Library ordering: everything stays browsable, but ineligible workouts sink
// below the ranked eligible ones.
export function rankForLibrary<T extends RecWorkout>(profile: Profile, workouts: T[]): T[] {
  if (!hasFitnessProfile(profile)) return fallbackOrder(workouts);
  const cmp = byScoreThenTitle(profile);
  return [...workouts].sort((a, b) => {
    const ea = isEligible(profile, a) ? 0 : 1;
    const eb = isEligible(profile, b) ? 0 : 1;
    if (ea !== eb) return ea - eb;
    return cmp(a, b);
  });
}

export function getRecommendedProgram(profile: Profile, programs: Program[]): Program | null {
  const goal = profile.primaryGoal ?? profile.goals[0];
  if (!goal) return null;
  const matching = programs.filter((p) => p.goal === goal);
  if (matching.length === 0) return null;
  const levelFits = (p: Program) => {
    if (p.level === "All") return true;
    if (!profile.fitnessLevel) return p.level === "Beginner";
    if (profile.fitnessLevel === "beginner") return p.level === "Beginner";
    return true;
  };
  return matching.find(levelFits) ?? matching[0];
}

export type TodayWorkout<T extends RecWorkout> = {
  workout: T;
  source: "program" | "recommended";
  program?: Program;
  dayNumber?: number;
  programComplete?: boolean;
};

type CompletionLike = { workoutId: string; ts: number };

// What the Home hero should show. Program next-entry when the user is on a
// program (with an eligibility-respecting substitution), otherwise the top
// recommendation, otherwise null so Home keeps its classic featured hero.
export function getTodayWorkout<T extends RecWorkout>(
  profile: Profile,
  completions: CompletionLike[],
  workouts: T[],
  programs: Program[],
  dayKeyOf: (ts: number) => string
): TodayWorkout<T> | null {
  const program = profile.programId ? programs.find((p) => p.id === profile.programId) : undefined;

  if (program && profile.programStartedAt) {
    const progress = deriveProgramProgress(program, profile.programStartedAt, completions, dayKeyOf);
    if (!progress.complete) {
      const entry: ProgramEntry = progress.next;
      const scheduled = workouts.find((w) => w.id === entry.workoutId);
      if (scheduled) {
        const workout = isEligible(profile, scheduled)
          ? scheduled
          : substituteFor(profile, scheduled, workouts);
        if (workout) {
          return { workout, source: "program", program, dayNumber: entry.dayNumber };
        }
      }
    } else {
      // Program finished: celebrate on Home and keep recommending.
      const ranked = getRecommendedWorkouts(profile, workouts);
      if (ranked.length > 0) {
        return { workout: ranked[0], source: "recommended", program, programComplete: true };
      }
    }
  }

  if (hasFitnessProfile(profile)) {
    const ranked = getRecommendedWorkouts(profile, workouts);
    if (ranked.length > 0) return { workout: ranked[0], source: "recommended" };
  }
  return null;
}

// Closest eligible stand-in for a scheduled workout the user can't do:
// prefer one sharing a body focus, otherwise the overall top recommendation.
function substituteFor<T extends RecWorkout>(
  profile: Profile,
  scheduled: RecWorkout,
  workouts: T[]
): T | null {
  const ranked = getRecommendedWorkouts(profile, workouts).filter((w) => isEligible(profile, w));
  if (ranked.length === 0) return null;
  const shared = ranked.find((w) => w.bodyFocus.some((f) => scheduled.bodyFocus.includes(f)));
  return shared ?? ranked[0];
}
