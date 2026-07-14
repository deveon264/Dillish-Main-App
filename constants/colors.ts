// "Airy Studio" design system — calm off-white surfaces, one rose-pink accent,
// deep-plum ink (never black), serif display numerals, thin-line stats.
export const palette = {
  white: "#FFFFFF",
  cream: "#FDFCFA",
  creamDeep: "#F6F1EC",
  blush: "#FBE7EE",
  petal: "#FDFCFA",
  strawberry: "#E45D87",
  cherry: "#3E2733",
  royal: "#E45D87",
  leaf: "#F08CAD",
  ink: "#3E2733",
  mauve: "rgba(62, 39, 51, 0.45)",
};

// Brand RGB channels, kept in one place so a recolor is a single-line change.
// Every soft/tinted accent shade below is derived from these — never hardcode
// an `rgba(...)` brand tint in a screen or component file.
const accentRgb = "228, 93, 135"; // #E45D87 Primary Pink
const inkRgb = "62, 39, 51"; // #3E2733 Deep Plum ink
const successRgb = "94, 154, 126"; // Soft green
const honeyRgb = "181, 138, 85"; // #B58A55 Gold
const blushRgb = "251, 231, 238"; // #FBE7EE Blush
const waterRgb = "111, 166, 201"; // #6FA6C9 Hydration blue

// Gradient stops keep a fixed tuple length (LinearGradient wants at least two
// stops) but not literal hex types, so the dark palette can reuse the shape.
type Gradient2 = readonly [string, string];
type Gradient3 = readonly [string, string, string];
type Gradient4 = readonly [string, string, string, string];

// Corner radii are part of the layout language, not the theme; both palettes
// spread the same values so `colors.radius` keeps working everywhere.
const metrics = {
  radius: 22,
  radiusLg: 26,
  radiusSm: 16,
};

export const colors = {
  background: "#FDFCFA",
  backgroundDeep: "#F6F1EC",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  cardBorder: `rgba(${inkRgb}, 0.08)`,
  // Frosted-glass tint laid over the native blur in the floating tab bar.
  tabBarGlass: "rgba(255, 255, 255, 0.85)",
  tabBarGlassBorder: `rgba(${inkRgb}, 0.08)`,
  // Unfocused tab icons on the glass bar.
  tabBarInactive: `rgba(${inkRgb}, 0.4)`,
  primary: "#E45D87",
  accent: "#C8446E",
  accentSoft: "#F08CAD",
  // Deep rose — secondary-button text, eyebrow labels, links.
  accentDark: "#C8446E",
  // Soft accent fills — icon circles, badge/chip backgrounds, active states.
  accentTintFaint: `rgba(${accentRgb}, 0.06)`,
  accentTint: "#FBE7EE",
  accentTintMd: `rgba(${accentRgb}, 0.12)`,
  accentTintLg: `rgba(${accentRgb}, 0.16)`,
  accentFill: `rgba(${accentRgb}, 0.25)`,
  accentDeep: `rgba(${accentRgb}, 0.85)`,
  // Accent borders / outlines.
  accentBorderSoft: "rgba(200, 68, 110, 0.25)",
  accentBorder: "rgba(200, 68, 110, 0.30)",
  accentBorderMd: "rgba(200, 68, 110, 0.35)",
  accentBorderLg: "rgba(200, 68, 110, 0.40)",
  // Blush-tinted card fill for selected/pink surfaces.
  blushSurface: "#FDF6F9",
  // Soft success fill — e.g. the progress trend pill, "Normal" BMI badge.
  successTint: `rgba(${successRgb}, 0.13)`,
  // Gold — celebratory highlights: streaks, achievements, protein, badges.
  highlight: "#B58A55",
  highlightTint: "#F3E9DC",
  highlightTintMd: `rgba(${honeyRgb}, 0.24)`,
  highlightBorder: `rgba(${honeyRgb}, 0.35)`,
  // Blush pink — icon chips, pinned badges, premium touches.
  blush: "#FBE7EE",
  blushTint: `rgba(${blushRgb}, 0.5)`,
  blushTintMd: "#FBE7EE",
  blushBorder: "rgba(228, 93, 135, 0.25)",
  foreground: "#3E2733",
  mutedForeground: `rgba(${inkRgb}, 0.45)`,
  muted: `rgba(${inkRgb}, 0.55)`,
  onPrimary: "#FFFFFF",
  // Text/icons on solid pink (primary) fills — the design uses white.
  onPrimaryStrong: "#FFFFFF",
  track: `rgba(${inkRgb}, 0.07)`,
  success: "#4C8268",
  danger: "#D9614F",
  link: "#C8446E",
  protein: "#B58A55",
  carbs: "#8CC5A5",
  fats: "#E45D87",
  // Hydration blue — water tracking everywhere.
  water: "#6FA6C9",
  waterTint: "#E7F0F6",
  waterGradient: ["#A8CBE0", "#6FA6C9"] as Gradient2,
  gradient: ["#F08CAD", "#E45D87"] as Gradient2,
  // Gold gradient — streak pills and other celebratory fills.
  gradientGold: ["#D9A868", "#B58A55"] as Gradient2,
  // Rose-gold gradient — Dillish halo / pinned-post border.
  gradientRoseGold: ["#E45D87", "#D9A868"] as Gradient2,
  // Muted bar track in BarChart.
  barTrackGradient: ["#F3DCE5", "#EFC2D2"] as Gradient2,
  bgGradient: ["#FDFCFA", "#FDFCFA", "#FDFCFA"] as Gradient3,
  // Fade used to scrim the welcome hero down to the app background.
  welcomeScrim: ["rgba(253, 252, 250, 0.5)", "rgba(253, 252, 250, 0.82)", "#FDFCFA"] as Gradient3,
  // Fade laid over the home hero banner so its bottom edge dissolves into the
  // background.
  heroFade: [
    "rgba(253, 252, 250, 0)",
    "rgba(253, 252, 250, 0.35)",
    "rgba(253, 252, 250, 0.85)",
    "#FDFCFA",
  ] as Gradient4,
  // Plum photo-overlay gradients for hero/photo cards.
  photoOverlay: ["rgba(51, 28, 38, 0)", "rgba(51, 28, 38, 0.78)"] as Gradient2,
  // Dimmed backdrop behind centered dialogs and bottom sheets.
  overlay: "rgba(16, 17, 17, 0.45)",
  ...metrics,
};

export type AppColors = typeof colors;
