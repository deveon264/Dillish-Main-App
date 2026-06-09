import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/community/Avatar";
import { POST_TYPE_META } from "@/components/community/postTypes";
import { communityPhotoUri, timeAgo, type CommunityPost } from "@/lib/community";
import { colors } from "@/constants/colors";
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
// handle their own taps without bubbling up.
export function PostCard({ post, onPress, onLike, onComment, onMenu }: Props) {
  const meta = POST_TYPE_META[post.type];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.head}>
        <Avatar author={post.author} size={42} />
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>
            {post.author.name}
          </Text>
          <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
        </View>
        <Pressable hitSlop={8} onPress={onMenu} style={styles.menuBtn} accessibilityLabel="Post options">
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.tag}>
        <Ionicons name={meta.icon} size={13} color={colors.accentDark} />
        <Text style={styles.tagText}>{meta.label}</Text>
      </View>

      <Text style={styles.body}>{post.body}</Text>

      {post.photoKey ? (
        <Image
          source={{ uri: communityPhotoUri(post.photoKey) }}
          style={styles.photo}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      <View style={styles.footer}>
        <Pressable hitSlop={8} onPress={onLike} style={styles.action} accessibilityLabel="Like">
          <Ionicons
            name={post.likedByMe ? "heart" : "heart-outline"}
            size={20}
            color={post.likedByMe ? colors.accent : colors.muted}
          />
          <Text style={[styles.actionText, post.likedByMe && styles.actionTextActive]}>
            {post.likeCount}
          </Text>
        </Pressable>
        <Pressable hitSlop={8} onPress={onComment} style={styles.action} accessibilityLabel="Comments">
          <Ionicons name="chatbubble-outline" size={19} color={colors.muted} />
          <Text style={styles.actionText}>{post.commentCount}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 16,
  },
  cardPressed: { opacity: 0.97 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  headText: { flex: 1 },
  name: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  time: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
  menuBtn: { padding: 4 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: colors.accentTint,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  tagText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accentDark, letterSpacing: 0.2 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.foreground, marginTop: 10 },
  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: colors.radius,
    backgroundColor: colors.accentTintFaint,
    marginTop: 12,
  },
  footer: { flexDirection: "row", alignItems: "center", gap: 22, marginTop: 14 },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  actionTextActive: { color: colors.accent },
});
