import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Avatar } from "@/components/community/Avatar";
import { POST_TYPE_META, POST_TYPE_TINT } from "@/components/community/postTypes";
import { communityPhotoUri, timeAgo, type CommunityPost } from "@/lib/community";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

type Props = {
  post: CommunityPost;
  onPress: () => void;
  onLike: () => void;
  onComment: () => void;
  onMenu: () => void;
};

// A single feed item: author, type tag, text, optional photo, and the like /
// comment actions. The card body opens the post detail; the action buttons
// handle their own taps without bubbling up. A pinned post (the trainer's
// highlighted post) gets a rose-gold gradient border, a haloed avatar, and a
// PINNED badge instead of the plain hairline card.
export function PostCard({ post, onPress, onLike, onComment, onMenu }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const meta = POST_TYPE_META[post.type];
  const tint = POST_TYPE_TINT[post.type];

  const body = (
    <Pressable
      pressedScale={0.985}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        post.pinned && styles.cardPinned,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.head}>
        {post.pinned ? (
          <LinearGradient
            colors={colors.gradientRoseGold}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.halo}
          >
            <View style={styles.haloInner}>
              <Avatar author={post.author} size={40} />
            </View>
          </LinearGradient>
        ) : (
          <Avatar author={post.author} size={42} />
        )}
        <View style={styles.headText}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {post.author.name}
            </Text>
            {post.pinned ? (
              <View style={styles.pinnedBadge}>
                <Text style={styles.pinnedBadgeText}>PINNED</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.time}>
            {post.pinned ? "Your trainer · " : ""}
            {timeAgo(post.createdAt)}
          </Text>
        </View>
        {post.pinned ? (
          <Ionicons name="ribbon" size={17} color={colors.accentDark} style={styles.pinIcon} />
        ) : null}
        <Pressable hitSlop={8} onPress={onMenu} style={styles.menuBtn} accessibilityLabel="Post options">
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
        </Pressable>
      </View>

      {post.pinned ? null : (
        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: tint.bg }]}>
            <Text style={[styles.tagText, { color: tint.fg }]}>{meta.label.toUpperCase()}</Text>
          </View>
        </View>
      )}

      <Text style={styles.bodyText}>{post.body}</Text>

      {post.photoKey ? (
        <Image
          source={{ uri: communityPhotoUri(post.photoKey) }}
          style={styles.photo}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      <View style={styles.footer}>
        <Pressable
          hitSlop={8}
          onPress={onLike}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          accessibilityLabel="Like"
        >
          <Ionicons
            name={post.likedByMe ? "heart" : "heart-outline"}
            size={15}
            color={post.likedByMe ? colors.primary : colors.muted}
          />
          <AnimatedNumber
            value={post.likeCount}
            style={[styles.actionText, post.likedByMe && styles.actionTextActive]}
          />
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={onComment}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          accessibilityLabel="Comments"
        >
          <Ionicons name="chatbubble-outline" size={14} color={colors.muted} />
          <AnimatedNumber value={post.commentCount} style={styles.actionText} />
        </Pressable>
        {post.type === "progress" ? (
          <Pressable
            hitSlop={8}
            onPress={onLike}
            style={({ pressed }) => [styles.cheerAction, pressed && styles.actionPressed]}
            accessibilityLabel="Cheer"
          >
            <Ionicons name="star-outline" size={14} color={colors.accentDark} />
            <Text style={styles.cheerText}>Cheer</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );

  // Pinned posts are wrapped in a thin rose-gold gradient frame.
  if (post.pinned) {
    return (
      <LinearGradient
        colors={colors.gradientRoseGold}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pinnedFrame}
      >
        {body}
      </LinearGradient>
    );
  }
  return body;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  pinnedFrame: {
    borderRadius: colors.radiusLg,
    padding: 1.5,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 16,
  },
  cardPinned: {
    borderWidth: 0,
    // Fill the gradient frame exactly (frame radius minus its 1.5px padding).
    borderRadius: colors.radiusLg - 1.5,
  },
  cardPressed: { opacity: 0.97 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  headText: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground, flexShrink: 1 },
  time: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
  menuBtn: { padding: 2 },
  pinIcon: { marginRight: 2 },

  // Rose-gold halo around the pinned author's avatar.
  halo: { padding: 2, borderRadius: 999 },
  haloInner: { padding: 2, borderRadius: 999, backgroundColor: colors.card },

  pinnedBadge: {
    backgroundColor: colors.blush,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  pinnedBadgeText: { fontFamily: fonts.sansBold, fontSize: 9, letterSpacing: 1, color: colors.accentDark },

  tagRow: { flexDirection: "row", marginTop: 12 },
  tag: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  tagText: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 0.5 },
  bodyText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: "rgba(62, 39, 51, 0.85)", marginTop: 12 },
  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: colors.radiusSm,
    backgroundColor: colors.blushSurface,
    marginTop: 12,
  },
  footer: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 12 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(62, 39, 51, 0.1)",
    backgroundColor: colors.card,
  },
  actionPressed: { transform: [{ scale: 0.93 }] },
  actionText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.muted },
  actionTextActive: { color: colors.accentDark },
  cheerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: colors.blush,
    borderWidth: 1,
    borderColor: colors.blushBorder,
  },
  cheerText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accentDark },
});
