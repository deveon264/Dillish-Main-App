import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SkeletonBlock, SkeletonGroup } from "@/components/Skeleton";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { useInsets } from "@/hooks/useInsets";

export function AppShellSkeleton() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 20 }]}>
      <SkeletonGroup label="Loading Florish" style={styles.shell}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBlock style={styles.eyebrow} />
            <SkeletonBlock style={styles.heading} />
          </View>
          <SkeletonBlock style={styles.avatar} />
        </View>
        <SkeletonBlock style={styles.hero} />
        <View style={styles.twoCol}>
          <SkeletonBlock style={styles.halfCard} />
          <SkeletonBlock style={styles.halfCard} />
        </View>
        <SkeletonBlock style={styles.wideCard} />
        <SkeletonBlock style={styles.tabBar} />
      </SkeletonGroup>
    </View>
  );
}

export function ListRowsSkeleton({
  rows = 4,
  label = "Loading list",
  style,
}: {
  rows?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <SkeletonGroup label={label} style={[styles.list, style]}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.listRow}>
          <SkeletonBlock style={styles.thumb} />
          <View style={styles.lines}>
            <SkeletonBlock style={styles.lineShort} />
            <SkeletonBlock style={styles.lineLong} />
            <SkeletonBlock style={styles.lineMid} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

export function CommunityFeedSkeleton({ topPadding = 20 }: { topPadding?: number }) {
  const styles = useThemedStyles(createStyles);
  return (
    <SkeletonGroup label="Loading community feed" style={[styles.feed, { paddingTop: topPadding }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBlock style={styles.eyebrow} />
          <SkeletonBlock style={styles.heading} />
        </View>
        <SkeletonBlock style={styles.avatar} />
      </View>
      <SkeletonBlock style={styles.composer} />
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.postCard}>
          <View style={styles.postHead}>
            <SkeletonBlock style={styles.postAvatar} />
            <View style={styles.lines}>
              <SkeletonBlock style={styles.lineMid} />
              <SkeletonBlock style={styles.lineShort} />
            </View>
          </View>
          <SkeletonBlock style={styles.postLine} />
          <SkeletonBlock style={styles.postLineShort} />
          {index === 0 ? <SkeletonBlock style={styles.postMedia} /> : null}
        </View>
      ))}
    </SkeletonGroup>
  );
}

export function PostDetailSkeleton() {
  const styles = useThemedStyles(createStyles);
  return (
    <SkeletonGroup label="Loading post and comments" style={styles.detail}>
      <View style={styles.postHead}>
        <SkeletonBlock style={styles.postAvatar} />
        <View style={styles.lines}>
          <SkeletonBlock style={styles.lineMid} />
          <SkeletonBlock style={styles.lineShort} />
        </View>
      </View>
      <SkeletonBlock style={styles.detailLine} />
      <SkeletonBlock style={styles.detailLineShort} />
      <SkeletonBlock style={styles.detailMedia} />
      <View style={styles.detailDivider} />
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.commentRow}>
          <SkeletonBlock style={styles.commentAvatar} />
          <SkeletonBlock style={styles.commentBubble} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

export function FormSkeleton() {
  const styles = useThemedStyles(createStyles);
  return (
    <SkeletonGroup label="Loading form" style={styles.form}>
      <SkeletonBlock style={styles.formLabel} />
      <View style={styles.chipRow}>
        <SkeletonBlock style={styles.chip} />
        <SkeletonBlock style={styles.chip} />
        <SkeletonBlock style={styles.chip} />
      </View>
      <SkeletonBlock style={[styles.formLabel, { marginTop: 24 }]} />
      <SkeletonBlock style={styles.textArea} />
      <SkeletonBlock style={styles.photoSlot} />
      <SkeletonBlock style={styles.formButton} />
    </SkeletonGroup>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1 },
  shell: { flex: 1, paddingHorizontal: 24, gap: 18 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  eyebrow: { width: 86, height: 10, borderRadius: 5 },
  heading: { width: 190, height: 34, borderRadius: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  hero: { height: 220, borderRadius: colors.radiusLg },
  twoCol: { flexDirection: "row", gap: 12 },
  halfCard: { flex: 1, height: 120, borderRadius: colors.radius },
  wideCard: { height: 104, borderRadius: colors.radius },
  tabBar: { position: "absolute", left: 24, right: 24, bottom: 18, height: 64, borderRadius: 32 },
  list: { gap: 12, marginTop: 20 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    padding: 14,
  },
  thumb: { width: 56, height: 56, borderRadius: 16 },
  lines: { flex: 1, gap: 8 },
  lineShort: { width: "32%", height: 9, borderRadius: 5 },
  lineMid: { width: "58%", height: 11, borderRadius: 6 },
  lineLong: { width: "82%", height: 15, borderRadius: 7 },
  feed: { flex: 1, paddingHorizontal: 20, gap: 14 },
  composer: { height: 72, borderRadius: colors.radius },
  postCard: {
    gap: 12,
    padding: 16,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  postHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  postAvatar: { width: 40, height: 40, borderRadius: 20 },
  postLine: { width: "94%", height: 12, borderRadius: 6 },
  postLineShort: { width: "66%", height: 12, borderRadius: 6 },
  postMedia: { height: 112, borderRadius: 16 },
  detail: { flex: 1, paddingHorizontal: 20, paddingTop: 22, gap: 14 },
  detailLine: { width: "100%", height: 13, borderRadius: 7 },
  detailLineShort: { width: "74%", height: 13, borderRadius: 7 },
  detailMedia: { height: 190, borderRadius: colors.radius },
  detailDivider: { height: 1, backgroundColor: colors.cardBorder, marginVertical: 4 },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17 },
  commentBubble: { flex: 1, height: 62, borderRadius: 16 },
  form: { flex: 1, padding: 20 },
  formLabel: { width: 142, height: 10, borderRadius: 5 },
  chipRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  chip: { width: 92, height: 38, borderRadius: 19 },
  textArea: { height: 180, borderRadius: 18, marginTop: 12 },
  photoSlot: { height: 58, borderRadius: 16, marginTop: 18 },
  formButton: { height: 54, borderRadius: colors.radiusLg, marginTop: 22 },
});
