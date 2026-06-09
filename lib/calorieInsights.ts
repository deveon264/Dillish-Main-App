// The Ionicons glyphs this module references. Kept as a local union (rather
// than importing the icon font) so the engine stays a pure, dependency-free
// module: instant, offline, and testable in plain Node. Every name here is a
// valid Ionicons glyph, so it is assignable to the icon component's `name` prop
// at the call site.
type IoniconName = "fish" | "restaurant" | "nutrition" | "leaf" | "egg";

export type Macro = "protein" | "carbs" | "fats";

// One word, displayed inside the insight message (e.g. "12g of protein").
const MACRO_LABEL: Record<Macro, string> = {
  protein: "protein",
  carbs: "carbs",
  fats: "fats",
};

// A food idea. `protein`/`carbs`/`fats` are the grams that one sensible serving
// adds, so the chip can show the contribution for whichever macro we feature.
type Food = {
  name: string;
  icon: IoniconName;
  protein: number;
  carbs: number;
  fats: number;
};

// Curated pools, grouped by the macro each food is richest in. Kept small and
// recognizable, with realistic per-serving macro grams.
const PROTEIN_FOODS: Food[] = [
  { name: "Salmon", icon: "fish", protein: 35, carbs: 0, fats: 13 },
  { name: "Chicken", icon: "restaurant", protein: 31, carbs: 0, fats: 4 },
  { name: "Greek yogurt", icon: "nutrition", protein: 17, carbs: 9, fats: 0 },
  { name: "Lentil soup", icon: "restaurant", protein: 18, carbs: 30, fats: 1 },
  { name: "Tofu bowl", icon: "restaurant", protein: 20, carbs: 12, fats: 11 },
  { name: "Cottage cheese", icon: "nutrition", protein: 14, carbs: 5, fats: 2 },
  { name: "Edamame", icon: "leaf", protein: 17, carbs: 14, fats: 8 },
  { name: "Two eggs", icon: "egg", protein: 12, carbs: 1, fats: 10 },
  { name: "Black beans", icon: "nutrition", protein: 15, carbs: 41, fats: 1 },
  { name: "Tuna", icon: "fish", protein: 26, carbs: 8, fats: 2 },
];

const CARB_FOODS: Food[] = [
  { name: "Oatmeal", icon: "nutrition", protein: 6, carbs: 27, fats: 3 },
  { name: "Brown rice", icon: "restaurant", protein: 5, carbs: 45, fats: 2 },
  { name: "Sweet potato", icon: "nutrition", protein: 2, carbs: 27, fats: 0 },
  { name: "Banana", icon: "nutrition", protein: 1, carbs: 27, fats: 0 },
  { name: "Toast", icon: "restaurant", protein: 4, carbs: 24, fats: 1 },
  { name: "Quinoa", icon: "restaurant", protein: 8, carbs: 39, fats: 4 },
  { name: "Granola", icon: "nutrition", protein: 5, carbs: 32, fats: 4 },
  { name: "Apple", icon: "nutrition", protein: 0, carbs: 25, fats: 0 },
];

const FAT_FOODS: Food[] = [
  { name: "Avocado", icon: "leaf", protein: 2, carbs: 9, fats: 15 },
  { name: "Almonds", icon: "nutrition", protein: 6, carbs: 6, fats: 14 },
  { name: "Peanut butter", icon: "nutrition", protein: 7, carbs: 6, fats: 16 },
  { name: "Walnuts", icon: "nutrition", protein: 4, carbs: 4, fats: 18 },
  { name: "Chia pudding", icon: "nutrition", protein: 5, carbs: 13, fats: 9 },
  { name: "Olive oil", icon: "nutrition", protein: 0, carbs: 0, fats: 14 },
];

// Light, naturally low-calorie options. Used when the day is already over the
// calorie goal or fully met, so any extra bite still stays gentle.
const LIGHT_FOODS: Food[] = [
  { name: "Greek yogurt", icon: "nutrition", protein: 17, carbs: 9, fats: 0 },
  { name: "Cottage cheese", icon: "nutrition", protein: 14, carbs: 5, fats: 2 },
  { name: "Edamame", icon: "leaf", protein: 17, carbs: 14, fats: 8 },
  { name: "Boiled egg", icon: "egg", protein: 6, carbs: 1, fats: 5 },
  { name: "Berries", icon: "nutrition", protein: 1, carbs: 17, fats: 0 },
];

const POOL_BY_MACRO: Record<Macro, Food[]> = {
  protein: PROTEIN_FOODS,
  carbs: CARB_FOODS,
  fats: FAT_FOODS,
};

// A piece of message text; `strong` parts are emphasized in the UI.
export type InsightSegment = { text: string; strong?: boolean };

export type InsightChip = {
  name: string;
  icon: IoniconName;
  // Grams of the featured macro this serving adds.
  value: number;
};

export type CalorieInsight = {
  // Stable id for the chosen template, handy for keys and tests.
  category: string;
  segments: InsightSegment[];
  // The macro the chips quantify (so the UI can color them to match).
  featuredMacro: Macro;
  chips: InsightChip[];
};

export type InsightInput = {
  totals: { kcal: number; protein: number; carbs: number; fats: number };
  goals: { kcal: number; protein: number; carbs: number; fats: number };
  // Rotation seed so repeated day-states still surface different copy and
  // foods. Defaults to the day of the year (changes once per day).
  seed?: number;
};

// Deterministically pick two distinct foods from a pool, varied by the seed.
// Indices are normalized so any integer seed (including negatives) stays in
// range and the two picks never collide.
function pickTwo(pool: Food[], seed: number): Food[] {
  const n = pool.length;
  if (n === 0) return [];
  if (n === 1) return [pool[0]];
  const a = ((seed % n) + n) % n;
  const step = ((((seed % (n - 1)) + (n - 1)) % (n - 1)) + 1) % n; // 1..n-1
  const b = (a + step) % n;
  return [pool[a], pool[b]];
}

function pickOne<T>(arr: T[], seed: number): T {
  return arr[(((seed % arr.length) + arr.length) % arr.length)];
}

function chipsFor(pool: Food[], macro: Macro, seed: number): InsightChip[] {
  return pickTwo(pool, seed).map((f) => ({
    name: f.name,
    icon: f.icon,
    value: f[macro],
  }));
}

// Day of the year, 1..366. Used as the default rotation seed.
export function dayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/**
 * Pick a tip and two matching food ideas from the day's logged totals. Pure and
 * instant: no network, no AI. The same inputs always yield the same result, and
 * the seed rotates the copy and foods day to day.
 */
export function getCalorieInsight(input: InsightInput): CalorieInsight {
  const { totals, goals } = input;
  const seed = input.seed ?? dayOfYear();

  const leftProtein = Math.max(0, goals.protein - totals.protein);
  const leftCarbs = Math.max(0, goals.carbs - totals.carbs);
  const leftFats = Math.max(0, goals.fats - totals.fats);
  const leftKcal = Math.max(0, goals.kcal - totals.kcal);
  const overKcal = totals.kcal - goals.kcal;
  const nothingLogged = totals.kcal <= 0;

  // Empty day: nothing logged yet.
  if (nothingLogged) {
    const templates: InsightSegment[][] = [
      [{ text: "Fresh start. Log your first meal and watch your day take shape." }],
      [{ text: "Your day is a blank page. A balanced first meal sets the tone." }],
      [{ text: "Ready when you are. Add a meal to start tracking today." }],
    ];
    return {
      category: "start",
      segments: pickOne(templates, seed),
      featuredMacro: "protein",
      chips: chipsFor(PROTEIN_FOODS, "protein", seed),
    };
  }

  // Over the calorie goal: keep any extra light, lean on protein.
  if (overKcal > 0) {
    const over = Math.round(overKcal);
    const templates: InsightSegment[][] = [
      [
        { text: "You are about " },
        { text: `${over} kcal`, strong: true },
        { text: " over your goal. A short walk or some water helps you feel your best." },
      ],
      [
        { text: "A little past your goal today, by " },
        { text: `${over} kcal`, strong: true },
        { text: ". If you are still hungry, lean on light protein." },
      ],
      [
        { text: "Over by " },
        { text: `${over} kcal`, strong: true },
        { text: ". No stress, tomorrow is a clean slate. Keep extras light tonight." },
      ],
    ];
    return {
      category: "over",
      segments: pickOne(templates, seed),
      featuredMacro: "protein",
      chips: chipsFor(LIGHT_FOODS, "protein", seed),
    };
  }

  // All macro goals met (and within calories): a balanced, positive day.
  if (leftProtein === 0 && leftCarbs === 0 && leftFats === 0) {
    const templates: InsightSegment[][] = [
      [{ text: "Beautifully balanced. You have met your protein, carbs, and fats today." }],
      [{ text: "Every macro goal hit. This is exactly what a balanced day looks like." }],
      [{ text: "Right on target across the board. A light snack later if you want one." }],
    ];
    return {
      category: "balanced",
      segments: pickOne(templates, seed),
      featuredMacro: "protein",
      chips: chipsFor(LIGHT_FOODS, "protein", seed),
    };
  }

  // Otherwise feature the macro with the largest gap, measured as a share of
  // its goal so it scales fairly across the three macros.
  const gapList: { macro: Macro; left: number; pct: number }[] = [
    { macro: "protein", left: leftProtein, pct: goals.protein > 0 ? leftProtein / goals.protein : 0 },
    { macro: "carbs", left: leftCarbs, pct: goals.carbs > 0 ? leftCarbs / goals.carbs : 0 },
    { macro: "fats", left: leftFats, pct: goals.fats > 0 ? leftFats / goals.fats : 0 },
  ];
  const gaps = gapList.filter((g) => g.left > 0);

  gaps.sort((a, b) => b.pct - a.pct);
  const top = gaps[0];
  const macro = top.macro;
  const left = Math.round(top.left);
  const label = MACRO_LABEL[macro];

  const kcalNote =
    leftKcal > 50
      ? `You have about ${Math.round(leftKcal)} kcal left to work with.`
      : "You are right near your calorie goal, so keep it light.";

  const templates: InsightSegment[][] = [
    [
      { text: "You are doing great. About " },
      { text: `${left}g of ${label}`, strong: true },
      { text: ` left to reach today's goal. ${kcalNote}` },
    ],
    [
      { text: "Just " },
      { text: `${left}g of ${label}`, strong: true },
      { text: ` to go. ${kcalNote}` },
    ],
    [
      { text: "A little more " },
      { text: label, strong: true },
      { text: ` rounds out your day, about ${left}g to go. ${kcalNote}` },
    ],
  ];

  return {
    category: `macro-${macro}`,
    segments: pickOne(templates, seed),
    featuredMacro: macro,
    chips: chipsFor(POOL_BY_MACRO[macro], macro, seed),
  };
}
