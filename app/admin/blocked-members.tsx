import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/community/Avatar";
import { useInsets } from "@/hooks/useInsets";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchBlockedMembers,
  timeAgo,
  unblockAuthor,
  type AdminBlockedMember,
} from "@/lib/community";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export default function BlockedMembers() {
  const router = useRouter();
  const insets = useInsets();
  const { isAdmin, token } = useAuth();

  const [blocked, setBlocked] = useState<AdminBlockedMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const list = await fetchBlockedMembers({ token });
      setBlocked(list);
    } catch (e: any) {
      setError(e?.message ?? "Could not load blocked members");
      setBlocked([]);
    }
  }, [token]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!isAdmin) {
    return (
      <GradientBackground>
        <View style={styles.guard}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.mutedForeground} />
          <Text style={styles.guardTitle}>Admins only</Text>
          <Text style={styles.guardText}>This area is reserved for the Florish admin account.</Text>
          <Button label="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: 20, width: 200 }} />
        </View>
      </GradientBackground>
    );
  }

  const unblock = (item: AdminBlockedMember) => {
    if (!token) return;
    setBusyId(item.member.id);
    void (async () => {
      try {
        await unblockAuthor({ token, authorId: item.member.id });
        setBlocked((prev) => (prev ? prev.filter((b) => b.member.id !== item.member.id) : prev));
      } catch (e: any) {
        notify("Could not unblock member", e?.message ?? "Please try again.");
      } finally {
        setBusyId(null);
      }
    })();
  };

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <PageHeader
          variant="compact"
          eyebrow="ADMIN"
          title="Blocked"
          accent="Members"
          style={styles.header}
          leading={
            <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.foreground} />
            </Pressable>
          }
        />

        <View style={styles.forCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
          <Text style={styles.forText}>
            These members are blocked, so their posts are hidden from everyone's feed. Unblock
            anyone to bring their posts back.
          </Text>
        </View>

        {blocked === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : error && blocked.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>{error}</Text>
            <Button label="Try Again" variant="outline" onPress={() => void load()} style={{ marginTop: 16, width: 200 }} />
          </View>
        ) : blocked.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.accent} />
            <Text style={styles.emptyTitle}>No one is blocked</Text>
            <Text style={styles.emptyText}>
              Members you block from the feed will show up here so you can restore them anytime.
            </Text>
          </View>
        ) : (
          blocked.map((item) => {
            const busy = busyId === item.member.id;
            return (
              <View key={item.member.id} style={styles.card}>
                <View style={styles.memberRow}>
                  <Avatar author={item.member} size={42} />
                  <View style={styles.memberText}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {item.member.name}
                    </Text>
                    <Text style={styles.memberMeta}>
                      Blocked {timeAgo(item.blockedAt)}
                      {item.blockedByName ? ` by ${item.blockedByName}` : ""}
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={[styles.actionBtn, styles.unblockBtn]}
                  onPress={() => unblock(item)}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.accentDark} />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={16} color={colors.accentDark} />
                      <Text style={styles.unblockText}>Unblock</Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { marginBottom: 8 },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  guard: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  guardTitle: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground, marginTop: 8 },
  guardText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  forCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    marginBottom: 4,
    backgroundColor: colors.accentTint,
    borderWidth: 1,
    borderColor: colors.accentBorderMd,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  forText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.foreground, lineHeight: 20 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontFamily: fonts.serifSemibold, fontSize: 20, color: colors.foreground, marginTop: 6 },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 16,
    marginTop: 14,
  },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  memberText: { flex: 1, gap: 3 },
  memberName: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground },
  memberMeta: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: colors.radius,
    paddingVertical: 11,
    marginTop: 14,
  },
  unblockBtn: {
    backgroundColor: colors.accentTint,
    borderWidth: 1,
    borderColor: colors.accentBorderMd,
  },
  unblockText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.accentDark },
});
