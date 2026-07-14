import { Ionicons } from "@expo/vector-icons";
import type { PostType } from "@/lib/community";

// Shared label + icon for each post type, used by the feed filter chips, the
// post cards, and the compose type selector so they always agree.
export const POST_TYPE_META: Record<
  PostType,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  progress: { label: "Progress", icon: "trending-up-outline" },
  meal: { label: "Meal", icon: "restaurant-outline" },
  tip: { label: "Tip", icon: "bulb-outline" },
  motivation: { label: "Motivation", icon: "sparkles-outline" },
};

// Airy Studio category badge tints — each post type gets its own soft fill.
export const POST_TYPE_TINT: Record<PostType, { bg: string; fg: string }> = {
  progress: { bg: "#EAF3ED", fg: "#4C8268" },
  meal: { bg: "#FBE7EE", fg: "#C8446E" },
  tip: { bg: "#E7F0F6", fg: "#5D8CAB" },
  motivation: { bg: "#F3E9DC", fg: "#9A7440" },
};
