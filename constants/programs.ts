import type { GoalId } from "@/lib/profile";

// Multi-week workout programs assembled from the seeded workouts in
// constants/workouts.ts. Deliberately react-native-free (no image requires) so
// the recommendation libs and their unit tests can import it directly.
//
// Each week is exactly 7 days; workoutId null marks a rest day. Program day
// numbers shown in the UI are 1-based positions INCLUDING rest days, so "Day 4"
// on the Home card matches what a user counting calendar days expects.

export type ProgramDay = { workoutId: string | null };

export type Program = {
  id: string;
  title: string;
  goal: GoalId;
  level: "Beginner" | "Intermediate" | "All";
  // Journey position: phase 1 is the starter program for a goal, phase 2 the
  // intermediate continuation offered when phase 1 completes (and recommended
  // directly to intermediate/advanced users).
  phase: 1 | 2;
  // The program this one chains into on completion; null ends the journey.
  nextProgramId?: string | null;
  description: string;
  weeks: ProgramDay[][];
};

const d = (workoutId: string | null): ProgramDay => ({ workoutId });
const rest = d(null);
const week = (...ids: (string | null)[]): ProgramDay[] => {
  if (ids.length !== 7) throw new Error("A program week must have exactly 7 days");
  return ids.map(d);
};

export const PROGRAMS: Program[] = [
  {
    id: "weight-loss-starter",
    title: "4-Week Weight Loss Starter",
    goal: "lose-weight",
    level: "Beginner",
    phase: 1,
    nextProgramId: "weight-loss-accelerator-4w",
    description:
      "Four weeks of gentle, consistent cardio that builds from easy low-impact sessions to confident full-body burns.",
    weeks: [
      week("beginner-fat-burn", null, "low-impact-sweat", null, "beginner-fat-burn", "full-body-stretch", null),
      week("low-impact-sweat", null, "no-jumping-fat-burn", null, "low-impact-cardio-core", "gentle-mobility", null),
      week("no-jumping-fat-burn", null, "full-body-cardio-sculpt", null, "low-impact-cardio-core", "core-define", null),
      week("full-body-cardio-sculpt", null, "no-jumping-fat-burn", null, "hiit-burn", "gentle-mobility", null),
    ],
  },
  {
    id: "tone-sculpt-4w",
    title: "4-Week Tone & Sculpt",
    goal: "tone",
    level: "Beginner",
    phase: 1,
    nextProgramId: "sculpt-define-4w",
    description:
      "A month of sculpting sessions that shape the glutes, arms, and core with Pilates-inspired control.",
    weeks: [
      week("booty-burn", null, "arms-abs-tone", null, "mindful-mat-pilates", "full-body-stretch", null),
      week("glutes-legs-sculpt", null, "core-define", null, "booty-burn", "gentle-mobility", null),
      week("arms-abs-tone", null, "glutes-legs-sculpt", null, "pilates-body-flow", "mindful-mat-pilates", null),
      week("full-body-sculpt", null, "booty-burn", null, "core-define", "gentle-mobility-reset", null),
    ],
  },
  {
    id: "strength-builder-4w",
    title: "4-Week Strength Builder",
    goal: "strength",
    level: "Beginner",
    phase: 1,
    nextProgramId: "progressive-strength-4w",
    description:
      "Build real strength week by week, from bodyweight foundations to confident dumbbell training.",
    weeks: [
      week("beginner-strength", null, "posture-core-reset", null, "beginner-strength", "gentle-mobility", null),
      week("beginner-strength", null, "upper-body-strength", null, "glutes-legs-sculpt", "full-body-stretch", null),
      week("full-body-dumbbell", null, "core-define", null, "upper-body-strength", "gentle-mobility", null),
      week("lower-body-power", null, "upper-body-strength", null, "full-body-dumbbell", "posture-core-reset", null),
    ],
  },
  {
    id: "flexibility-reset-14d",
    title: "14-Day Flexibility Reset",
    goal: "flexibility",
    level: "All",
    phase: 1,
    nextProgramId: "flexibility-flow-4w",
    description:
      "Two weeks of daily-ish stretching and mobility to restore ease in how you move.",
    weeks: [
      week("gentle-mobility-reset", "morning-yoga", null, "full-body-stretch", "evening-wind-down", "restorative-yoga-flow", null),
      week("full-body-stretch", "gentle-mobility", null, "restorative-yoga-flow", "evening-wind-down", "gentle-mobility-reset", null),
    ],
  },
  {
    id: "energy-boost-7d",
    title: "7-Day Energy Boost",
    goal: "energy",
    level: "Beginner",
    phase: 1,
    nextProgramId: "energy-momentum-4w",
    description:
      "One week of short, mood-lifting sessions to rebuild momentum without burning out.",
    weeks: [
      week("energy-boost-10", "morning-yoga", "low-impact-cardio-core", null, "full-body-cardio-sculpt", "energy-boost-10", "gentle-mobility-reset"),
    ],
  },
  {
    id: "mindful-wellness-reset",
    title: "Mindful Wellness Reset",
    goal: "wellness",
    level: "Beginner",
    phase: 1,
    nextProgramId: "mindful-balance-4w",
    description:
      "Two weeks of slow, restorative movement to reconnect breath, body, and mind.",
    weeks: [
      week("gentle-mobility-reset", null, "morning-yoga", "evening-wind-down", null, "mindful-mat-pilates", null),
      week("restorative-yoga-flow", null, "full-body-stretch", "evening-wind-down", null, "gentle-mobility", null),
    ],
  },
  // ---- Phase 2: intermediate continuations, offered when phase 1 completes
  // and recommended directly to intermediate/advanced users.
  {
    id: "weight-loss-accelerator-4w",
    title: "4-Week Weight Loss Accelerator",
    goal: "lose-weight",
    level: "Intermediate",
    phase: 2,
    nextProgramId: null,
    description:
      "Phase 2 turns up the pace: bigger sessions, quicker intervals, and a steady weekly rhythm that keeps results coming.",
    weeks: [
      week("no-jumping-fat-burn", null, "full-body-cardio-sculpt", null, "low-impact-cardio-core", "full-body-stretch", null),
      week("full-body-cardio-sculpt", null, "no-jumping-fat-burn", null, "hiit-burn", "gentle-mobility", null),
      week("hiit-burn", null, "full-body-cardio-sculpt", null, "no-jumping-fat-burn", "deep-stretch-flow", null),
      week("full-body-cardio-sculpt", null, "hiit-burn", null, "full-body-cardio-sculpt", "full-body-stretch", null),
    ],
  },
  {
    id: "sculpt-define-4w",
    title: "4-Week Sculpt & Define",
    goal: "tone",
    level: "Intermediate",
    phase: 2,
    nextProgramId: null,
    description:
      "Phase 2 sharpens the shape work: heavier lower-body days, focused core sessions, and recovery that keeps you moving.",
    weeks: [
      week("full-body-sculpt", null, "core-define", null, "glutes-legs-sculpt", "gentle-mobility", null),
      week("booty-burn", null, "full-body-sculpt", null, "arms-abs-tone", "full-body-stretch", null),
      week("glutes-legs-sculpt", null, "core-define", null, "full-body-sculpt", "mindful-mat-pilates", null),
      week("full-body-sculpt", null, "glutes-legs-sculpt", null, "core-define", "deep-stretch-flow", null),
    ],
  },
  {
    id: "progressive-strength-4w",
    title: "4-Week Progressive Strength",
    goal: "strength",
    level: "Intermediate",
    phase: 2,
    nextProgramId: null,
    description:
      "Phase 2 builds on your foundations with full dumbbell sessions and power days, balanced by posture and mobility work.",
    weeks: [
      week("full-body-dumbbell", null, "posture-core-reset", null, "upper-body-strength", "full-body-stretch", null),
      week("lower-body-power", null, "upper-body-strength", null, "full-body-dumbbell", "gentle-mobility", null),
      week("full-body-dumbbell", null, "lower-body-power", null, "upper-body-strength", "deep-stretch-flow", null),
      week("lower-body-power", null, "full-body-dumbbell", null, "upper-body-strength", "posture-core-reset", null),
    ],
  },
  {
    id: "flexibility-flow-4w",
    title: "4-Week Flexibility Flow",
    goal: "flexibility",
    level: "Intermediate",
    phase: 2,
    nextProgramId: null,
    description:
      "Phase 2 goes deeper: longer holds, focused hip work, and flowing sequences that turn new range into lasting ease.",
    weeks: [
      week("deep-stretch-flow", null, "hip-mobility-flow", null, "full-body-stretch", "morning-yoga", null),
      week("hip-mobility-flow", null, "deep-stretch-flow", null, "gentle-mobility-reset", "breath-and-balance", null),
      week("deep-stretch-flow", null, "hip-mobility-flow", null, "full-body-stretch", "restorative-yoga-flow", null),
      week("hip-mobility-flow", null, "deep-stretch-flow", null, "breath-and-balance", "full-body-stretch", null),
    ],
  },
  {
    id: "energy-momentum-4w",
    title: "4-Week Energy Momentum",
    goal: "energy",
    level: "Intermediate",
    phase: 2,
    nextProgramId: null,
    description:
      "Phase 2 makes energy a habit: brisk morning sessions and easy movement breaks that keep momentum through the month.",
    weeks: [
      week("sunrise-energizer-15", null, "energy-flow-20", null, "energy-boost-10", "gentle-mobility-reset", null),
      week("energy-flow-20", null, "sunrise-energizer-15", null, "low-impact-cardio-core", "full-body-stretch", null),
      week("sunrise-energizer-15", null, "energy-flow-20", null, "full-body-cardio-sculpt", "gentle-mobility", null),
      week("sunrise-energizer-15", null, "low-impact-cardio-core", null, "energy-flow-20", "full-body-stretch", null),
    ],
  },
  {
    id: "mindful-balance-4w",
    title: "4-Week Mindful Balance",
    goal: "wellness",
    level: "Intermediate",
    phase: 2,
    nextProgramId: null,
    description:
      "Phase 2 deepens the practice: balance work, slower flows, and evening wind-downs that make calm part of the routine.",
    weeks: [
      week("breath-and-balance", null, "morning-yoga", "evening-wind-down", null, "mindful-mat-pilates", null),
      week("restorative-yoga-flow", null, "breath-and-balance", "evening-wind-down", null, "gentle-mobility-reset", null),
      week("breath-and-balance", null, "mindful-mat-pilates", "evening-wind-down", null, "morning-yoga", null),
      week("restorative-yoga-flow", null, "breath-and-balance", "evening-wind-down", null, "deep-stretch-flow", null),
    ],
  },
];

export const getProgram = (id: string): Program | undefined => PROGRAMS.find((p) => p.id === id);
