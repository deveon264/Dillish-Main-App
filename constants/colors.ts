export const palette = {
  white: "#FBF6F0",
  cream: "#EFE3D7",
  creamDeep: "#E0CFBF",
  blush: "#F3C7C2",
  petal: "#FBF6F0",
  strawberry: "#DD8DA0",
  cherry: "#4A2E33",
  royal: "#DD8DA0",
  leaf: "#EBB1C0",
  ink: "#4A2E33",
  mauve: "#8A6F66",
};

// Brand RGB channels, kept in one place so a recolor is a single-line change.
// Every soft/tinted accent shade below is derived from these — never hardcode
// an `rgba(...)` brand tint in a screen or component file.
const accentRgb = "221, 141, 160"; // #DD8DA0 Rose Pink
const successRgb = "127, 163, 124"; // #7FA37C Soft Sage
const honeyRgb = "194, 146, 94"; // #C2925E Warm Honey Wood
const blushRgb = "243, 199, 194"; // #F3C7C2 Soft Pink Blush
const creamRgb = "239, 227, 215"; // #EFE3D7 Warm Cream
const surfaceRgb = "251, 246, 240"; // #FBF6F0 Warm off-white surface

export const colors = {
  background: "#EFE3D7",
  backgroundDeep: "#E0CFBF",
  card: "#FBF6F0",
  cardElevated: "#FBF6F0",
  cardBorder: `rgba(${accentRgb}, 0.16)`,
  // Frosted-glass tint laid over the native blur in the floating tab bar.
  // Translucent so content shows through; brighter highlight for the top edge.
  tabBarGlass: `rgba(${surfaceRgb}, 0.62)`,
  tabBarGlassBorder: `rgba(${surfaceRgb}, 0.75)`,
  primary: "#DD8DA0",
  accent: "#DD8DA0",
  accentSoft: "#EBB1C0",
  // Deep rose — secondary-button text on light surfaces.
  accentDark: "#9E4E61",
  // Soft accent fills — icon circles, badge/chip backgrounds, active states.
  accentTintFaint: `rgba(${accentRgb}, 0.08)`,
  accentTint: `rgba(${accentRgb}, 0.10)`,
  accentTintMd: `rgba(${accentRgb}, 0.12)`,
  accentTintLg: `rgba(${accentRgb}, 0.14)`,
  accentFill: `rgba(${accentRgb}, 0.25)`,
  accentDeep: `rgba(${accentRgb}, 0.85)`,
  // Accent borders / outlines.
  accentBorderSoft: `rgba(${accentRgb}, 0.20)`,
  accentBorder: `rgba(${accentRgb}, 0.22)`,
  accentBorderMd: `rgba(${accentRgb}, 0.28)`,
  accentBorderLg: `rgba(${accentRgb}, 0.30)`,
  // Soft success fill — e.g. the progress trend pill.
  successTint: `rgba(${successRgb}, 0.16)`,
  // Warm honey wood — celebratory highlights: streaks, achievements,
  // calories burned, badges. Accent on light surfaces, never a full wash.
  highlight: "#C2925E",
  highlightTint: `rgba(${honeyRgb}, 0.14)`,
  highlightTintMd: `rgba(${honeyRgb}, 0.20)`,
  highlightBorder: `rgba(${honeyRgb}, 0.32)`,
  // Soft pink blush — feminine warmth, used sparingly: onboarding accents,
  // empty states, premium touches.
  blush: "#F3C7C2",
  blushTint: `rgba(${blushRgb}, 0.22)`,
  blushTintMd: `rgba(${blushRgb}, 0.38)`,
  blushBorder: `rgba(${blushRgb}, 0.50)`,
  foreground: "#4A2E33",
  mutedForeground: "#8A6F66",
  muted: "rgba(74, 46, 51, 0.55)",
  onPrimary: "#FFFFFF",
  // Dark text/icons for solid pink (primary) buttons — white sits at only
  // ~2.5:1 on the rose fill, this deep ink reaches ~4.85:1 (AA) without
  // touching the brand pink itself.
  onPrimaryStrong: "#4A2E33",
  track: "#E0CFBF",
  success: "#7FA37C",
  danger: "#D9614F",
  link: "#DD8DA0",
  protein: "#DD8DA0",
  carbs: "#C2925E",
  fats: "#D9614F",
  gradient: ["#EBB1C0", "#DD8DA0"] as const,
  // Warm honey-wood gradient — streak pills and other celebratory fills.
  gradientGold: ["#D9B07A", "#C2925E"] as const,
  // Muted warm-sand gradient — the "not reached" bar in BarChart.
  barTrackGradient: ["#E0CFBF", "#D2BBA8"] as const,
  bgGradient: ["#EFE3D7", "#FAF4EE", "#EFE3D7"] as const,
  // Cream fade used to scrim the welcome hero down to the cream background.
  welcomeScrim: [`rgba(${creamRgb}, 0.5)`, `rgba(${creamRgb}, 0.82)`, "#EFE3D7"] as const,
  radius: 16,
  radiusLg: 24,
  radiusSm: 12,
};

export type AppColors = typeof colors;
