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
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/community/Avatar";
import { POST_TYPE_META } from "@/components/community/postTypes";
import { useInsets } from "@/hooks/useInsets";
import { useAuth } from "@/contexts/AuthContext";
import {
  communityPhotoUri,
  deletePost,
  dismissReport,
  fetchReports,
  timeAgo,
  type CommunityReport,
} from "@/lib/community";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function confirmAction(title: string, message: string, confirmLabel: string, run: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) run();
  } else {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: confirmLabel, style: "destructive", onPress: run },
    ]);
  }
}

export default function Reports() {
  const router = useRouter();
  const insets = useInsets();
  const { isAdmin, token } = useAuth();

  const [reports, setReports] = useState<CommunityReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const list = await fetchReports({ token });
      setReports(list);
    } catch (e: any) {
      setError(e?.message ?? "Could not load reports");
      setReports([]);
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
          <Text style={styles.guardTitle}>Coaches only</Text>
          <Text style={styles.guardText}>This area is reserved for the Florish coach account.</Text>
          <Button label="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: 20, width: 200 }} />
        </View>
      </GradientBackground>
    );
  }

  const removePost = (report: CommunityReport) => {
    confirmAction(
      "Delete post",
      "This permanently removes the post for everyone. The report will clear too.",
      "Delete",
      async () => {
        if (!token) return;
        setBusyId(report.id);
        try {
          await deletePost({ token, id: report.post.id });
          setReports((prev) => (prev ? prev.filter((r) => r.post.id !== report.post.id) : prev));
        } catch (e: any) {
          notify("Could not delete post", e?.message ?? "Please try again.");
        } finally {
          setBusyId(null);
        }
      }
    );
  };

  const dismiss = (report: CommunityReport) => {
    confirmAction(
      "Dismiss report",
      "This clears the report but keeps the post visible.",
      "Dismiss",
      async () => {
        if (!token) return;
        setBusyId(report.id);
        try {
          await dismissReport({ token, id: report.id });
          setReports((prev) => (prev ? prev.filter((r) => r.id !== report.id) : prev));
        } catch (e: any) {
          notify("Could not dismiss report", e?.message ?? "Please try again.");
        } finally {
          setBusyId(null);
        }
      }
    );
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
          eyebrow="COACH"
          title="Reported"
          accent="Posts"
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
            Members can report posts in the community feed. Review each one, then delete the post or
            dismiss the report.
          </Text>
        </View>

        {reports === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : error && reports.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>{error}</Text>
            <Button label="Try Again" variant="outline" onPress={() => void load()} style={{ marginTop: 16, width: 200 }} />
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.accent} />
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptyText}>There are no reported posts to review right now.</Text>
          </View>
        ) : (
          reports.map((report) => {
            const meta = POST_TYPE_META[report.post.type];
            const busy = busyId === report.id;
            return (
              <View key={report.id} style={styles.card}>
                <Pressable
                  style={styles.reporterRow}
                  onPress={() => router.push(`/community/${report.post.id}`)}
                >
                  <Ionicons name="flag" size={15} color={colors.danger} />
                  <Text style={styles.reporterText} numberOfLines={2}>
                    Reported by{" "}
                    <Text style={styles.reporterName}>{report.reporter.name}</Text> ·{" "}
                    {timeAgo(report.createdAt)}
                  </Text>
                </Pressable>

                {report.reason ? (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Reason</Text>
                    <Text style={styles.reasonText}>{report.reason}</Text>
                  </View>
                ) : (
                  <Text style={styles.noReason}>No reason given</Text>
                )}

                <Pressable
                  style={styles.postPreview}
                  onPress={() => router.push(`/community/${report.post.id}`)}
                >
                  <View style={styles.postHead}>
                    <Avatar author={report.post.author} size={38} />
                    <View style={styles.postHeadText}>
                      <Text style={styles.postAuthor} numberOfLines={1}>
                        {report.post.author.name}
                      </Text>
                      <Text style={styles.postTime}>{timeAgo(report.post.createdAt)}</Text>
                    </View>
                  </View>

                  <View style={styles.tag}>
                    <Ionicons name={meta.icon} size={12} color={colors.accentDark} />
                    <Text style={styles.tagText}>{meta.label}</Text>
                  </View>

                  <Text style={styles.postBody} numberOfLines={6}>
                    {report.post.body}
                  </Text>

                  {report.post.photoKey ? (
                    <Image
                      source={{ uri: communityPhotoUri(report.post.photoKey) }}
                      style={styles.photo}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : null}
                </Pressable>

                <View style={styles.actions}>
                  <Pressable
                    style={[styles.actionBtn, styles.openBtn]}
                    onPress={() => router.push(`/community/${report.post.id}`)}
                    disabled={busy}
                  >
                    <Ionicons name="open-outline" size={16} color={colors.foreground} />
                    <Text style={styles.openText}>Open</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.dismissBtn]}
                    onPress={() => dismiss(report)}
                    disabled={busy}
                  >
                    <Ionicons name="checkmark-outline" size={16} color={colors.accentDark} />
                    <Text style={styles.dismissText}>Dismiss</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => removePost(report)}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        <Text style={styles.deleteText}>Delete</Text>
                      </>
                    )}
                  </Pressable>
                </View>
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
  reporterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  reporterText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
  reporterName: { fontFamily: fonts.sansSemibold, color: colors.foreground },
  reasonBox: {
    backgroundColor: colors.accentTintFaint,
    borderRadius: colors.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  reasonLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.muted,
    marginBottom: 3,
  },
  reasonText: { fontFamily: fonts.sans, fontSize: 14, color: colors.foreground, lineHeight: 20 },
  noReason: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 12, fontStyle: "italic" },
  postPreview: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    padding: 14,
    marginTop: 14,
  },
  postHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  postHeadText: { flex: 1 },
  postAuthor: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  postTime: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: colors.accentTint,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
    marginTop: 10,
  },
  tagText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.accentDark, letterSpacing: 0.2 },
  postBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.foreground, marginTop: 9 },
  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: colors.radius,
    backgroundColor: colors.accentTintFaint,
    marginTop: 10,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: colors.radius,
    paddingVertical: 11,
    borderWidth: 1,
  },
  openBtn: { backgroundColor: colors.card, borderColor: colors.cardBorder },
  openText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  dismissBtn: { backgroundColor: colors.accentTint, borderColor: colors.accentBorderMd },
  dismissText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accentDark },
  deleteBtn: { backgroundColor: "rgba(217, 97, 79, 0.10)", borderColor: "rgba(217, 97, 79, 0.30)" },
  deleteText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.danger },
  guard: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  guardTitle: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground, marginTop: 8 },
  guardText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center" },
});
