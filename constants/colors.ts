export const palette = {
  charcoal: "#2C2422",
  charcoalDeep: "#1e1614",
  blush: "#F2D4CC",
  rose: "#C9897A",
  petal: "#F7EBE8",
  mauve: "#9B6E6A",
  cream: "#FAF6F3",
  mist: "#E8DDD9",
};

export const colors = {
  background: "#2C2422",
  backgroundDeep: "#1e1614",
  card: "rgba(255,255,255,0.05)",
  cardElevated: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(247,235,232,0.12)",
  primary: "#C9897A",
  accent: "#F2D4CC",
  foreground: "#F7EBE8",
  mutedForeground: "#9B6E6A",
  muted: "rgba(247,235,232,0.55)",
  onPrimary: "#3A2820",
  track: "rgba(247,235,232,0.10)",
  success: "#8FB69B",
  danger: "#C9897A",
  protein: "#C9897A",
  carbs: "#E2B07F",
  fats: "#9B6E6A",
  gradient: ["#F2D4CC", "#C9897A"] as const,
  bgGradient: ["#2C2422", "#1e1614", "#2C2422"] as const,
  radius: 16,
  radiusLg: 24,
  radiusSm: 12,
};

export type AppColors = typeof colors;
