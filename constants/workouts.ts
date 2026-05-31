import { ImageSourcePropType } from "react-native";

export type Exercise = {
  id: string;
  name: string;
  detail: string;
  cue: string;
  seconds: number;
};

export type Workout = {
  id: string;
  title: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  durationMin: number;
  kcal: number;
  image: ImageSourcePropType;
  description: string;
  featured?: boolean;
  exercises: Exercise[];
};

export const CATEGORIES = ["All", "Pilates", "Yoga", "Strength", "HIIT"];

export const WORKOUTS: Workout[] = [
  {
    id: "reformer-pilates",
    title: "Reformer Pilates Flow",
    category: "Pilates",
    level: "Intermediate",
    durationMin: 45,
    kcal: 280,
    image: require("@/assets/images/photos/pilates.jpg"),
    description:
      "A controlled, low-impact flow that lengthens and strengthens. Focus on breath and precision through every movement.",
    featured: true,
    exercises: [
      { id: "e1", name: "The Hundred", detail: "Core warm-up", cue: "Pump arms, breathe steady", seconds: 60 },
      { id: "e2", name: "Roll Up", detail: "Spine articulation", cue: "Peel up one vertebra at a time", seconds: 50 },
      { id: "e3", name: "Single Leg Circles", detail: "Hip mobility", cue: "Keep hips anchored", seconds: 60 },
      { id: "e4", name: "Rolling Like a Ball", detail: "Balance & control", cue: "Stay rounded, control the roll", seconds: 45 },
      { id: "e5", name: "Single Leg Stretch", detail: "Core series", cue: "Draw navel to spine", seconds: 60 },
      { id: "e6", name: "Spine Stretch Forward", detail: "Lengthen", cue: "Reach long through fingertips", seconds: 50 },
      { id: "e7", name: "Saw", detail: "Rotation", cue: "Twist from the waist", seconds: 50 },
      { id: "e8", name: "Seal", detail: "Cool down", cue: "Slow, controlled breath", seconds: 45 },
    ],
  },
  {
    id: "morning-yoga",
    title: "Morning Glow Yoga",
    category: "Yoga",
    level: "Beginner",
    durationMin: 25,
    kcal: 150,
    image: require("@/assets/images/photos/yoga.jpg"),
    description:
      "Wake the body gently with grounding stretches and mindful breath to set a calm, intentional tone for your day.",
    featured: true,
    exercises: [
      { id: "y1", name: "Child's Pose", detail: "Ground", cue: "Soften the hips back", seconds: 50 },
      { id: "y2", name: "Cat-Cow", detail: "Spinal warm-up", cue: "Flow with your breath", seconds: 60 },
      { id: "y3", name: "Downward Dog", detail: "Lengthen", cue: "Press the floor away", seconds: 50 },
      { id: "y4", name: "Low Lunge", detail: "Hip opener", cue: "Sink and lift the chest", seconds: 60 },
      { id: "y5", name: "Forward Fold", detail: "Release", cue: "Let the head hang heavy", seconds: 45 },
      { id: "y6", name: "Seated Twist", detail: "Detox", cue: "Inhale tall, exhale twist", seconds: 50 },
      { id: "y7", name: "Savasana", detail: "Rest", cue: "Completely let go", seconds: 60 },
    ],
  },
  {
    id: "full-body-sculpt",
    title: "Full Body Sculpt",
    category: "Strength",
    level: "Intermediate",
    durationMin: 35,
    kcal: 280,
    image: require("@/assets/images/photos/strength.jpg"),
    description:
      "Sculpt and tone head to toe with a balanced strength circuit using light weights and bodyweight control.",
    featured: true,
    exercises: [
      { id: "s1", name: "Goblet Squat", detail: "Lower body", cue: "Chest up, drive through heels", seconds: 50 },
      { id: "s2", name: "Romanian Deadlift", detail: "Hamstrings & glutes", cue: "Hinge at the hips", seconds: 50 },
      { id: "s3", name: "Shoulder Press", detail: "Upper body", cue: "Brace the core", seconds: 45 },
      { id: "s4", name: "Reverse Lunge", detail: "Legs & balance", cue: "Step back with control", seconds: 60 },
      { id: "s5", name: "Bent Over Row", detail: "Back", cue: "Squeeze the shoulder blades", seconds: 50 },
      { id: "s6", name: "Glute Bridge", detail: "Glutes", cue: "Pause at the top", seconds: 50 },
      { id: "s7", name: "Plank", detail: "Core", cue: "Long line, hips level", seconds: 45 },
    ],
  },
  {
    id: "hiit-burn",
    title: "Express HIIT Burn",
    category: "HIIT",
    level: "Advanced",
    durationMin: 20,
    kcal: 240,
    image: require("@/assets/images/photos/hiit.jpg"),
    description:
      "A fast, sweaty interval session to spike your heart rate and torch energy in just twenty focused minutes.",
    exercises: [
      { id: "h1", name: "Jumping Jacks", detail: "Warm-up", cue: "Light and quick", seconds: 40 },
      { id: "h2", name: "Squat Jumps", detail: "Power", cue: "Land soft and quiet", seconds: 40 },
      { id: "h3", name: "Mountain Climbers", detail: "Cardio core", cue: "Drive the knees", seconds: 40 },
      { id: "h4", name: "Burpees", detail: "Full body", cue: "Pace your breath", seconds: 40 },
      { id: "h5", name: "High Knees", detail: "Cardio", cue: "Pump the arms", seconds: 40 },
      { id: "h6", name: "Plank Shoulder Taps", detail: "Core", cue: "Minimize the hip sway", seconds: 40 },
    ],
  },
  {
    id: "gentle-mobility",
    title: "Gentle Mobility Reset",
    category: "Yoga",
    level: "Beginner",
    durationMin: 18,
    kcal: 90,
    image: require("@/assets/images/photos/yoga.jpg"),
    description:
      "A restorative stretch sequence to release tension, improve mobility, and unwind after a long day.",
    exercises: [
      { id: "m1", name: "Neck Rolls", detail: "Release", cue: "Slow circles", seconds: 40 },
      { id: "m2", name: "Thread the Needle", detail: "Upper back", cue: "Melt the shoulder down", seconds: 50 },
      { id: "m3", name: "Hip Flexor Stretch", detail: "Hips", cue: "Tuck the tailbone", seconds: 50 },
      { id: "m4", name: "Figure Four", detail: "Glutes", cue: "Flex the foot", seconds: 50 },
      { id: "m5", name: "Supine Twist", detail: "Spine", cue: "Both shoulders grounded", seconds: 50 },
    ],
  },
  {
    id: "core-define",
    title: "Core Define",
    category: "Strength",
    level: "Intermediate",
    durationMin: 15,
    kcal: 120,
    image: require("@/assets/images/photos/strength.jpg"),
    description:
      "A focused core session to build deep abdominal strength and a stable, supported midline.",
    exercises: [
      { id: "c1", name: "Dead Bug", detail: "Stability", cue: "Press low back down", seconds: 45 },
      { id: "c2", name: "Bicycle Crunch", detail: "Obliques", cue: "Rotate from the ribs", seconds: 45 },
      { id: "c3", name: "Hollow Hold", detail: "Deep core", cue: "Lower back glued down", seconds: 40 },
      { id: "c4", name: "Side Plank", detail: "Obliques", cue: "Stack the hips", seconds: 45 },
      { id: "c5", name: "Leg Lowers", detail: "Lower abs", cue: "Control the descent", seconds: 45 },
    ],
  },
];

export function getWorkout(id: string): Workout | undefined {
  return WORKOUTS.find((w) => w.id === id);
}
