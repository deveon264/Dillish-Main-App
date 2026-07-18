import React from "react";
import { View, StyleSheet, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { communityPhotoUri } from "@/lib/community";
import type { AppColors } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useColors";

// Twitter-style photo layout for a post: 1 image fills a 4:3 frame; 2, 3, or 4
// images share a 16:9 frame split into halves/quarters with thin gaps and
// rounded outer corners. Pass `onPressImage` (used on the detail screen) to make
// each image tappable; in the feed it's omitted so the card's own press wins.
export function PostPhotoGrid({
  keys,
  onPressImage,
  style,
}: {
  keys: string[];
  onPressImage?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(createStyles);
  const uris = keys.filter(Boolean).slice(0, 4).map((k) => communityPhotoUri(k));
  const n = uris.length;
  if (n === 0) return null;

  const cell = (index: number, cellStyle?: StyleProp<ViewStyle>) => {
    const image = (
      <Image source={{ uri: uris[index] }} style={styles.fill} contentFit="cover" transition={150} />
    );
    if (onPressImage) {
      return (
        <Pressable
          style={[styles.cell, cellStyle]}
          onPress={() => onPressImage(index)}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Photo ${index + 1} of ${n}`}
        >
          {image}
        </Pressable>
      );
    }
    return <View style={[styles.cell, cellStyle]}>{image}</View>;
  };

  const aspectRatio = n === 1 ? 4 / 3 : 16 / 9;

  let content: React.ReactNode;
  if (n === 1) {
    content = cell(0);
  } else if (n === 2) {
    content = (
      <View style={styles.row}>
        {cell(0)}
        {cell(1)}
      </View>
    );
  } else if (n === 3) {
    content = (
      <View style={styles.row}>
        {cell(0)}
        <View style={styles.col}>
          {cell(1)}
          {cell(2)}
        </View>
      </View>
    );
  } else {
    content = (
      <View style={styles.col}>
        <View style={styles.row}>
          {cell(0)}
          {cell(1)}
        </View>
        <View style={styles.row}>
          {cell(2)}
          {cell(3)}
        </View>
      </View>
    );
  }

  return <View style={[styles.container, { aspectRatio }, style]}>{content}</View>;
}

const GAP = 2;

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    width: "100%",
    marginTop: 12,
    borderRadius: colors.radiusSm,
    overflow: "hidden",
    // The gap between images shows through as a thin hairline separator.
    backgroundColor: colors.cardBorder,
  },
  row: { flex: 1, flexDirection: "row", gap: GAP },
  col: { flex: 1, flexDirection: "column", gap: GAP },
  cell: { flex: 1, overflow: "hidden", backgroundColor: colors.blushSurface },
  fill: { width: "100%", height: "100%" },
});
