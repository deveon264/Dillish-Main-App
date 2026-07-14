import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { authorAvatarUri, type CommunityAuthor } from "@/lib/community";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

// Initials from the first one or two words of a name, e.g. "Jane Doe" -> "JD".
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Round author avatar that renders the member's photo, falling back to their
// initials on a soft tint when there's no photo (or it fails to load).
export function Avatar({ author, size = 40 }: { author: CommunityAuthor; size?: number }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const [failed, setFailed] = useState(false);
  const uri = authorAvatarUri(author);
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, dimensions]}
        contentFit="cover"
        onError={() => setFailed(true)}
        transition={120}
      />
    );
  }

  return (
    <View style={[styles.base, styles.fallback, dimensions]}>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.38) }]}>
        {initialsOf(author.name)}
      </Text>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  base: { backgroundColor: colors.accentTint },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.accentBorderSoft,
  },
  initials: { fontFamily: fonts.sansSemibold, color: colors.accentDark },
});
