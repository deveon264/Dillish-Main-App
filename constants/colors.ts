export const palette = {
  white: "#FFFFFF",
  cream: "#F6F0DC",
  creamDeep: "#E8D8B8",
  blush: "#F3B7A8",
  petal: "#FFFFFF",
  strawberry: "#5E8F2E",
  cherry: "#17245A",
  royal: "#5E8F2E",
  leaf: "#7FAE45",
  ink: "#17245A",
  mauve: "#776B58",
};

// Brand RGB channels, kept in one place so a recolor is a single-line change.
// Every soft/tinted accent shade below is derived from these — never hardcode
// an `rgba(...)` brand tint in a screen or component file.
const accentRgb = "94, 143, 46"; // #5E8F2E Botanical Green
const successRgb = "94, 143, 46"; // #5E8F2E Botanical Green
const goldRgb = "217, 150, 36"; // #D99624 Warm Honey Gold
const blushRgb = "243, 183, 168"; // #F3B7A8 Soft Peach Blush
const creamRgb = "246, 240, 220"; // #F6F0DC Vanilla Cream

export const colors = {
  background: "#F6F0DC",
  backgroundDeep: "#E8D8B8",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  cardBorder: `rgba(${accentRgb}, 0.16)`,
  primary: "#5E8F2E",
  accent: "#5E8F2E",
  accentSoft: "#7FAE45",
  // Deep leaf green — secondary-button text on light surfaces.
  accentDark: "#2F5F22",
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
  // Warm honey gold — celebratory highlights: streaks, achievements,
  // calories burned, badges. Accent on light surfaces, never a full wash.
  highlight: "#D99624",
  highlightTint: `rgba(${goldRgb}, 0.14)`,
  highlightTintMd: `rgba(${goldRgb}, 0.20)`,
  highlightBorder: `rgba(${goldRgb}, 0.32)`,
  // Soft peach blush — feminine warmth, used sparingly: onboarding accents,
  // empty states, premium touches.
  blush: "#F3B7A8",
  blushTint: `rgba(${blushRgb}, 0.22)`,
  blushTintMd: `rgba(${blushRgb}, 0.38)`,
  blushBorder: `rgba(${blushRgb}, 0.50)`,
  foreground: "#17245A",
  mutedForeground: "#776B58",
  muted: "rgba(119,107,88,0.62)",
  onPrimary: "#FFFFFF",
  track: "#E8D8B8",
  success: "#5E8F2E",
  danger: "#D96B5F",
  link: "#5E8F2E",
  protein: "#5E8F2E",
  carbs: "#D99624",
  fats: "#D96B5F",
  gradient: ["#7FAE45", "#5E8F2E"] as const,
  // Warm honey-gold gradient — streak pills and other celebratory fills.
  gradientGold: ["#E8B14A", "#D99624"] as const,
  // Muted soft-oat gradient — the "not reached" bar in BarChart.
  barTrackGradient: ["#E8D8B8", "#C9B98E"] as const,
  bgGradient: ["#F6F0DC", "#FFFFFF", "#F6F0DC"] as const,
  // Cream fade used to scrim the welcome hero down to the cream background.
  welcomeScrim: [`rgba(${creamRgb}, 0.5)`, `rgba(${creamRgb}, 0.82)`, "#F6F0DC"] as const,
  radius: 16,
  radiusLg: 24,
  radiusSm: 12,
};

export type AppColors = typeof colors;
