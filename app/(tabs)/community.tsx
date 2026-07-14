import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { MotionListItem } from "@/components/Motion";
import { CommunityFeedSkeleton } from "@/components/LoadingSkeletons";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { HelpButton } from "@/components/HelpButton";
import { Avatar } from "@/components/community/Avatar";
import { MemberNotices } from "@/components/community/MemberNotices";
import { PostCard } from "@/components/community/PostCard";
import { PostMenu } from "@/components/community/PostMenu";
import { POST_TYPE_META } from "@/components/community/postTypes";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useInsets } from "@/hooks/useInsets";
import { useActiveTabScroll } from "@/hooks/useActiveTabScroll";
import { confirmAction, notify } from "@/lib/confirm";
import {
  blockMember,
  createPost,
  deletePost,
  fetchActiveToday,
  fetchFeed,
  reportPost,
  setPostPinned,
  toggleLike,
  POST_TYPES,
  type ActiveToday,
  type CommunityPost,
  type FeedCursor,
  type PostType,
} from "@/lib/community";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

type Filter = PostType | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  ...POST_TYPES.map((t) => ({ key: t, label: POST_TYPE_META[t].label })),
];

const HELP = {
  title: "Community",
  intro: "A shared space to cheer each other on.",
  points: [
    "Share a progress update, a meal, a tip, or a little motivation.",
    "Like and comment to support the people training alongside you.",
    "Filter by what you want to see, and report or block anything that doesn't belong.",
  ],
};

export default function Community() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const { unreadCount } = useNotifications();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [pinned, setPinned] = useState<CommunityPost[]>([]);
  const [activeToday, setActiveToday] = useState<ActiveToday | null>(null);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [menuPost, setMenuPost] = useState<CommunityPost | null>(null);
  const [menuBusy, setMenuBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [composerType, setComposerType] = useState<PostType>("progress");
  const [composerBusy, setComposerBusy] = useState(false);

  const type = filter === "all" ? null : filter;

  const loadFirst = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!token) return;
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      try {
        const res = await fetchFeed({ token, type });
        setPosts(res.posts);
        setCursor(res.nextCursor);
        // Pinned posts + the active-today strip only belong on the unfiltered
        // feed; clear them when a type filter is applied.
        setPinned(type ? [] : res.pinned ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Could not load the feed");
      } finally {
        setInitialLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
      // Best-effort: the activity strip never blocks the feed.
      if (!type) {
        fetchActiveToday({ token })
          .then(setActiveToday)
          .catch(() => setActiveToday(null));
      } else {
        setActiveToday(null);
      }
    },
    [token, type]
  );

  // Refetch the first page whenever the screen gains focus (returning from
  // compose/detail reflects new posts and updated counts) and whenever the
  // filter changes (loadFirst's identity changes with `type`).
  useFocusEffect(
    useCallback(() => {
      loadFirst("initial");
    }, [loadFirst])
  );

  // Tapping the active Circle tab scrolls the feed to the top; a double-tap
  // refreshes it (same as pull-to-refresh).
  const onDoubleRefresh = useCallback(() => loadFirst("refresh"), [loadFirst]);
  const listRef = useActiveTabScroll(onDoubleRefresh);

  const loadMore = useCallback(async () => {
    if (!token || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchFeed({ token, type, cursor });
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(res.nextCursor);
    } catch {
      // keep the list as-is; pulling to refresh will retry
    } finally {
      setLoadingMore(false);
    }
  }, [token, type, cursor, loadingMore]);

  const selectFilter = (next: Filter) => {
    if (next === filter) return;
    haptics.selection();
    setPosts([]);
    setCursor(null);
    setInitialLoading(true);
    setFilter(next);
  };

  const onLike = useCallback(
    async (post: CommunityPost) => {
      if (!token) return;
      haptics.selection();
      // A pinned post is rendered from the separate `pinned` list, so update
      // whichever list holds it.
      const applyToBoth = (fn: (p: CommunityPost) => CommunityPost) => {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? fn(p) : p)));
        setPinned((prev) => prev.map((p) => (p.id === post.id ? fn(p) : p)));
      };
      applyToBoth((p) => ({
        ...p,
        likedByMe: !p.likedByMe,
        likeCount: p.likeCount + (p.likedByMe ? -1 : 1),
      }));
      try {
        const r = await toggleLike({ token, postId: post.id });
        applyToBoth((p) => ({ ...p, likedByMe: r.liked, likeCount: r.likeCount }));
      } catch {
        applyToBoth((p) => ({ ...p, likedByMe: post.likedByMe, likeCount: post.likeCount }));
        haptics.warning();
      }
    },
    [token]
  );

  const closeMenu = () => {
    setMenuPost(null);
    setMenuBusy(false);
  };

  const onReport = async () => {
    if (!token || !menuPost) return;
    const target = menuPost;
    setMenuBusy(true);
    try {
      await reportPost({ token, postId: target.id });
      closeMenu();
      notify("Thanks for reporting", "Our team will take a look at this post.");
    } catch (e: any) {
      closeMenu();
      haptics.warning();
      notify("Couldn't report", e?.message);
    }
  };

  const onBlock = async () => {
    if (!token || !menuPost) return;
    const target = menuPost;
    closeMenu();
    const ok = await confirmAction({
      title: `Block ${target.author.name}?`,
      message: "You won't see their posts or comments anymore.",
      confirmLabel: "Block",
      destructive: true,
    });
    if (!ok) return;
    try {
      await blockMember({ token, blockedId: target.author.id });
      setPosts((prev) => prev.filter((p) => p.author.id !== target.author.id));
    } catch (e: any) {
      haptics.warning();
      notify("Couldn't block", e?.message);
    }
  };

  const onEdit = () => {
    if (!menuPost) return;
    const target = menuPost;
    closeMenu();
    router.push(`/community/compose?id=${target.id}`);
  };

  const onDelete = async () => {
    if (!token || !menuPost) return;
    const target = menuPost;
    closeMenu();
    const ok = await confirmAction({
      title: "Delete this post?",
      message: "This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePost({ token, id: target.id });
      setPosts((prev) => prev.filter((p) => p.id !== target.id));
      setPinned((prev) => prev.filter((p) => p.id !== target.id));
    } catch (e: any) {
      haptics.warning();
      notify("Couldn't delete", e?.message);
    }
  };

  // Admin-only: pin or unpin a post. Pinning lifts it out of the main feed into
  // the pinned strip at the top; unpinning drops it back into the feed. The
  // feed is reloaded so the moved post lands in the right place.
  const onTogglePin = async () => {
    if (!token || !menuPost) return;
    const target = menuPost;
    const nextPinned = !target.pinned;
    closeMenu();
    try {
      await setPostPinned({ token, postId: target.id, pinned: nextPinned });
      await loadFirst("refresh");
    } catch (e: any) {
      haptics.warning();
      notify(nextPinned ? "Couldn't pin" : "Couldn't unpin", e?.message);
    }
  };

  const postInline = async () => {
    if (!token || composerBusy) return;
    const body = composerText.trim();
    if (!body) return;
    setComposerBusy(true);
    try {
      const post = await createPost({ token, type: composerType, text: body });
      setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
      setComposerText("");
      setComposerType("progress");
      setComposerOpen(false);
      notify("Posted to Circle", "Your update is live.");
    } catch (e: any) {
      haptics.warning();
      notify("Couldn't post", e?.message);
    } finally {
      setComposerBusy(false);
    }
  };

  const header = (
    <View>
      <PageHeader
        eyebrow="COMMUNITY"
        title="Your"
        accent="Circle"
        action={
          <View style={styles.headerActions}>
            <Pressable
              hitSlop={8}
              onPress={() => router.push("/community/notifications")}
              style={styles.bellBtn}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.foreground} />
              {unreadCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText} numberOfLines={1}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <HelpButton {...HELP} />
          </View>
        }
      />

      {activeToday && activeToday.count > 0 ? (
        <MotionListItem style={styles.activeStrip}>
          <View style={styles.activeAvatars}>
            {activeToday.members.slice(0, 4).map((m, i) => (
              <View key={m.id} style={[styles.activeAvatar, i > 0 && styles.activeAvatarOverlap]}>
                <Avatar author={m} size={30} />
              </View>
            ))}
          </View>
          <Text style={styles.activeText} numberOfLines={1}>
            {activeToday.members[0]
              ? activeToday.count > 1
                ? `${activeToday.members[0].name.split(" ")[0]} and ${activeToday.count - 1} other${
                    activeToday.count - 1 === 1 ? "" : "s"
                  } were active today`
                : `${activeToday.members[0].name.split(" ")[0]} was active today`
              : `${activeToday.count} active today`}
          </Text>
          <View style={styles.activeDot} />
        </MotionListItem>
      ) : null}

      <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsRow}
      >
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => selectFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      </View>

      <View>
      {!composerOpen ? (
        <Pressable style={styles.composeBar} onPress={() => setComposerOpen(true)}>
          <Text style={styles.composePlaceholder}>Share something with the community...</Text>
          <Ionicons name="create-outline" size={20} color={colors.accent} />
        </Pressable>
      ) : (
        <View style={styles.composerCard}>
          <View style={styles.composerHead}>
            {user ? (
              <Avatar
                author={{ id: user.id, name: user.name, avatar: user.avatar ?? null, avatarVersion: user.avatarVersion ?? null }}
                size={38}
              />
            ) : null}
            <TextInput
              value={composerText}
              onChangeText={setComposerText}
              placeholder="Share an update, a win, a meal, or some encouragement..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={styles.composerInput}
            />
          </View>
          <View style={styles.composerTypes}>
            {POST_TYPES.map((t) => {
              const active = t === composerType;
              const meta = POST_TYPE_META[t];
              return (
                <Pressable
                  key={t}
                  onPress={() => {
                    if (active) return;
                    haptics.selection();
                    setComposerType(t);
                  }}
                  style={[styles.composerChip, active && styles.composerChipActive]}
                >
                  <Text style={[styles.composerChipText, active && styles.composerChipTextActive]}>{meta.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.composerFoot}>
            <Pressable style={styles.photoSlot} onPress={() => router.push("/community/compose")}>
              <Ionicons name="image-outline" size={16} color={colors.accentDark} />
              <Text style={styles.photoSlotText}>Photo</Text>
            </Pressable>
            <Pressable onPress={() => setComposerOpen(false)} style={styles.cancelCompose}>
              <Text style={styles.cancelComposeText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={postInline}
              disabled={!composerText.trim() || composerBusy}
              style={[styles.postCompose, (!composerText.trim() || composerBusy) && styles.postComposeDisabled]}
            >
              <Text style={styles.postComposeText}>{composerBusy ? "Posting..." : "Post to Circle"}</Text>
            </Pressable>
          </View>
        </View>
      )}
      </View>

      <View>
      <MemberNotices />
      </View>

      {pinned.map((p) => (
        <MotionListItem key={p.id} style={{ marginBottom: 14 }}>
          <PostCard
            post={p}
            onPress={() => router.push(`/community/${p.id}`)}
            onLike={() => onLike(p)}
            onComment={() => router.push(`/community/${p.id}`)}
            onMenu={() => setMenuPost(p)}
          />
        </MotionListItem>
      ))}
    </View>
  );

  const renderEmpty = () => {
    if (initialLoading) return null;
    if (error) {
      return (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.muted} />
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => loadFirst("initial")}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <EmptyState
        icon="people-outline"
        title="Nothing here yet"
        description={filter === "all" ? "Be the first to share with the community." : "No posts match this filter yet."}
        actionLabel={filter === "all" ? "Create a post" : "View all posts"}
        onAction={() => filter === "all" ? setComposerOpen(true) : selectFilter("all")}
      />
    );
  };

  return (
    <GradientBackground>
      {initialLoading ? (
        <CommunityFeedSkeleton topPadding={insets.top + 12} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <MotionListItem>
            <PostCard
              post={item}
              onPress={() => router.push(`/community/${item.id}`)}
              onLike={() => onLike(item)}
              onComment={() => router.push(`/community/${item.id}`)}
              onMenu={() => setMenuPost(item)}
            />
            </MotionListItem>
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={renderEmpty}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          contentContainerStyle={{
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 110,
            paddingHorizontal: 20,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadFirst("refresh")}
              tintColor={colors.accent}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoad}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
        />
        </KeyboardAvoidingView>
      )}

      <PostMenu
        visible={!!menuPost}
        onClose={closeMenu}
        isOwn={!!menuPost && !!user && menuPost.author.id === user.id}
        isAdmin={!!user?.isAdmin}
        isPinned={!!menuPost?.pinned}
        authorName={menuPost?.author.name ?? ""}
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(62, 39, 51, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  bellBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, lineHeight: 13, color: colors.onPrimary },
  activeStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  activeAvatars: { flexDirection: "row" },
  activeAvatar: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.card,
  },
  activeAvatarOverlap: { marginLeft: -9 },
  activeText: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 12.5, color: "rgba(62, 39, 51, 0.6)" },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 4,
  },
  chipsRow: { marginTop: 16, marginHorizontal: -20 },
  chips: { gap: 8, paddingHorizontal: 20 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(62, 39, 51, 0.12)",
    backgroundColor: colors.card,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  chipText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.muted },
  chipTextActive: { color: colors.onPrimary },
  composeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  composePlaceholder: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  composerCard: {
    marginTop: 16,
    marginBottom: 4,
    padding: 14,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  composerHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  composerInput: {
    flex: 1,
    minHeight: 86,
    padding: 0,
    textAlignVertical: "top",
    fontFamily: fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.foreground,
  },
  composerTypes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  composerChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.card,
  },
  composerChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  composerChipText: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.muted },
  composerChipTextActive: { color: colors.onPrimary },
  composerFoot: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  photoSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.accentBorderMd,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.accentTintFaint,
  },
  photoSlotText: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.accentDark },
  cancelCompose: { paddingHorizontal: 8, paddingVertical: 9 },
  cancelComposeText: { fontFamily: fonts.sansSemibold, fontSize: 12.5, color: colors.muted },
  postCompose: {
    marginLeft: "auto",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  postComposeDisabled: { opacity: 0.45 },
  postComposeText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.onPrimary },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 56, gap: 10 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.foreground },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    paddingHorizontal: 30,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 6,
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accentBorderMd,
  },
  retryText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accentDark },
  footerLoad: { paddingVertical: 20 },
});
