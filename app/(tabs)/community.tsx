import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { PageHeader } from "@/components/PageHeader";
import { HelpButton } from "@/components/HelpButton";
import { Avatar } from "@/components/community/Avatar";
import { PostCard } from "@/components/community/PostCard";
import { PostMenu } from "@/components/community/PostMenu";
import { POST_TYPE_META } from "@/components/community/postTypes";
import { useAuth } from "@/contexts/AuthContext";
import { useInsets } from "@/hooks/useInsets";
import { confirmAction, notify } from "@/lib/confirm";
import {
  blockMember,
  deletePost,
  fetchFeed,
  reportPost,
  toggleLike,
  POST_TYPES,
  type CommunityPost,
  type FeedCursor,
  type PostType,
} from "@/lib/community";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

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
    "Like and comment to support the women training alongside you.",
    "Filter by what you want to see, and report or block anything that doesn't belong.",
  ],
};

export default function Community() {
  const insets = useInsets();
  const router = useRouter();
  const { token, user } = useAuth();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [menuPost, setMenuPost] = useState<CommunityPost | null>(null);
  const [menuBusy, setMenuBusy] = useState(false);

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
      } catch (e: any) {
        setError(e?.message ?? "Could not load the feed");
      } finally {
        setInitialLoading(false);
        if (mode === "refresh") setRefreshing(false);
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
    setPosts([]);
    setCursor(null);
    setInitialLoading(true);
    setFilter(next);
  };

  const onLike = useCallback(
    async (post: CommunityPost) => {
      if (!token) return;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
            : p
        )
      );
      try {
        const r = await toggleLike({ token, postId: post.id });
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, likedByMe: r.liked, likeCount: r.likeCount } : p))
        );
      } catch {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, likedByMe: post.likedByMe, likeCount: post.likeCount } : p
          )
        );
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
      notify("Couldn't block", e?.message);
    }
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
    } catch (e: any) {
      notify("Couldn't delete", e?.message);
    }
  };

  const header = (
    <View>
      <PageHeader eyebrow="COMMUNITY" title="The" accent="Circle" action={<HelpButton {...HELP} />} />

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

      <Pressable style={styles.composeBar} onPress={() => router.push("/community/compose")}>
        {user ? (
          <Avatar
            author={{ id: user.id, name: user.name, avatar: user.avatar ?? null, avatarVersion: user.avatarVersion ?? null }}
            size={36}
          />
        ) : null}
        <Text style={styles.composePlaceholder}>Share something with the community</Text>
        <Ionicons name="create-outline" size={20} color={colors.accent} />
      </Pressable>
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
      <View style={styles.empty}>
        <Ionicons name="people-outline" size={30} color={colors.muted} />
        <Text style={styles.emptyTitle}>Nothing here yet</Text>
        <Text style={styles.emptyText}>
          {filter === "all"
            ? "Be the first to share with the community."
            : "No posts in this filter yet."}
        </Text>
      </View>
    );
  };

  return (
    <GradientBackground>
      {initialLoading ? (
        <View style={[styles.loading, { paddingTop: insets.top }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => router.push(`/community/${item.id}`)}
              onLike={() => onLike(item)}
              onComment={() => router.push(`/community/${item.id}`)}
              onMenu={() => setMenuPost(item)}
            />
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
      )}

      <PostMenu
        visible={!!menuPost}
        onClose={closeMenu}
        isOwn={!!menuPost && !!user && menuPost.author.id === user.id}
        isAdmin={!!user?.isAdmin}
        authorName={menuPost?.author.name ?? ""}
        busy={menuBusy}
        onReport={onReport}
        onBlock={onBlock}
        onDelete={onDelete}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  chipsRow: { marginTop: 18, marginHorizontal: -20 },
  chips: { gap: 8, paddingHorizontal: 20 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  chipTextActive: { color: colors.onPrimaryStrong },
  composeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    marginBottom: 4,
    padding: 12,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  composePlaceholder: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
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
