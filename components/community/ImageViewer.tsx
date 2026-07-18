import React, { useEffect, useState } from "react";
import { Modal, View, StyleSheet, FlatList, useWindowDimensions } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { communityPhotoUri } from "@/lib/community";
import type { AppColors } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useColors";
import { useInsets } from "@/hooks/useInsets";

// Lightweight fullscreen photo viewer for a post's images: a horizontally-paged
// list opened at the tapped index, with a close button and page dots. Rendered
// on the post detail screen. Pinch-zoom is intentionally out of scope for now.
export function ImageViewer({
  keys,
  index,
  onClose,
}: {
  keys: string[];
  index: number | null;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(index ?? 0);
  const uris = keys.filter(Boolean).map(communityPhotoUri);
  const visible = index != null && uris.length > 0;

  useEffect(() => {
    if (index != null) setPage(index);
  }, [index]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <FlatList
          // Remount per opening so initialScrollIndex lands on the tapped image.
          key={index ?? 0}
          style={styles.list}
          data={uris}
          keyExtractor={(u, i) => `${u}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={[styles.page, { width, height }]}>
              <Image source={{ uri: item }} style={styles.image} contentFit="contain" transition={120} />
            </View>
          )}
        />
        <Pressable onPress={onClose} hitSlop={10} style={[styles.close, { top: insets.top + 8 }]} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        {uris.length > 1 ? (
          <View style={[styles.dots, { bottom: insets.bottom + 20 }]}>
            {uris.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const createStyles = (_colors: AppColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)" },
  list: { flex: 1 },
  page: { alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  close: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  dots: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: "#fff", width: 7, height: 7, borderRadius: 3.5 },
});
