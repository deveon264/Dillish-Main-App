import { ImageSourcePropType } from "react-native";
import type { GoalId, EquipmentId, BodyFocusId, LimitationId, FitnessLevel } from "@/lib/profile";
import { getDbExercise } from "@/constants/exerciseDb";

export type Exercise = {
  id: string;
  name: string;
  detail: string;
  description: string;
  cues: string[];
  modifications: string;
  sets: number;
  seconds: number;
  image?: ImageSourcePropType;
  // Optional metadata from the internal exercise database
  // (constants/exerciseDb.ts). The player also falls back to a name lookup in
  // that database, so hand-written entries may omit these.
  muscleGroups?: BodyFocusId[];
  equipmentNeeded?: EquipmentId[];
  level?: FitnessLevel;
};

export type Intensity = "low" | "moderate" | "high";

export type Workout = {
  id: string;
  title: string;
  category: string;
  focusAreas?: string[];
  level: "Beginner" | "Intermediate" | "Advanced";
  durationMin: number;
  kcal: number;
  image: ImageSourcePropType;
  description: string;
  featured?: boolean;
  exercises: Exercise[];
  // Personalization tags. `equipment` is what the workout REQUIRES (empty =
  // bodyweight only). `suitableFor` lists the limitations this workout is safe
  // for; a workout is filtered out for a user whose limitation it doesn't
  // list. Used for recommendation filtering only, not medical advice.
  primaryGoals: GoalId[];
  secondaryGoals?: GoalId[];
  equipment: EquipmentId[];
  bodyFocus: BodyFocusId[];
  suitableFor: LimitationId[];
  intensity: Intensity;
};

export const CATEGORIES = [
  "All",
  "Pilates",
  "Yoga",
  "Core/Abs",
  "Lower Body (Legs, Glutes)",
  "Upper Body (Chest, Back, Shoulders, Arms)",
  "Full Body",
  "Strength",
  "HIIT",
  "Mobility",
  "Stretch",
  "Low Impact",
  "Recovery",
];

// Every limitation, for workouts gentle enough to suit them all.
const ALL_LIMITATIONS: LimitationId[] = [
  "knee_friendly",
  "back_friendly",
  "low_impact",
  "no_jumping",
  "postpartum_friendly",
];

// Shared exercise seeds for the seeded workouts below. Each workout stamps a
// seed with its own per-workout id plus sets/seconds via ex(), because coach
// video uploads are keyed by (workoutId, exerciseId) and every workout needs
// stable, unique exercise ids.
type ExerciseSeed = Omit<Exercise, "id" | "sets" | "seconds">;

const POOL = {
  marchInPlace: {
    name: "March in Place",
    detail: "Gentle warm-up",
    description: "A soft, steady march to raise your heart rate and warm the whole body without any impact.",
    cues: [
      "Stand tall and lift knees to hip height.",
      "Swing arms naturally with each step.",
      "Keep shoulders relaxed and breathe steadily.",
    ],
    modifications: "Slow the pace or lower the knees any time.",
  },
  sideSteps: {
    name: "Side Steps",
    detail: "Low-impact cardio",
    description: "Rhythmic side-to-side steps that warm the hips and keep your heart rate lifted, feet always close to the floor.",
    cues: [
      "Step wide to one side, then bring feet together.",
      "Stay light and springy without leaving the floor.",
      "Add an arm reach for extra rhythm.",
    ],
    modifications: "Take smaller steps to reduce intensity.",
  },
  standingKneeDrive: {
    name: "Standing Knee Drive",
    detail: "Core and cardio",
    description: "Drive one knee toward your hands to fire the core and lift the pulse, one controlled rep at a time.",
    cues: [
      "Reach arms overhead to start.",
      "Pull one knee up as hands sweep down to meet it.",
      "Alternate sides with a steady rhythm.",
    ],
    modifications: "Lower the knee height or slow the tempo.",
  },
  standingPunches: {
    name: "Standing Punches",
    detail: "Upper-body cardio",
    description: "Fast alternating punches from a strong stance to work the arms and shoulders while the legs stay grounded.",
    cues: [
      "Soften knees and brace your core.",
      "Punch across the body with control.",
      "Exhale sharply with each punch.",
    ],
    modifications: "Slow the punches or drop the range.",
  },
  jumpingJacks: {
    name: "Jumping Jacks",
    detail: "Classic cardio",
    description: "The classic full-body warm-up jump to spike your heart rate and wake up every muscle.",
    cues: [
      "Start with feet together and arms at sides.",
      "Jump feet wide as arms sweep overhead.",
      "Land softly and keep a steady rhythm.",
    ],
    modifications: "Step side to side instead of jumping for low impact.",
    image: require("@/assets/exercises/jumping-jacks.webp"),
  },
  highKnees: {
    name: "High Knees",
    detail: "Sprint cardio",
    description: "Run in place driving the knees high to push your heart rate up and finish the set strong.",
    cues: [
      "Drive knees toward hip height.",
      "Stay on the balls of your feet.",
      "Pump arms to keep the pace.",
    ],
    modifications: "March in place with high knees instead of running.",
    image: require("@/assets/exercises/high-knees.webp"),
  },
  squatJumps: {
    name: "Squat Jumps",
    detail: "Explosive power",
    description: "A powerful jump out of a deep squat to build explosive lower-body strength.",
    cues: [
      "Sit back into a full squat.",
      "Explode up reaching tall.",
      "Land softly back into the squat.",
    ],
    modifications: "Do bodyweight squats without the jump.",
    image: require("@/assets/exercises/squat-jumps.webp"),
  },
  mountainClimbers: {
    name: "Mountain Climbers",
    detail: "Core cardio",
    description: "From a strong plank, drive the knees in fast to blend core stability with cardio burn.",
    cues: [
      "Set a strong plank with wrists under shoulders.",
      "Drive knees toward chest one at a time.",
      "Keep hips level and core tight.",
    ],
    modifications: "Slow the tempo or elevate hands on a bench.",
    image: require("@/assets/exercises/mountain-climbers.webp"),
  },
  bodyweightSquat: {
    name: "Bodyweight Squat",
    detail: "Lower-body foundation",
    description: "The foundational squat pattern to strengthen glutes, quads, and core with just your bodyweight.",
    cues: [
      "Set feet shoulder-width, toes slightly out.",
      "Sit hips back and down, chest proud.",
      "Press through heels to stand tall.",
    ],
    modifications: "Squat to a chair or reduce the depth.",
  },
  gobletSquat: {
    name: "Goblet Squat",
    detail: "Weighted squat",
    description: "Hold a weight at your chest and squat deep to load the legs while the core stays braced.",
    cues: [
      "Hug the weight close at chest height.",
      "Sit down between your hips, elbows inside knees.",
      "Drive up through the whole foot.",
    ],
    modifications: "Use a lighter weight or no weight at all.",
    image: require("@/assets/exercises/goblet-squat.webp"),
  },
  reverseLunge: {
    name: "Reverse Lunge",
    detail: "Single-leg strength",
    description: "Step back into a controlled lunge to sculpt the legs and challenge your balance one side at a time.",
    cues: [
      "Step one foot back and bend both knees.",
      "Keep front knee over the ankle.",
      "Push through the front heel to return.",
    ],
    modifications: "Hold a wall or chair for balance, or shorten the step.",
    image: require("@/assets/exercises/reverse-lunge.webp"),
  },
  gluteBridge: {
    name: "Glute Bridge",
    detail: "Glute activation",
    description: "Lift the hips from the floor to wake up the glutes and support a strong, stable lower back.",
    cues: [
      "Lie on your back, feet hip-width and close.",
      "Press through heels and squeeze glutes up.",
      "Lower down slowly with control.",
    ],
    modifications: "Reduce the range or hold the top for less reps.",
    image: require("@/assets/exercises/glute-bridge.webp"),
  },
  gluteKickback: {
    name: "Glute Kickback",
    detail: "Glute isolation",
    description: "From all fours, press one heel toward the ceiling to isolate and burn out the glutes.",
    cues: [
      "Set shoulders over wrists, hips over knees.",
      "Press one heel up keeping the knee bent.",
      "Squeeze at the top without arching the back.",
    ],
    modifications: "Lower to forearms or shorten the range.",
  },
  fireHydrant: {
    name: "Fire Hydrant",
    detail: "Outer glute",
    description: "Lift the bent knee out to the side from all fours to target the outer glutes and hips.",
    cues: [
      "Keep hips square to the floor.",
      "Lift the knee out to the side with control.",
      "Pause at the top, then lower slowly.",
    ],
    modifications: "Reduce the lift height to stay comfortable.",
  },
  clamshell: {
    name: "Clamshell",
    detail: "Hip stability",
    description: "A side-lying opener that strengthens the glute medius for stable, supported hips.",
    cues: [
      "Lie on your side, knees bent and stacked.",
      "Open the top knee like a shell, feet together.",
      "Keep hips stacked, do not roll back.",
    ],
    modifications: "Reduce the range or rest the head on your arm.",
  },
  calfRaises: {
    name: "Calf Raises",
    detail: "Lower-leg strength",
    description: "Rise onto the balls of your feet with control to strengthen calves and ankles.",
    cues: [
      "Stand tall with feet hip-width.",
      "Rise up slowly to the top.",
      "Lower with control, heels kissing the floor.",
    ],
    modifications: "Hold a wall for balance.",
  },
  romanianDeadlift: {
    name: "Romanian Deadlift",
    detail: "Hamstrings and glutes",
    description: "Hinge at the hips with a proud chest to strengthen the entire back line of your body.",
    cues: [
      "Soften knees and push hips straight back.",
      "Keep the weight close to your legs.",
      "Squeeze glutes to stand tall.",
    ],
    modifications: "Reduce the range or go without weight.",
    image: require("@/assets/exercises/romanian-deadlift.webp"),
  },
  shoulderPress: {
    name: "Shoulder Press",
    detail: "Shoulder strength",
    description: "Press weights overhead from shoulder height to build strong, defined shoulders.",
    cues: [
      "Start with weights at shoulder height.",
      "Press straight up without arching the back.",
      "Lower slowly back to the start.",
    ],
    modifications: "Use light weights, water bottles, or no weight at all.",
    image: require("@/assets/exercises/shoulder-press.webp"),
  },
  bentOverRow: {
    name: "Bent Over Row",
    detail: "Back strength",
    description: "Hinge forward and row the weights to your ribs to strengthen the back and improve posture.",
    cues: [
      "Hinge at hips with a long, flat back.",
      "Pull elbows toward the ceiling.",
      "Squeeze shoulder blades together at the top.",
    ],
    modifications: "Row one arm at a time with support.",
    image: require("@/assets/exercises/bent-over-row.webp"),
  },
  bicepsCurl: {
    name: "Biceps Curl",
    detail: "Arm sculpt",
    description: "Curl the weights with slow control to shape and strengthen the front of the arms.",
    cues: [
      "Pin elbows to your sides.",
      "Curl up without swinging.",
      "Lower slowly for the full burn.",
    ],
    modifications: "Use light weights or filled water bottles.",
  },
  tricepsExtension: {
    name: "Overhead Triceps Extension",
    detail: "Arm sculpt",
    description: "Extend the weight overhead to tone the back of the arms with steady control.",
    cues: [
      "Hold the weight with both hands overhead.",
      "Bend elbows to lower behind your head.",
      "Press back up keeping elbows narrow.",
    ],
    modifications: "Use one light weight or skip the weight.",
  },
  armCircles: {
    name: "Arm Circles",
    detail: "Shoulder endurance",
    description: "Small, continuous circles with long arms that light up the shoulders more than you expect.",
    cues: [
      "Reach arms long out to the sides.",
      "Draw small, controlled circles.",
      "Switch direction halfway through.",
    ],
    modifications: "Lower the arms slightly to rest mid-set.",
  },
  plank: {
    name: "Plank",
    detail: "Core hold",
    description: "The essential core hold. Long, strong, and steady from head to heels.",
    cues: [
      "Set forearms down, elbows under shoulders.",
      "Squeeze glutes and brace your belly.",
      "Keep a straight line from head to heels.",
    ],
    modifications: "Drop to knees while keeping hips in line.",
    image: require("@/assets/exercises/plank.webp"),
  },
  sidePlank: {
    name: "Side Plank",
    detail: "Oblique hold",
    description: "Balance on one forearm to fire the obliques and build a strong, stable waist.",
    cues: [
      "Stack shoulders, hips, and feet.",
      "Lift hips high and hold.",
      "Keep neck long and breathe.",
    ],
    modifications: "Bend the bottom knee to the floor for support.",
    image: require("@/assets/exercises/side-plank.webp"),
  },
  plankShoulderTaps: {
    name: "Plank Shoulder Taps",
    detail: "Anti-rotation core",
    description: "Tap each shoulder from a high plank while the hips stay perfectly still.",
    cues: [
      "Set a high plank with feet a little wider.",
      "Tap opposite shoulder without rocking hips.",
      "Move slowly and stay square.",
    ],
    modifications: "Do the taps from your knees.",
    image: require("@/assets/exercises/plank-shoulder-taps.webp"),
  },
  deadBug: {
    name: "Dead Bug",
    detail: "Deep core",
    description: "Lower opposite arm and leg from tabletop while the low back stays glued to the floor.",
    cues: [
      "Lie on back with arms up and knees at tabletop.",
      "Lower opposite arm and leg slowly.",
      "Keep low back pressed down the whole time.",
    ],
    modifications: "Move only the legs or only the arms to start.",
    image: require("@/assets/exercises/dead-bug.webp"),
  },
  bicycleCrunch: {
    name: "Bicycle Crunch",
    detail: "Oblique work",
    description: "Rotate elbow to opposite knee in a slow pedal to carve the waist and deep core.",
    cues: [
      "Support your head lightly, elbows wide.",
      "Bring elbow toward the opposite knee.",
      "Extend the other leg long and low.",
    ],
    modifications: "Keep feet higher or slow the tempo.",
    image: require("@/assets/exercises/bicycle-crunch.webp"),
  },
  theHundred: {
    name: "The Hundred",
    detail: "Pilates warm-up",
    description: "The signature Pilates breathing exercise. Pump the arms while the core holds everything steady.",
    cues: [
      "Curl head and shoulders up, legs to tabletop.",
      "Pump straight arms by your sides.",
      "Inhale for five counts, exhale for five.",
    ],
    modifications: "Keep head down or feet on the floor.",
    image: require("@/assets/exercises/the-hundred.webp"),
  },
  rollUp: {
    name: "Roll Up",
    detail: "Spinal articulation",
    description: "Peel the spine off the mat one vertebra at a time for deep core control and mobility.",
    cues: [
      "Reach arms overhead to start.",
      "Roll up slowly, one vertebra at a time.",
      "Fold forward, then roll back down with control.",
    ],
    modifications: "Bend knees or use hands for gentle help.",
    image: require("@/assets/exercises/roll-up.webp"),
  },
  singleLegStretch: {
    name: "Single Leg Stretch",
    detail: "Core coordination",
    description: "Switch legs in a smooth rhythm while the upper body stays curled and steady.",
    cues: [
      "Curl up with one knee hugged in.",
      "Extend the other leg long at a diagonal.",
      "Switch legs with smooth control.",
    ],
    modifications: "Keep head down or legs higher.",
    image: require("@/assets/exercises/single-leg-stretch.webp"),
  },
  spineStretchForward: {
    name: "Spine Stretch Forward",
    detail: "Spinal release",
    description: "Sit tall and reach forward through a rounded spine to lengthen the whole back line.",
    cues: [
      "Sit tall with legs long and apart.",
      "Reach forward rounding through the spine.",
      "Restack the spine slowly to sit tall.",
    ],
    modifications: "Bend the knees or sit on a folded towel.",
    image: require("@/assets/exercises/spine-stretch-forward.webp"),
  },
  catCow: {
    name: "Cat-Cow",
    detail: "Spinal flow",
    description: "Flow between arching and rounding the spine to release the back and sync with your breath.",
    cues: [
      "Start on all fours, wrists under shoulders.",
      "Inhale to drop the belly and lift the gaze.",
      "Exhale to round the spine toward the ceiling.",
    ],
    modifications: "Move within a smaller, comfortable range.",
    image: require("@/assets/exercises/cat-cow.webp"),
  },
  childsPose: {
    name: "Child's Pose",
    detail: "Resting stretch",
    description: "Sink the hips back over the heels and let the whole back body soften and release.",
    cues: [
      "Kneel and fold hips back toward heels.",
      "Walk hands forward and rest the forehead down.",
      "Breathe slowly into the back ribs.",
    ],
    modifications: "Widen the knees or rest on a pillow.",
    image: require("@/assets/exercises/childs-pose.webp"),
  },
  forwardFold: {
    name: "Standing Forward Fold",
    detail: "Hamstring release",
    description: "Hinge forward and hang heavy to release hamstrings, back, and neck.",
    cues: [
      "Soften knees and fold from the hips.",
      "Let head and arms hang heavy.",
      "Sway gently side to side if it feels good.",
    ],
    modifications: "Bend knees generously or rest hands on shins.",
    image: require("@/assets/exercises/forward-fold.webp"),
  },
  lowLunge: {
    name: "Low Lunge",
    detail: "Hip opener",
    description: "Sink into a deep lunge with the back knee down to open the hip flexors.",
    cues: [
      "Step one foot forward, back knee down.",
      "Sink hips forward and down.",
      "Lift the chest and breathe into the stretch.",
    ],
    modifications: "Pad the back knee with a towel.",
    image: require("@/assets/exercises/low-lunge.webp"),
  },
  figureFour: {
    name: "Figure Four Stretch",
    detail: "Glute release",
    description: "Cross the ankle over the opposite knee and draw the legs in for a deep glute stretch.",
    cues: [
      "Lie on your back, cross ankle over knee.",
      "Draw the bottom leg toward your chest.",
      "Keep head and shoulders relaxed on the mat.",
    ],
    modifications: "Keep the bottom foot on the floor for less depth.",
    image: require("@/assets/exercises/figure-four.webp"),
  },
  supineTwist: {
    name: "Supine Twist",
    detail: "Spinal unwind",
    description: "Drop the knees to one side and let the spine unwind while the shoulders stay grounded.",
    cues: [
      "Hug knees in, then drop them to one side.",
      "Reach the opposite arm out and gaze away.",
      "Breathe long and let gravity do the work.",
    ],
    modifications: "Place a pillow under the knees.",
    image: require("@/assets/exercises/supine-twist.webp"),
  },
  threadTheNeedle: {
    name: "Thread the Needle",
    detail: "Shoulder release",
    description: "Slide one arm under the body from all fours to release the shoulder and upper back.",
    cues: [
      "Start on all fours.",
      "Slide one arm under the chest, palm up.",
      "Rest shoulder and ear down, breathe.",
    ],
    modifications: "Reduce the reach or pad the shoulder.",
    image: require("@/assets/exercises/thread-the-needle.webp"),
  },
  neckRolls: {
    name: "Neck Rolls",
    detail: "Neck release",
    description: "Slow, gentle half-circles of the neck to melt away tension where you hold it most.",
    cues: [
      "Drop chin toward chest to start.",
      "Roll ear toward one shoulder slowly.",
      "Reverse direction and keep shoulders relaxed.",
    ],
    modifications: "Reduce range and avoid rolling the head back.",
    image: require("@/assets/exercises/neck-rolls.webp"),
  },
  savasana: {
    name: "Savasana",
    detail: "Final rest",
    description: "Lie completely still, let the breath settle, and give the body a moment of full rest.",
    cues: [
      "Lie on your back, arms soft at your sides.",
      "Let the feet fall open and jaw unclench.",
      "Follow the breath without changing it.",
    ],
    modifications: "Place a pillow under the knees or head.",
    image: require("@/assets/exercises/savasana.webp"),
  },
} satisfies Record<string, ExerciseSeed>;

const ex = (
  key: keyof typeof POOL,
  id: string,
  sets: number,
  seconds: number,
  over: Partial<Exercise> = {}
): Exercise => ({
  id,
  sets,
  seconds,
  ...POOL[key],
  ...over,
});

const FOCUS_LABEL: Record<BodyFocusId, string> = {
  full_body: "Full body",
  core_abs: "Core & abs",
  glutes: "Glutes",
  legs: "Legs",
  arms: "Arms",
  upper_body: "Upper body",
  back_posture: "Back & posture",
  mobility: "Mobility",
};

const LEVEL_LABEL: Record<FitnessLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

// Builds a player Exercise from the internal exercise database
// (constants/exerciseDb.ts, sourced from the public-domain free-exercise-db;
// see docs/exercise-db-source.md). Throws at module load on a bad id so a
// typo'd reference fails tests instead of shipping a broken workout.
const dbEx = (
  dbId: string,
  id: string,
  sets: number,
  seconds: number,
  over: Partial<Exercise> = {}
): Exercise => {
  const d = getDbExercise(dbId);
  if (!d) throw new Error(`Unknown exercise database id: ${dbId}`);
  return {
    id,
    sets,
    seconds,
    name: d.name,
    detail: `${d.muscleGroups.map((m) => FOCUS_LABEL[m]).join(" · ")} · ${LEVEL_LABEL[d.level]}`,
    description: d.instructions.join(" "),
    cues: d.instructions.slice(0, 4),
    modifications: "Move within a comfortable range, shorten the set, and rest whenever you need to.",
    muscleGroups: d.muscleGroups,
    equipmentNeeded: d.equipment,
    level: d.level,
    ...over,
  };
};

export const WORKOUTS: Workout[] = [
  {
    id: "reformer-pilates",
    title: "Reformer Pilates Flow",
    category: "Pilates",
    focusAreas: ["Core/Abs", "Full Body"],
    level: "Intermediate",
    // Matches the session length computed from the exercises (the app always
    // displays the computed value); also feeds duration-preference scoring.
    durationMin: 25,
    kcal: 280,
    image: require("@/assets/images/photos/reformer-pilates-flow-alt.webp"),
    description:
      "A controlled, low-impact flow that lengthens and strengthens. Focus on breath and precision through every movement.",
    featured: true,
    primaryGoals: ["tone"],
    secondaryGoals: ["strength", "flexibility"],
    equipment: ["pilates_equipment"],
    bodyFocus: ["core_abs", "full_body"],
    suitableFor: ["low_impact", "no_jumping", "knee_friendly"],
    intensity: "moderate",
    exercises: [
      {
        id: "e1",
        image: require("@/assets/exercises/the-hundred.webp"),
        name: "The Hundred",
        detail: "Core warm-up",
        description:
          "A classical Pilates exercise that warms up the body, builds core strength, and improves breathing coordination. Focus on keeping the lower back imprinted on the mat.",
        cues: [
          "Scoop your abs deep and lift your head, neck and shoulders off the mat.",
          "Pump your arms vigorously up and down in a small range of motion.",
          "Inhale for 5 counts, exhale for 5 counts. Complete 10 breath cycles.",
        ],
        modifications:
          "If you have neck tension, keep your head down. Bend your knees to tabletop position to reduce lower back pressure.",
        sets: 3,
        seconds: 60,
      },
      {
        id: "e2",
        image: require("@/assets/exercises/roll-up.webp"),
        name: "Roll Up",
        detail: "Spine articulation",
        description:
          "A slow articulation of the spine that stretches the back and strengthens the deep abdominals. Move with control, one vertebra at a time.",
        cues: [
          "Reach the arms overhead, then float them forward as you curl up.",
          "Peel the spine off the mat slowly, pressing the navel to the spine.",
          "Roll back down with the same control, resisting gravity.",
        ],
        modifications: "If the full roll is too much, bend your knees or hold behind the thighs for support.",
        sets: 3,
        seconds: 50,
      },
      {
        id: "e3",
        image: require("@/assets/exercises/single-leg-circles.webp"),
        name: "Single Leg Circles",
        detail: "Hip mobility",
        description:
          "A hip mobility exercise that challenges core stability while the leg draws controlled circles. Keep the pelvis still and grounded.",
        cues: [
          "Anchor both hips to the mat and extend one leg to the ceiling.",
          "Draw smooth circles with the leg, crossing the midline.",
          "Keep the circles small enough to keep the hips quiet.",
        ],
        modifications: "Bend the supporting knee with the foot flat to ease lower back strain.",
        sets: 2,
        seconds: 60,
      },
      {
        id: "e4",
        image: require("@/assets/exercises/rolling-like-a-ball.webp"),
        name: "Rolling Like a Ball",
        detail: "Balance & control",
        description:
          "A balance and massage exercise that mobilizes the spine and builds control. Stay rounded and use the breath to control the roll.",
        cues: [
          "Balance just behind the sit bones in a tight tuck.",
          "Inhale to roll back to the shoulder blades, exhale to return.",
          "Avoid rolling onto the neck and never use momentum.",
        ],
        modifications: "Hold the balance without rolling if you have back sensitivity.",
        sets: 3,
        seconds: 45,
      },
      {
        id: "e5",
        image: require("@/assets/exercises/single-leg-stretch.webp"),
        name: "Single Leg Stretch",
        detail: "Core series",
        description:
          "A core series staple that builds abdominal endurance and coordination. Draw the navel to the spine throughout.",
        cues: [
          "Curl the upper body up and hug one knee to the chest.",
          "Extend the opposite leg long at a 45 degree angle.",
          "Switch legs smoothly while keeping the torso stable.",
        ],
        modifications: "Raise the extended leg higher or keep the head down to reduce intensity.",
        sets: 3,
        seconds: 60,
      },
      {
        id: "e6",
        image: require("@/assets/exercises/spine-stretch-forward.webp"),
        name: "Spine Stretch Forward",
        detail: "Lengthen",
        description:
          "A seated forward stretch that lengthens the spine and hamstrings while engaging the core. Reach long through the fingertips.",
        cues: [
          "Sit tall with the legs extended slightly wider than the hips.",
          "Exhale and curl forward, stacking the spine down.",
          "Inhale to restack the spine one vertebra at a time.",
        ],
        modifications: "Bend the knees slightly if the hamstrings are tight.",
        sets: 2,
        seconds: 50,
      },
      {
        id: "e7",
        image: require("@/assets/exercises/saw.webp"),
        name: "Saw",
        detail: "Rotation",
        description:
          "A rotational stretch that wrings out the spine and stretches the back of the legs. Twist from the waist, not the arms.",
        cues: [
          "Sit tall with the arms reaching wide to the sides.",
          "Twist toward one leg and reach the opposite hand past the foot.",
          "Return to center tall, then twist to the other side.",
        ],
        modifications: "Keep the twist gentle and the knees soft to protect the lower back.",
        sets: 2,
        seconds: 50,
      },
      {
        id: "e8",
        image: require("@/assets/exercises/seal.webp"),
        name: "Seal",
        detail: "Cool down",
        description:
          "A playful cool-down that massages the spine and restores the breath. Move slowly and stay controlled.",
        cues: [
          "Balance in a tight tuck holding the ankles from the inside.",
          "Roll back to the shoulders, then return to balance.",
          "Keep the breath slow and the movement smooth.",
        ],
        modifications: "Skip the rolling and simply hold the balanced tuck and breathe.",
        sets: 2,
        seconds: 45,
      },
    ],
  },
  {
    id: "morning-yoga",
    title: "Morning Glow Yoga",
    category: "Yoga",
    focusAreas: ["Full Body"],
    level: "Beginner",
    // Matches the session length computed from the exercises (the app always
    // displays the computed value); also feeds duration-preference scoring.
    durationMin: 14,
    kcal: 150,
    image: require("@/assets/images/photos/yoga.jpg"),
    description:
      "Wake the body gently with grounding stretches and mindful breath to set a calm, intentional tone for your day.",
    featured: true,
    primaryGoals: ["flexibility", "wellness"],
    secondaryGoals: ["energy"],
    equipment: ["yoga_mat"],
    bodyFocus: ["full_body", "mobility"],
    suitableFor: ["knee_friendly", "back_friendly", "low_impact", "no_jumping", "postpartum_friendly"],
    intensity: "low",
    exercises: [
      {
        id: "y1",
        image: require("@/assets/exercises/childs-pose.webp"),
        name: "Child's Pose",
        detail: "Ground",
        description:
          "A grounding resting pose that gently stretches the back, hips, and ankles. Use it to settle the breath and release tension.",
        cues: [
          "Bring the big toes together and widen the knees.",
          "Sink the hips back toward the heels and walk the hands forward.",
          "Rest the forehead down and breathe into the back ribs.",
        ],
        modifications: "Place a cushion under the hips or forehead for extra support.",
        sets: 2,
        seconds: 50,
      },
      {
        id: "y2",
        image: require("@/assets/exercises/cat-cow.webp"),
        name: "Cat-Cow",
        detail: "Spinal warm-up",
        description:
          "A spinal warm-up that flows between flexion and extension to mobilize the back. Sync every movement with your breath.",
        cues: [
          "Start on all fours with wrists under shoulders, knees under hips.",
          "Inhale to drop the belly and lift the gaze for Cow.",
          "Exhale to round the spine and tuck the chin for Cat.",
        ],
        modifications: "Make fists or come onto the forearms if the wrists are sensitive.",
        sets: 3,
        seconds: 60,
      },
      {
        id: "y3",
        image: require("@/assets/exercises/downward-dog.webp"),
        name: "Downward Dog",
        detail: "Lengthen",
        description:
          "A full-body stretch that lengthens the spine and hamstrings while building shoulder strength. Press the floor away to create length.",
        cues: [
          "Lift the hips up and back into an inverted V shape.",
          "Press through the palms and reach the heels toward the floor.",
          "Relax the neck and let the head hang between the arms.",
        ],
        modifications: "Bend the knees generously to keep a long spine.",
        sets: 2,
        seconds: 50,
      },
      {
        id: "y4",
        image: require("@/assets/exercises/low-lunge.webp"),
        name: "Low Lunge",
        detail: "Hip opener",
        description:
          "A hip opener that stretches the front of the back leg and strengthens the front leg. Sink low and lift the chest.",
        cues: [
          "Step one foot forward between the hands.",
          "Lower the back knee and sink the hips forward and down.",
          "Lift the chest and reach the arms overhead.",
        ],
        modifications: "Place a blanket under the back knee for cushioning.",
        sets: 2,
        seconds: 60,
      },
      {
        id: "y5",
        image: require("@/assets/exercises/forward-fold.webp"),
        name: "Forward Fold",
        detail: "Release",
        description:
          "A calming forward bend that releases the hamstrings and spine. Let the head hang heavy to release the neck.",
        cues: [
          "Hinge from the hips and fold the torso over the legs.",
          "Let the head and arms hang toward the floor.",
          "Soften the knees and relax the jaw.",
        ],
        modifications: "Bend the knees deeply or rest the hands on blocks.",
        sets: 2,
        seconds: 45,
      },
      {
        id: "y6",
        image: require("@/assets/exercises/seated-twist.webp"),
        name: "Seated Twist",
        detail: "Detox",
        description:
          "A detoxifying rotation that mobilizes the spine and aids digestion. Inhale tall, exhale to twist deeper.",
        cues: [
          "Sit tall with the legs extended or crossed.",
          "Inhale to lengthen the spine upward.",
          "Exhale and rotate from the waist, using the hand for leverage.",
        ],
        modifications: "Keep the twist gentle and avoid forcing with the arm.",
        sets: 2,
        seconds: 50,
      },
      {
        id: "y7",
        image: require("@/assets/exercises/savasana.webp"),
        name: "Savasana",
        detail: "Rest",
        description:
          "A final rest that integrates the practice and calms the nervous system. Completely let go and stay still.",
        cues: [
          "Lie flat with the arms relaxed alongside the body.",
          "Let the feet fall open and soften the whole body.",
          "Breathe naturally and release all effort.",
        ],
        modifications: "Place a bolster under the knees to ease the lower back.",
        sets: 1,
        seconds: 60,
      },
    ],
  },
  {
    id: "full-body-sculpt",
    title: "Full Body Sculpt",
    category: "Strength",
    focusAreas: [
      "Core/Abs",
      "Full Body",
      "Lower Body (Legs, Glutes)",
      "Upper Body (Chest, Back, Shoulders, Arms)",
    ],
    level: "Intermediate",
    // Matches the session length computed from the exercises (the app always
    // displays the computed value); also feeds duration-preference scoring.
    durationMin: 23,
    kcal: 240,
    image: require("@/assets/images/photos/strength.jpg"),
    description:
      "Sculpt and tone head to toe with a balanced bodyweight circuit that builds strength and control, no equipment needed.",
    featured: true,
    primaryGoals: ["tone"],
    secondaryGoals: ["strength", "lose-weight"],
    equipment: [],
    bodyFocus: ["full_body"],
    suitableFor: ["low_impact", "no_jumping"],
    intensity: "moderate",
    exercises: [
      dbEx("Bodyweight_Squat", "sc1", 3, 55),
      ex("reverseLunge", "sc2", 3, 55),
      dbEx("Butt_Lift_Bridge", "sc3", 3, 55, {
        name: "Glute Bridge",
        image: require("@/assets/exercises/glute-bridge.webp"),
      }),
      dbEx("Pushups", "sc4", 3, 55, {
        name: "Knee Push-up",
        modifications: "Stay on your knees with hips in line; straighten the legs for a full push-up when you feel strong.",
      }),
      dbEx("Plank", "sc5", 3, 55, { image: require("@/assets/exercises/plank.webp") }),
      dbEx("Mountain_Climbers", "sc6", 3, 55, {
        image: require("@/assets/exercises/mountain-climbers.webp"),
      }),
      dbEx("Dead_Bug", "sc7", 3, 55, { image: require("@/assets/exercises/dead-bug.webp") }),
      dbEx("Childs_Pose", "sc8", 2, 55, {
        name: "Cooldown Stretch",
        image: require("@/assets/exercises/childs-pose.webp"),
      }),
    ],
  },
  {
    id: "hiit-burn",
    title: "Express HIIT Burn",
    category: "HIIT",
    focusAreas: ["Core/Abs", "Full Body"],
    level: "Advanced",
    durationMin: 20,
    kcal: 240,
    image: require("@/assets/images/photos/hiit.jpg"),
    description:
      "A fast, sweaty interval session to spike your heart rate and torch energy in just twenty focused minutes.",
    primaryGoals: ["lose-weight"],
    secondaryGoals: ["energy"],
    equipment: [],
    bodyFocus: ["full_body", "core_abs"],
    suitableFor: [],
    intensity: "high",
    exercises: [
      {
        id: "h1",
        image: require("@/assets/exercises/jumping-jacks.webp"),
        name: "Jumping Jacks",
        detail: "Warm-up",
        description:
          "A full-body warm-up that raises the heart rate and loosens the joints. Stay light and quick.",
        cues: [
          "Start with the feet together and arms at the sides.",
          "Jump the feet wide as the arms sweep overhead.",
          "Land softly and keep a steady rhythm.",
        ],
        modifications: "Step side to side instead of jumping for low impact.",
        sets: 4,
        seconds: 40,
      },
      {
        id: "h2",
        image: require("@/assets/exercises/squat-jumps.webp"),
        name: "Squat Jumps",
        detail: "Power",
        description:
          "An explosive lower-body move that builds power and elevates the heart rate. Land soft and quiet.",
        cues: [
          "Lower into a squat with the chest tall.",
          "Explode up and jump off the floor.",
          "Land softly back into the squat.",
        ],
        modifications: "Remove the jump and do fast bodyweight squats.",
        sets: 4,
        seconds: 40,
      },
      {
        id: "h3",
        image: require("@/assets/exercises/mountain-climbers.webp"),
        name: "Mountain Climbers",
        detail: "Cardio core",
        description:
          "A cardio-core drill that builds endurance and stability. Drive the knees quickly while keeping the hips level.",
        cues: [
          "Start in a high plank with shoulders over wrists.",
          "Drive one knee toward the chest, then switch quickly.",
          "Keep the hips low and the core tight.",
        ],
        modifications: "Slow the pace or tap the floor instead of driving fast.",
        sets: 4,
        seconds: 40,
      },
      {
        id: "h4",
        image: require("@/assets/exercises/burpees.webp"),
        name: "Burpees",
        detail: "Full body",
        description:
          "A full-body conditioning move that builds strength and stamina. Pace your breath to keep moving.",
        cues: [
          "Squat down and plant the hands on the floor.",
          "Jump or step back to a plank, then return.",
          "Stand and jump at the top.",
        ],
        modifications: "Step in and out and skip the jump for low impact.",
        sets: 4,
        seconds: 40,
      },
      {
        id: "h5",
        image: require("@/assets/exercises/high-knees.webp"),
        name: "High Knees",
        detail: "Cardio",
        description:
          "A cardio drill that raises the heart rate and warms the hip flexors. Pump the arms and stay tall.",
        cues: [
          "Run in place driving the knees to hip height.",
          "Stay on the balls of the feet and land softly.",
          "Pump the arms in rhythm with the legs.",
        ],
        modifications: "March in place with high knees for lower impact.",
        sets: 4,
        seconds: 40,
      },
      {
        id: "h6",
        image: require("@/assets/exercises/plank-shoulder-taps.webp"),
        name: "Plank Shoulder Taps",
        detail: "Core",
        description:
          "A core stabilizer that resists rotation while building shoulder control. Minimize the hip sway.",
        cues: [
          "Hold a high plank with a wide, stable stance.",
          "Tap one hand to the opposite shoulder.",
          "Keep the hips square and steady throughout.",
        ],
        modifications: "Widen the feet or drop to the knees for stability.",
        sets: 3,
        seconds: 40,
      },
    ],
  },
  {
    id: "gentle-mobility",
    title: "Gentle Mobility Reset",
    category: "Yoga",
    focusAreas: ["Lower Body (Legs, Glutes)", "Upper Body (Chest, Back, Shoulders, Arms)", "Mobility", "Stretch", "Low Impact"],
    level: "Beginner",
    durationMin: 18,
    kcal: 90,
    image: require("@/assets/images/photos/gentle-mobility-reset.webp"),
    description:
      "A restorative stretch sequence to release tension, improve mobility, and unwind after a long day.",
    primaryGoals: ["flexibility"],
    secondaryGoals: ["wellness"],
    equipment: [],
    bodyFocus: ["mobility", "back_posture"],
    suitableFor: ALL_LIMITATIONS,
    intensity: "low",
    exercises: [
      {
        id: "m1",
        image: require("@/assets/exercises/neck-rolls.webp"),
        name: "Neck Rolls",
        detail: "Release",
        description:
          "A gentle release for the neck and upper traps. Move slowly through small, controlled circles.",
        cues: [
          "Drop the chin toward the chest to start.",
          "Roll the ear toward one shoulder slowly.",
          "Reverse the direction and keep the shoulders relaxed.",
        ],
        modifications: "Reduce the range and avoid rolling the head back.",
        sets: 2,
        seconds: 40,
      },
      {
        id: "m2",
        image: require("@/assets/exercises/thread-the-needle.webp"),
        name: "Thread the Needle",
        detail: "Upper back",
        description:
          "An upper-back twist that releases tension between the shoulder blades. Melt the shoulder toward the floor.",
        cues: [
          "Start on all fours and reach one arm under the body.",
          "Lower the shoulder and temple toward the mat.",
          "Breathe into the upper back and hold.",
        ],
        modifications: "Place a cushion under the shoulder or head.",
        sets: 2,
        seconds: 50,
      },
      {
        id: "m3",
        image: require("@/assets/exercises/hip-flexor-stretch.webp"),
        name: "Hip Flexor Stretch",
        detail: "Hips",
        description:
          "A stretch for the front of the hips that counteracts sitting. Tuck the tailbone to deepen it.",
        cues: [
          "Kneel in a lunge with the back knee down.",
          "Tuck the tailbone and shift the hips forward.",
          "Lift the chest and breathe into the stretch.",
        ],
        modifications: "Cushion the back knee and reduce the depth.",
        sets: 2,
        seconds: 50,
      },
      {
        id: "m4",
        image: require("@/assets/exercises/figure-four.webp"),
        name: "Figure Four",
        detail: "Glutes",
        description:
          "A glute and hip stretch that relieves tightness in the seat. Flex the foot to protect the knee.",
        cues: [
          "Lie on the back and cross one ankle over the opposite knee.",
          "Draw the legs toward the chest.",
          "Flex the crossed foot and keep the head relaxed.",
        ],
        modifications: "Keep the bottom foot on the floor for a lighter stretch.",
        sets: 2,
        seconds: 50,
      },
      {
        id: "m5",
        image: require("@/assets/exercises/supine-twist.webp"),
        name: "Supine Twist",
        detail: "Spine",
        description:
          "A spinal twist that releases the lower back and aids relaxation. Keep both shoulders grounded.",
        cues: [
          "Lie on the back and hug the knees in.",
          "Drop the knees to one side and extend the arms wide.",
          "Turn the gaze the opposite way and breathe.",
        ],
        modifications: "Place a pillow between or under the knees.",
        sets: 2,
        seconds: 50,
      },
    ],
  },
  {
    id: "core-define",
    title: "Core Define",
    category: "Strength",
    focusAreas: ["Core/Abs"],
    level: "Intermediate",
    durationMin: 15,
    kcal: 120,
    image: require("@/assets/images/photos/core-define.webp"),
    description:
      "A focused core session to build deep abdominal strength and a stable, supported midline.",
    primaryGoals: ["tone"],
    secondaryGoals: ["strength"],
    equipment: [],
    bodyFocus: ["core_abs"],
    suitableFor: ["knee_friendly", "low_impact", "no_jumping"],
    intensity: "moderate",
    exercises: [
      dbEx("Dead_Bug", "cd1", 2, 55, { image: require("@/assets/exercises/dead-bug.webp") }),
      dbEx("Plank", "cd2", 2, 55, { image: require("@/assets/exercises/plank.webp") }),
      dbEx("FP_Bicycle_Crunch", "cd3", 2, 55, {
        image: require("@/assets/exercises/bicycle-crunch.webp"),
      }),
      ex("sidePlank", "cd4", 2, 55),
      dbEx("Flat_Bench_Lying_Leg_Raise", "cd5", 2, 55, {
        name: "Leg Raises",
        image: require("@/assets/exercises/leg-lowers.webp"),
      }),
      dbEx("Russian_Twist", "cd6", 2, 55),
      ex("spineStretchForward", "cd7", 2, 55),
    ],
  },
  {
    id: "beginner-fat-burn",
    title: "Beginner Fat Burn",
    category: "HIIT",
    focusAreas: ["Full Body"],
    level: "Beginner",
    durationMin: 20,
    kcal: 160,
    image: require("@/assets/images/photos/hiit.jpg"),
    description:
      "A friendly first step into fat-burning cardio. Simple standing moves, steady pace, and a proper sweat without the intimidation.",
    primaryGoals: ["lose-weight"],
    secondaryGoals: ["energy"],
    equipment: [],
    bodyFocus: ["full_body"],
    suitableFor: [],
    intensity: "moderate",
    exercises: [
      ex("marchInPlace", "bfb1", 3, 70),
      ex("jumpingJacks", "bfb2", 3, 70),
      ex("bodyweightSquat", "bfb3", 3, 80),
      ex("highKnees", "bfb4", 3, 70),
      ex("standingPunches", "bfb5", 3, 85),
    ],
  },
  {
    id: "low-impact-sweat",
    title: "Low Impact Sweat",
    category: "Low Impact",
    focusAreas: ["Full Body"],
    level: "Beginner",
    durationMin: 25,
    kcal: 180,
    image: require("@/assets/images/photos/homehero.webp"),
    description:
      "All the sweat, none of the impact. A standing cardio flow that keeps both feet close to the floor and your joints happy.",
    primaryGoals: ["lose-weight"],
    secondaryGoals: ["energy"],
    equipment: [],
    bodyFocus: ["full_body"],
    suitableFor: ["low_impact", "no_jumping", "knee_friendly", "postpartum_friendly"],
    intensity: "moderate",
    exercises: [
      dbEx("FP_March_In_Place", "lis1", 3, 60),
      dbEx("FP_Side_Steps", "lis2", 3, 60),
      dbEx("Bodyweight_Squat", "lis3", 3, 60),
      dbEx("FP_Standing_Knee_Drive", "lis4", 3, 60),
      ex("reverseLunge", "lis5", 3, 60, { name: "Step-Back Lunge" }),
      dbEx("FP_Standing_Punches", "lis6", 3, 60),
      dbEx("FP_Standing_Core_Twist", "lis7", 3, 60),
      dbEx("Childs_Pose", "lis8", 2, 60, {
        name: "Cooldown Stretch",
        image: require("@/assets/exercises/childs-pose.webp"),
      }),
    ],
  },
  {
    id: "no-jumping-fat-burn",
    title: "No Jumping Fat Burn",
    category: "Low Impact",
    focusAreas: ["HIIT", "Full Body"],
    level: "Intermediate",
    durationMin: 25,
    kcal: 200,
    image: require("@/assets/images/photos/hiit.jpg"),
    description:
      "Interval-style training with zero jumps. Push the pace, protect the knees, and finish glowing.",
    primaryGoals: ["lose-weight"],
    secondaryGoals: ["tone"],
    equipment: [],
    bodyFocus: ["full_body"],
    suitableFor: ["no_jumping", "low_impact", "knee_friendly"],
    intensity: "moderate",
    exercises: [
      ex("sideSteps", "njf1", 3, 80),
      ex("bodyweightSquat", "njf2", 3, 80),
      ex("reverseLunge", "njf3", 3, 80),
      ex("standingKneeDrive", "njf4", 3, 80),
      ex("plankShoulderTaps", "njf5", 3, 80),
      ex("standingPunches", "njf6", 3, 80),
    ],
  },
  {
    id: "full-body-cardio-sculpt",
    title: "Full Body Cardio Sculpt",
    category: "Full Body",
    focusAreas: ["HIIT"],
    level: "Intermediate",
    durationMin: 30,
    kcal: 260,
    image: require("@/assets/images/photos/homehero.webp"),
    description:
      "Cardio and sculpting in one session. Bigger movements, a quicker pace, and a full-body burn that earns its name.",
    primaryGoals: ["lose-weight"],
    secondaryGoals: ["tone"],
    equipment: [],
    bodyFocus: ["full_body"],
    suitableFor: [],
    intensity: "high",
    exercises: [
      ex("jumpingJacks", "fbc1", 3, 95),
      ex("bodyweightSquat", "fbc2", 3, 95),
      ex("mountainClimbers", "fbc3", 3, 95),
      ex("reverseLunge", "fbc4", 3, 95),
      ex("highKnees", "fbc5", 3, 95),
      ex("plank", "fbc6", 3, 95),
    ],
  },
  {
    id: "glutes-legs-sculpt",
    title: "Glutes & Legs Sculpt",
    category: "Lower Body (Legs, Glutes)",
    focusAreas: ["Strength"],
    level: "Intermediate",
    durationMin: 30,
    kcal: 220,
    image: require("@/assets/images/photos/strength.jpg"),
    description:
      "A focused lower-body session to shape the glutes and strengthen the legs, finished with a deep glute release.",
    primaryGoals: ["tone"],
    secondaryGoals: ["strength"],
    equipment: ["dumbbells"],
    bodyFocus: ["glutes", "legs"],
    suitableFor: ["low_impact", "no_jumping"],
    intensity: "moderate",
    exercises: [
      ex("gobletSquat", "gls1", 3, 95),
      ex("romanianDeadlift", "gls2", 3, 95),
      ex("reverseLunge", "gls3", 3, 95),
      ex("gluteBridge", "gls4", 3, 95),
      ex("calfRaises", "gls5", 3, 95),
      ex("figureFour", "gls6", 3, 95),
    ],
  },
  {
    id: "booty-burn",
    title: "Booty Burn",
    category: "Lower Body (Legs, Glutes)",
    focusAreas: ["Low Impact"],
    level: "Beginner",
    durationMin: 20,
    kcal: 150,
    image: require("@/assets/images/photos/pilates.jpg"),
    description:
      "Mat-based glute isolation that burns in the best way. Slow, targeted, and entirely joint-friendly.",
    primaryGoals: ["tone"],
    secondaryGoals: [],
    equipment: ["yoga_mat"],
    bodyFocus: ["glutes"],
    suitableFor: ALL_LIMITATIONS,
    intensity: "moderate",
    exercises: [
      ex("gluteBridge", "bb1", 3, 80),
      ex("gluteKickback", "bb2", 3, 80),
      ex("fireHydrant", "bb3", 3, 80),
      ex("clamshell", "bb4", 3, 80),
      ex("figureFour", "bb5", 2, 60),
    ],
  },
  {
    id: "arms-abs-tone",
    title: "Arms & Abs Tone",
    category: "Core/Abs",
    focusAreas: ["Upper Body (Chest, Back, Shoulders, Arms)"],
    level: "Beginner",
    durationMin: 25,
    kcal: 170,
    image: require("@/assets/images/photos/core-define.webp"),
    description:
      "Sculpt the arms and carve the core in one flowing session. Light weights are optional, water bottles work beautifully.",
    primaryGoals: ["tone"],
    secondaryGoals: ["strength"],
    equipment: [],
    bodyFocus: ["arms", "core_abs"],
    suitableFor: ["knee_friendly", "low_impact", "no_jumping"],
    intensity: "moderate",
    exercises: [
      ex("bicepsCurl", "aat1", 3, 80),
      ex("shoulderPress", "aat2", 3, 80),
      ex("armCircles", "aat3", 3, 80),
      ex("plank", "aat4", 3, 80),
      ex("deadBug", "aat5", 3, 80),
      ex("bicycleCrunch", "aat6", 3, 80),
    ],
  },
  {
    id: "pilates-body-flow",
    title: "Pilates Body Flow",
    category: "Pilates",
    focusAreas: ["Full Body", "Low Impact"],
    level: "Beginner",
    durationMin: 30,
    kcal: 180,
    image: require("@/assets/images/photos/pilates.jpg"),
    description:
      "A mat Pilates flow that lengthens as it strengthens. Precise, low-impact movement with the breath leading the way.",
    primaryGoals: ["tone"],
    secondaryGoals: ["flexibility", "wellness"],
    equipment: ["yoga_mat"],
    bodyFocus: ["full_body", "core_abs"],
    suitableFor: ALL_LIMITATIONS,
    intensity: "low",
    exercises: [
      ex("theHundred", "pbf1", 3, 95),
      ex("rollUp", "pbf2", 3, 95),
      ex("singleLegStretch", "pbf3", 3, 95),
      ex("spineStretchForward", "pbf4", 3, 95),
      ex("catCow", "pbf5", 3, 95),
      ex("childsPose", "pbf6", 3, 95),
    ],
  },
  {
    id: "beginner-strength",
    title: "Beginner Strength Builder",
    category: "Strength",
    focusAreas: ["Full Body"],
    level: "Beginner",
    durationMin: 25,
    kcal: 180,
    image: require("@/assets/images/photos/strength.jpg"),
    description:
      "Learn the foundational strength patterns with just your bodyweight. Build confidence before you build load.",
    primaryGoals: ["strength"],
    secondaryGoals: ["tone"],
    equipment: [],
    bodyFocus: ["full_body"],
    suitableFor: ["low_impact", "no_jumping"],
    intensity: "moderate",
    exercises: [
      ex("bodyweightSquat", "bsb1", 3, 95),
      ex("reverseLunge", "bsb2", 3, 95),
      ex("gluteBridge", "bsb3", 3, 95),
      ex("plankShoulderTaps", "bsb4", 3, 95),
      ex("plank", "bsb5", 3, 95),
    ],
  },
  {
    id: "lower-body-power",
    title: "Lower Body Power",
    category: "Strength",
    focusAreas: ["Lower Body (Legs, Glutes)"],
    level: "Advanced",
    durationMin: 35,
    kcal: 300,
    image: require("@/assets/images/photos/strength.jpg"),
    description:
      "Heavy-feeling legs day. Squats, hinges, and explosive jumps to build serious lower-body power.",
    primaryGoals: ["strength"],
    secondaryGoals: ["tone"],
    equipment: ["dumbbells"],
    bodyFocus: ["legs", "glutes"],
    suitableFor: [],
    intensity: "high",
    exercises: [
      ex("gobletSquat", "lbp1", 4, 85),
      ex("romanianDeadlift", "lbp2", 4, 85),
      ex("reverseLunge", "lbp3", 4, 85),
      ex("squatJumps", "lbp4", 4, 85),
      ex("gluteBridge", "lbp5", 4, 85),
      ex("calfRaises", "lbp6", 4, 85),
    ],
  },
  {
    id: "upper-body-strength",
    title: "Upper Body Strength",
    category: "Strength",
    focusAreas: ["Upper Body (Chest, Back, Shoulders, Arms)"],
    level: "Intermediate",
    durationMin: 30,
    kcal: 220,
    image: require("@/assets/images/photos/strength.jpg"),
    description:
      "Presses, rows, and holds to build a strong upper body and the posture that comes with it.",
    primaryGoals: ["strength"],
    secondaryGoals: ["tone"],
    equipment: ["dumbbells"],
    bodyFocus: ["upper_body", "arms"],
    suitableFor: ["knee_friendly", "low_impact", "no_jumping"],
    intensity: "moderate",
    exercises: [
      ex("shoulderPress", "ubs1", 3, 95),
      ex("bentOverRow", "ubs2", 3, 95),
      ex("bicepsCurl", "ubs3", 3, 95),
      ex("tricepsExtension", "ubs4", 3, 95),
      ex("plankShoulderTaps", "ubs5", 3, 95),
      ex("sidePlank", "ubs6", 3, 95),
    ],
  },
  {
    id: "full-body-dumbbell",
    title: "Full Body Dumbbell Strength",
    category: "Strength",
    focusAreas: ["Full Body"],
    level: "Intermediate",
    durationMin: 35,
    kcal: 280,
    image: require("@/assets/images/photos/strength.jpg"),
    description:
      "One pair of dumbbells, every major muscle. A complete strength session built around the big six patterns.",
    primaryGoals: ["strength"],
    secondaryGoals: ["tone", "lose-weight"],
    equipment: ["dumbbells"],
    bodyFocus: ["full_body"],
    suitableFor: ["low_impact", "no_jumping"],
    intensity: "moderate",
    exercises: [
      ex("gobletSquat", "fbd1", 4, 85),
      ex("romanianDeadlift", "fbd2", 4, 85),
      ex("shoulderPress", "fbd3", 4, 85),
      ex("bentOverRow", "fbd4", 4, 85),
      ex("reverseLunge", "fbd5", 4, 85),
      ex("plank", "fbd6", 4, 85),
    ],
  },
  {
    id: "full-body-stretch",
    title: "Full Body Stretch",
    category: "Stretch",
    focusAreas: ["Mobility", "Recovery", "Full Body"],
    level: "Beginner",
    durationMin: 20,
    kcal: 80,
    image: require("@/assets/images/photos/yoga.jpg"),
    description:
      "A head-to-toe stretch session to lengthen tight muscles and leave you feeling loose and light.",
    primaryGoals: ["flexibility"],
    secondaryGoals: ["wellness"],
    equipment: [],
    bodyFocus: ["full_body", "mobility"],
    suitableFor: ALL_LIMITATIONS,
    intensity: "low",
    exercises: [
      ex("forwardFold", "fbs1", 2, 95),
      ex("lowLunge", "fbs2", 2, 95),
      ex("figureFour", "fbs3", 2, 95),
      ex("supineTwist", "fbs4", 2, 95),
      ex("childsPose", "fbs5", 2, 95),
      ex("neckRolls", "fbs6", 2, 95),
    ],
  },
  {
    id: "evening-wind-down",
    title: "Evening Wind Down",
    category: "Recovery",
    focusAreas: ["Stretch", "Yoga"],
    level: "Beginner",
    durationMin: 15,
    kcal: 60,
    image: require("@/assets/images/photos/yoga.jpg"),
    description:
      "A slow, quiet sequence to release the day from your body and settle the mind before rest.",
    primaryGoals: ["wellness"],
    secondaryGoals: ["flexibility"],
    equipment: [],
    bodyFocus: ["full_body", "back_posture"],
    suitableFor: ALL_LIMITATIONS,
    intensity: "low",
    exercises: [
      ex("catCow", "ewd1", 2, 85),
      ex("threadTheNeedle", "ewd2", 2, 85),
      ex("supineTwist", "ewd3", 2, 85),
      ex("figureFour", "ewd4", 2, 85),
      ex("savasana", "ewd5", 1, 170),
    ],
  },
  {
    id: "energy-boost-10",
    title: "10-Minute Energy Boost",
    category: "Full Body",
    focusAreas: ["Low Impact"],
    level: "Beginner",
    durationMin: 10,
    kcal: 90,
    image: require("@/assets/images/photos/homehero.webp"),
    description:
      "Ten minutes to shake off the slump. Quick, gentle movement that wakes the body and lifts your mood.",
    primaryGoals: ["energy"],
    secondaryGoals: ["wellness"],
    equipment: [],
    bodyFocus: ["full_body"],
    suitableFor: ["knee_friendly", "low_impact", "no_jumping"],
    intensity: "moderate",
    exercises: [
      ex("marchInPlace", "eb1", 2, 55),
      ex("standingKneeDrive", "eb2", 2, 55),
      ex("bodyweightSquat", "eb3", 2, 55),
      ex("standingPunches", "eb4", 2, 55),
      ex("catCow", "eb5", 2, 55),
    ],
  },
];

export function getWorkout(id: string): Workout | undefined {
  return WORKOUTS.find((w) => w.id === id);
}

// Finds the local exercise photo for a coach-uploaded video. Matches first by
// the workout + in-workout exercise id (e.g. "reformer-pilates" + "e1"), then
// falls back to a case-insensitive exercise-name match so the right photo is
// chosen even when the upload wasn't linked to a specific workout exercise.
export function findExerciseImage(opts: {
  workoutId?: string | null;
  workoutExerciseId?: string | null;
  name?: string | null;
}): ImageSourcePropType | undefined {
  const { workoutId, workoutExerciseId, name } = opts;

  if (workoutId && workoutExerciseId) {
    const workout = WORKOUTS.find((w) => w.id === workoutId);
    const ex = workout?.exercises.find((e) => e.id === workoutExerciseId);
    if (ex?.image) return ex.image;
  }

  if (workoutExerciseId) {
    for (const w of WORKOUTS) {
      const ex = w.exercises.find((e) => e.id === workoutExerciseId);
      if (ex?.image) return ex.image;
    }
  }

  if (name) {
    const target = name.trim().toLowerCase();
    for (const w of WORKOUTS) {
      const ex = w.exercises.find((e) => e.name.trim().toLowerCase() === target);
      if (ex?.image) return ex.image;
    }
  }

  return undefined;
}
