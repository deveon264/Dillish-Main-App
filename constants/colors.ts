export const palette = {
  white: "#FFFFFF",
  cream: "#F2F3EF",
  creamDeep: "#E8ECE0",
  blush: "#AFBCA1",
  petal: "#FFFFFF",
  strawberry: "#525B4A",
  cherry: "#2D312E",
  royal: "#525B4A",
  leaf: "#6F9E2E",
  ink: "#2D312E",
  mauve: "#5A6352",
};

// Brand RGB channels, kept in one place so a recolor is a single-line change.
// Every soft/tinted accent shade below is derived from these — never hardcode
// an `rgba(...)` brand tint in a screen or component file.
const accentRgb = "82, 91, 74"; // #525B4A
const successRgb = "94, 140, 36"; // #5E8C24

export const colors = {
  background: "#F2F3EF",
  backgroundDeep: "#E8ECE0",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  cardBorder: "rgba(45,49,46,0.14)",
  primary: "#525B4A",
  accent: "#525B4A",
  accentSoft: "#AFBCA1",
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
  foreground: "#2D312E",
  mutedForeground: "#5A6352",
  muted: "rgba(45,49,46,0.55)",
  onPrimary: "#FFFFFF",
  track: "rgba(45,49,46,0.10)",
  success: "#5E8C24",
  danger: "#B23A2E",
  link: "#525B4A",
  protein: "#525B4A",
  carbs: "#7F8C6E",
  fats: "#A9C06B",
  gradient: ["#8FA06B", "#525B4A"] as const,
  bgGradient: ["#F2F3EF", "#FFFFFF", "#F2F3EF"] as const,
  radius: 16,
  radiusLg: 24,
  radiusSm: 12,
};

export type AppColors = typeof colors;
