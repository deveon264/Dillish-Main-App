import { ImageSourcePropType } from "react-native";

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
    level: "Beginner",
    durationMin: 25,
    kcal: 150,
    image: require("@/assets/images/photos/yoga.jpg"),
    description:
      "Wake the body gently with grounding stretches and mindful breath to set a calm, intentional tone for your day.",
    featured: true,
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
    level: "Intermediate",
    durationMin: 35,
    kcal: 280,
    image: require("@/assets/images/photos/strength.jpg"),
    description:
      "Sculpt and tone head to toe with a balanced strength circuit using light weights and bodyweight control.",
    featured: true,
    exercises: [
      {
        id: "s1",
        image: require("@/assets/exercises/goblet-squat.webp"),
        name: "Goblet Squat",
        detail: "Lower body",
        description:
          "A lower-body strength move that builds the legs and glutes while teaching upright posture. Drive through the heels to stand.",
        cues: [
          "Hold a weight at the chest and stand shoulder-width apart.",
          "Sit the hips back and down, keeping the chest tall.",
          "Press through the heels to return to standing.",
        ],
        modifications: "Reduce the depth or go bodyweight if the knees complain.",
        sets: 4,
        seconds: 50,
      },
      {
        id: "s2",
        image: require("@/assets/exercises/romanian-deadlift.webp"),
        name: "Romanian Deadlift",
        detail: "Hamstrings & glutes",
        description:
          "A hip-hinge movement that strengthens the hamstrings and glutes. Lead with the hips, not the back.",
        cues: [
          "Hold the weights in front with a soft bend in the knees.",
          "Hinge at the hips and slide the weights down the legs.",
          "Squeeze the glutes to return to standing tall.",
        ],
        modifications: "Use lighter weight and shorten the range to protect the back.",
        sets: 4,
        seconds: 50,
      },
      {
        id: "s3",
        image: require("@/assets/exercises/shoulder-press.webp"),
        name: "Shoulder Press",
        detail: "Upper body",
        description:
          "An upper-body press that builds the shoulders and arms. Brace the core to protect the spine.",
        cues: [
          "Hold the weights at shoulder height, elbows bent.",
          "Press the weights overhead until the arms are straight.",
          "Lower with control back to the shoulders.",
        ],
        modifications: "Press one arm at a time or sit down for more stability.",
        sets: 3,
        seconds: 45,
      },
      {
        id: "s4",
        image: require("@/assets/exercises/reverse-lunge.webp"),
        name: "Reverse Lunge",
        detail: "Legs & balance",
        description:
          "A single-leg movement that builds the legs and challenges balance. Step back with control.",
        cues: [
          "Step one foot back and lower into a lunge.",
          "Keep the front knee stacked over the ankle.",
          "Drive through the front heel to return.",
        ],
        modifications: "Hold onto a wall or chair for balance support.",
        sets: 3,
        seconds: 60,
      },
      {
        id: "s5",
        image: require("@/assets/exercises/bent-over-row.webp"),
        name: "Bent Over Row",
        detail: "Back",
        description:
          "A pulling exercise that strengthens the back and improves posture. Squeeze the shoulder blades together.",
        cues: [
          "Hinge forward with a flat back and weights hanging down.",
          "Pull the weights toward the ribs, leading with the elbows.",
          "Lower with control and keep the core engaged.",
        ],
        modifications: "Support one hand on a bench and row one arm at a time.",
        sets: 4,
        seconds: 50,
      },
      {
        id: "s6",
        image: require("@/assets/exercises/glute-bridge.webp"),
        name: "Glute Bridge",
        detail: "Glutes",
        description:
          "A glute-focused move that strengthens the hips and supports the lower back. Pause and squeeze at the top.",
        cues: [
          "Lie on the back with knees bent and feet flat.",
          "Press through the heels to lift the hips high.",
          "Squeeze the glutes at the top, then lower slowly.",
        ],
        modifications: "Add a pause or remove weight to suit your level.",
        sets: 3,
        seconds: 50,
      },
      {
        id: "s7",
        image: require("@/assets/exercises/plank.webp"),
        name: "Plank",
        detail: "Core",
        description:
          "A core stabilizer that builds full-body tension and endurance. Keep a long line from head to heels.",
        cues: [
          "Set the forearms or hands under the shoulders.",
          "Brace the core and squeeze the glutes.",
          "Keep the hips level, avoiding sag or pike.",
        ],
        modifications: "Drop to the knees to reduce the load.",
        sets: 3,
        seconds: 45,
      },
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
    level: "Beginner",
    durationMin: 18,
    kcal: 90,
    image: require("@/assets/images/photos/yoga.jpg"),
    description:
      "A restorative stretch sequence to release tension, improve mobility, and unwind after a long day.",
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
    level: "Intermediate",
    durationMin: 15,
    kcal: 120,
    image: require("@/assets/images/photos/strength.jpg"),
    description:
      "A focused core session to build deep abdominal strength and a stable, supported midline.",
    exercises: [
      {
        id: "c1",
        image: require("@/assets/exercises/dead-bug.webp"),
        name: "Dead Bug",
        detail: "Stability",
        description:
          "A core stability exercise that teaches control and protects the spine. Press the low back into the floor.",
        cues: [
          "Lie on the back with arms and knees lifted to tabletop.",
          "Lower the opposite arm and leg slowly.",
          "Keep the low back pressed down the whole time.",
        ],
        modifications: "Move only the legs or only the arms to start.",
        sets: 3,
        seconds: 45,
      },
      {
        id: "c2",
        image: require("@/assets/exercises/bicycle-crunch.webp"),
        name: "Bicycle Crunch",
        detail: "Obliques",
        description:
          "An oblique-focused crunch that builds rotational core strength. Rotate from the ribs, not the elbows.",
        cues: [
          "Lift the head and shoulders with hands behind the head.",
          "Bring one elbow toward the opposite knee.",
          "Switch sides smoothly in a pedaling motion.",
        ],
        modifications: "Slow the tempo and keep the feet higher.",
        sets: 3,
        seconds: 45,
      },
      {
        id: "c3",
        image: require("@/assets/exercises/hollow-hold.webp"),
        name: "Hollow Hold",
        detail: "Deep core",
        description:
          "An isometric hold that builds deep core tension. Keep the lower back glued to the floor.",
        cues: [
          "Lie down and lift the legs and shoulders off the mat.",
          "Reach the arms overhead and create a long, shallow curve.",
          "Press the lower back down and hold steady.",
        ],
        modifications: "Bend the knees or tuck to shorten the lever.",
        sets: 3,
        seconds: 40,
      },
      {
        id: "c4",
        image: require("@/assets/exercises/side-plank.webp"),
        name: "Side Plank",
        detail: "Obliques",
        description:
          "A lateral core and hip stabilizer. Stack the hips and lift them high.",
        cues: [
          "Stack the feet and prop up on one forearm.",
          "Lift the hips into a straight line.",
          "Keep the top shoulder stacked over the bottom.",
        ],
        modifications: "Drop the bottom knee for a supported version.",
        sets: 3,
        seconds: 45,
      },
      {
        id: "c5",
        image: require("@/assets/exercises/leg-lowers.webp"),
        name: "Leg Lowers",
        detail: "Lower abs",
        description:
          "A lower-ab exercise that builds control through the pelvis. Control the descent and keep the back flat.",
        cues: [
          "Lie on the back with the legs lifted to the ceiling.",
          "Lower the legs slowly toward the floor.",
          "Stop before the back arches and lift again.",
        ],
        modifications: "Bend the knees or lower one leg at a time.",
        sets: 3,
        seconds: 45,
      },
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
