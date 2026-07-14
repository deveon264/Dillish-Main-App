import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { MotionListItem } from "@/components/Motion";
import { PostDetailSkeleton } from "@/components/LoadingSkeletons";
import { EmptyState } from "@/components/EmptyState";
import { Avatar } from "@/components/community/Avatar";
import { PostMenu } from "@/components/community/PostMenu";
import { POST_TYPE_META } from "@/components/community/postTypes";
import { useAuth } from "@/contexts/AuthContext";
import { useInsets } from "@/hooks/useInsets";
import { confirmAction, notify } from "@/lib/confirm";
import {
  addComment,
  blockMember,
  communityPhotoUri,
  deletePost,
  fetchComments,
  fetchPost,
  reportPost,
  setPostPinned,
  timeAgo,
  toggleLike,
  type CommunityComment,
  type CommunityPost,
} from "@/lib/community";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

export default function PostDetail() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useInsets();
  const router = useRouter();
  const { token, user } = useAuth();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [p, c] = await Promise.all([
        fetchPost({ token, id }),
        fetchComments({ token, postId: id }),
      ]);
      setPost(p);
      setComments(c);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Could not load this post");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onLike = useCallback(async () => {
    if (!token || !post) return;
    haptics.selection();
    const snapshot = post;
    setPost((p) =>
      p ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) } : p
    );
    try {
      const r = await toggleLike({ token, postId: snapshot.id });
      setPost((p) => (p ? { ...p, likedByMe: r.liked, likeCount: r.likeCount } : p));
    } catch {
      setPost((p) =>
        p ? { ...p, likedByMe: snapshot.likedByMe, likeCount: snapshot.likeCount } : p
      );
      haptics.warning();
    }
  }, [token, post]);

  const submitComment = async () => {
    if (!token || !post) return;
    const body = text.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const comment = await addComment({ token, postId: post.id, text: body });
      setComments((prev) => [...prev, comment]);
      setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
      setText("");
    } catch (e: any) {
      haptics.warning();
      notify("Couldn't comment", e?.message);
    } finally {
      setPosting(false);
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setMenuBusy(false);
  };

  const onReport = async () => {
    if (!token || !post) return;
    setMenuBusy(true);
    try {
      await reportPost({ token, postId: post.id });
      closeMenu();
      notify("Thanks for reporting", "Our team will take a look at this post.");
    } catch (e: any) {
      closeMenu();
      haptics.warning();
      notify("Couldn't report", e?.message);
    }
  };

  const onBlock = async () => {
    if (!token || !post) return;
    closeMenu();
    const ok = await confirmAction({
      title: `Block ${post.author.name}?`,
      message: "You won't see their posts or comments anymore.",
      confirmLabel: "Block",
      destructive: true,
    });
    if (!ok) return;
    try {
      await blockMember({ token, blockedId: post.author.id });
      router.back();
    } catch (e: any) {
      haptics.warning();
      notify("Couldn't block", e?.message);
    }
  };

  const onEdit = () => {
    if (!post) return;
    closeMenu();
    router.push(`/community/compose?id=${post.id}`);
  };

  const onDelete = async () => {
    if (!token || !post) return;
    closeMenu();
    const ok = await confirmAction({
      title: "Delete this post?",
      message: "This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePost({ token, id: post.id });
      router.back();
    } catch (e: any) {
      haptics.warning();
      notify("Couldn't delete", e?.message);
    }
  };
  const onTogglePin = async () => {
    if (!token || !post) return;
    const nextPinned = !post.pinned;
    closeMenu();
    try {
      await setPostPinned({ token, postId: post.id, pinned: nextPinned });
      setPost((p) => (p ? { ...p, pinned: nextPinned } : p));
    } catch (e: any) {
      haptics.warning();
      notify(nextPinned ? "Couldn't pin" : "Couldn't unpin", e?.message);
    }
  };

  const meta = post ? POST_TYPE_META[post.type] : null;

  const head = post ? (
    <View>
      <View style={styles.postHead}>
        <Avatar author={post.author} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{post.author.name}</Text>
          <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {meta ? (
        <View style={styles.tag}>
          <Ionicons name={meta.icon} size={13} color={colors.accentDark} />
          <Text style={styles.tagText}>{meta.label}</Text>
        </View>
      ) : null}

      <Text style={styles.body}>{post.body}</Text>

      {post.photoKey ? (
        <Image
          source={{ uri: communityPhotoUri(post.photoKey) }}
          style={styles.photo}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      <View style={styles.actions}>
        <Pressable hitSlop={8} onPress={onLike} style={styles.action}>
          <Ionicons
            name={post.likedByMe ? "heart" : "heart-outline"}
            size={22}
            color={post.likedByMe ? colors.accent : colors.muted}
          />
          <Text style={[styles.actionText, post.likedByMe && styles.actionTextActive]}>
            {post.likeCount}
          </Text>
        </Pressable>
        <View style={styles.action}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.muted} />
          <Text style={styles.actionText}>{post.commentCount}</Text>
        </View>
      </View>

      <Text style={styles.commentsLabel}>COMMENTS</Text>
    </View>
  ) : null;

  return (
    <GradientBackground>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.topTitle}>Post</Text>
        {post ? (
          <Pressable hitSlop={8} onPress={() => setMenuOpen(true)} style={styles.iconBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {loading ? (
        <PostDetailSkeleton />
      ) : error || !post ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={30} color={colors.muted} />
          <Text style={styles.errorText}>{error ?? "This post is no longer available."}</Text>
          <Pressable style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryText}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={insets.top + 50}
        >
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            ListHeaderComponent={head}
            renderItem={({ item }) => (
              <MotionListItem style={styles.commentRow}>
                <Avatar author={item.author} size={34} />
                <View style={styles.commentBubble}>
                  <View style={styles.commentTop}>
                    <Text style={styles.commentName}>{item.author.name}</Text>
                    <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentBody}>{item.body}</Text>
                </View>
              </MotionListItem>
            )}
            ListEmptyComponent={
              <EmptyState
                compact
                icon="chatbubble-outline"
                title="No comments yet"
                description="Start the conversation and support this member."
                actionLabel="Write a comment"
                onAction={() => commentInputRef.current?.focus()}
              />
            }
            ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />

          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
            <TextInput
              ref={commentInputRef}
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={colors.muted}
              value={text}
              onChangeText={setText}
              multiline
            />
            <Pressable
              onPress={submitComment}
              disabled={!text.trim() || posting}
              style={[styles.sendBtn, (!text.trim() || posting) && styles.sendBtnOff]}
            >
              {posting ? (
                <ActivityIndicator color={colors.onPrimaryStrong} size="small" />
              ) : (
                <Ionicons name="arrow-up" size={20} color={colors.onPrimaryStrong} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <PostMenu
        visible={menuOpen}
        onClose={closeMenu}
        isOwn={!!post && !!user && post.author.id === user.id}
        isAdmin={!!user?.isAdmin}
        isPinned={!!post?.pinned}
        authorName={post?.author.name ?? ""}
        busy={menuBusy}
        onReport={onReport}
        onBlock={onBlock}
        onEdit={onEdit}
        onDelete={onDelete}
        onTogglePin={onTogglePin}
      />
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 30 },
  errorText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, textAlign: "center" },
  retryBtn: {
    marginTop: 6,
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accentBorderMd,
  },
  retryText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accentDark },
  postHead: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  name: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  time: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: colors.accentTint,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 14,
  },
  tagText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accentDark, letterSpacing: 0.2 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: colors.foreground, marginTop: 12 },
  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: colors.radius,
    backgroundColor: colors.accentTintFaint,
    marginTop: 14,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginTop: 16,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted },
  actionTextActive: { color: colors.accent },
  commentsLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.muted,
    marginTop: 18,
    marginBottom: 16,
  },
  noComments: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  commentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    padding: 12,
  },
  commentTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  commentName: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  commentTime: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
  commentBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.foreground, marginTop: 4 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    backgroundColor: colors.background,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnOff: { opacity: 0.4 },
});
