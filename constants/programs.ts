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
    description:
      "Four weeks of gentle, consistent cardio that builds from easy low-impact sessions to confident full-body burns.",
    weeks: [
      week("beginner-fat-burn", null, "low-impact-sweat", null, "beginner-fat-burn", "full-body-stretch", null),
      week("low-impact-sweat", null, "no-jumping-fat-burn", null, "beginner-fat-burn", "gentle-mobility", null),
      week("no-jumping-fat-burn", null, "full-body-cardio-sculpt", null, "low-impact-sweat", "core-define", null),
      week("full-body-cardio-sculpt", null, "no-jumping-fat-burn", null, "hiit-burn", "gentle-mobility", null),
    ],
  },
  {
    id: "tone-sculpt-4w",
    title: "4-Week Tone & Sculpt",
    goal: "tone",
    level: "Beginner",
    description:
      "A month of sculpting sessions that shape the glutes, arms, and core with Pilates-inspired control.",
    weeks: [
      week("booty-burn", null, "arms-abs-tone", null, "pilates-body-flow", "full-body-stretch", null),
      week("glutes-legs-sculpt", null, "core-define", null, "booty-burn", "gentle-mobility", null),
      week("arms-abs-tone", null, "glutes-legs-sculpt", null, "pilates-body-flow", "full-body-stretch", null),
      week("full-body-sculpt", null, "booty-burn", null, "core-define", "gentle-mobility", null),
    ],
  },
  {
    id: "strength-builder-4w",
    title: "4-Week Strength Builder",
    goal: "strength",
    level: "Beginner",
    description:
      "Build real strength week by week, from bodyweight foundations to confident dumbbell training.",
    weeks: [
      week("beginner-strength", null, "core-define", null, "beginner-strength", "gentle-mobility", null),
      week("beginner-strength", null, "upper-body-strength", null, "glutes-legs-sculpt", "full-body-stretch", null),
      week("full-body-dumbbell", null, "core-define", null, "upper-body-strength", "gentle-mobility", null),
      week("lower-body-power", null, "upper-body-strength", null, "full-body-dumbbell", "full-body-stretch", null),
    ],
  },
  {
    id: "flexibility-reset-14d",
    title: "14-Day Flexibility Reset",
    goal: "flexibility",
    level: "All",
    description:
      "Two weeks of daily-ish stretching and mobility to restore ease in how you move.",
    weeks: [
      week("gentle-mobility", "morning-yoga", null, "full-body-stretch", "evening-wind-down", "morning-yoga", null),
      week("full-body-stretch", "gentle-mobility", null, "morning-yoga", "evening-wind-down", "full-body-stretch", null),
    ],
  },
  {
    id: "energy-boost-7d",
    title: "7-Day Energy Boost",
    goal: "energy",
    level: "Beginner",
    description:
      "One week of short, mood-lifting sessions to rebuild momentum without burning out.",
    weeks: [
      week("energy-boost-10", "morning-yoga", "energy-boost-10", null, "full-body-cardio-sculpt", "energy-boost-10", "gentle-mobility"),
    ],
  },
  {
    id: "mindful-wellness-reset",
    title: "Mindful Wellness Reset",
    goal: "wellness",
    level: "Beginner",
    description:
      "Two weeks of slow, restorative movement to reconnect breath, body, and mind.",
    weeks: [
      week("gentle-mobility", null, "morning-yoga", "evening-wind-down", null, "pilates-body-flow", null),
      week("morning-yoga", null, "full-body-stretch", "evening-wind-down", null, "gentle-mobility", null),
    ],
  },
];

export const getProgram = (id: string): Program | undefined => PROGRAMS.find((p) => p.id === id);
