import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { ListRowsSkeleton } from "@/components/LoadingSkeletons";
import { EmptyState } from "@/components/EmptyState";
import { Avatar } from "@/components/community/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useInsets } from "@/hooks/useInsets";
import {
  fetchNotifications,
  markNotificationsRead,
  timeAgo,
  type CommunityNotification,
} from "@/lib/community";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

function actionText(type: CommunityNotification["type"]): string {
  return type === "comment" ? "commented on your post" : "liked your post";
}

export default function Notifications() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();
  const router = useRouter();
  const { token } = useAuth();
  const { setUnreadCount, refreshUnread } = useNotifications();

  const [items, setItems] = useState<CommunityNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the inbox and immediately mark everything fetched as read, so opening
  // this screen clears the badge. The mark request returns the new unread count,
  // which we push into the shared badge state.
  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      try {
        const { notifications, unreadCount } = await fetchNotifications({ token });
        setItems(notifications);
        setUnreadCount(unreadCount);

        const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
        if (unreadIds.length > 0) {
          // Reflect read state locally right away; the badge follows the
          // server's returned count.
          setItems((prev) => prev.map((n) => ({ ...n, read: true })));
          try {
            const res = await markNotificationsRead({ token, ids: unreadIds });
            setUnreadCount(res.unreadCount);
          } catch {
            // If the mark fails, refresh the badge so it stays truthful.
            refreshUnread();
          }
        }
      } catch (e: any) {
        setError(e?.message ?? "Could not load notifications");
      } finally {
        setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [token, setUnreadCount, refreshUnread]
  );

  useFocusEffect(
    useCallback(() => {
      load("initial");
    }, [load])
  );

  const renderEmpty = () => {
    if (loading) return null;
    if (error) {
      return (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.muted} />
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load("initial")}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <EmptyState
        icon="notifications-outline"
        title="No activity yet"
        description="Visit the community to share an update or support another member."
        actionLabel="Visit community"
        onAction={() => router.replace("/(tabs)/community")}
      />
    );
  };

  return (
    <GradientBackground>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.topTitle}>Activity</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <ListRowsSkeleton rows={5} label="Loading activity" style={styles.loadingList} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <Pressable
              pressedScale={0.985}
              style={styles.row}
              onPress={() => router.push(`/community/${item.postId}`)}
            >
              <Avatar author={item.actor} size={44} />
              <View style={styles.rowBody}>
                <Text style={styles.rowText}>
                  <Text style={styles.actorName}>{item.actor.name}</Text>
                  <Text style={styles.action}> {actionText(item.type)}</Text>
                </Text>
                {item.postExcerpt ? (
                  <Text style={styles.excerpt} numberOfLines={1}>
                    {item.postExcerpt}
                  </Text>
                ) : null}
                <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Ionicons
                name={item.type === "comment" ? "chatbubble" : "heart"}
                size={16}
                color={colors.accent}
                style={styles.typeIcon}
              />
            </Pressable>
          )}
          ListEmptyComponent={renderEmpty}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 24,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh")}
              tintColor={colors.accent}
            />
          }
        />
      )}
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
  loadingList: { paddingHorizontal: 20, paddingTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  rowBody: { flex: 1 },
  rowText: { fontFamily: fonts.sans, fontSize: 14, color: colors.foreground, lineHeight: 20 },
  actorName: { fontFamily: fonts.sansSemibold, color: colors.foreground },
  action: { fontFamily: fonts.sans, color: colors.foreground },
  excerpt: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
  time: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 4 },
  typeIcon: { marginLeft: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 56, gap: 10 },
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
});
