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
  Modal,
  TextInput,
  KeyboardAvoidingView,
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
  blockAuthor,
  communityPhotoUri,
  deletePost,
  dismissReportsForPost,
  fetchReports,
  timeAgo,
  unblockAuthor,
  unwarnAuthor,
  warnAuthor,
  type ReportGroup,
} from "@/lib/community";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

// Prefilled into the warn composer so an admin can send a clear note in one tap
// or tweak it first. No em dashes per the project's copy rules.
const DEFAULT_WARN_MESSAGE =
  "Your recent post was reported by other members. Please review our community guidelines and keep posts kind and on topic. This is a friendly heads up, not a block.";

const MAX_WARN_CHARS = 500;

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

  const [reports, setReports] = useState<ReportGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Warn composer state. `warnTarget` holds the group being warned (null when
  // the modal is closed); `warnText` is the editable message.
  const [warnTarget, setWarnTarget] = useState<ReportGroup | null>(null);
  const [warnText, setWarnText] = useState("");
  const [warnSending, setWarnSending] = useState(false);

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
          <Text style={styles.guardTitle}>Admins only</Text>
          <Text style={styles.guardText}>This area is reserved for the Florish admin account.</Text>
          <Button label="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: 20, width: 200 }} />
        </View>
      </GradientBackground>
    );
  }

  const removePost = (group: ReportGroup) => {
    const plural = group.reportCount === 1 ? "report" : "reports";
    confirmAction(
      "Delete post",
      `This permanently removes the post for everyone. All ${group.reportCount} ${plural} will clear too.`,
      "Delete",
      async () => {
        if (!token) return;
        setBusyId(group.post.id);
        try {
          await deletePost({ token, id: group.post.id });
          setReports((prev) => (prev ? prev.filter((g) => g.post.id !== group.post.id) : prev));
        } catch (e: any) {
          notify("Could not delete post", e?.message ?? "Please try again.");
        } finally {
          setBusyId(null);
        }
      }
    );
  };

  const toggleBlock = (group: ReportGroup) => {
    const author = group.post.author;
    const blocking = !group.authorBlocked;
    const run = async () => {
      if (!token) return;
      setBusyId(group.post.id);
      try {
        if (blocking) await blockAuthor({ token, authorId: author.id });
        else await unblockAuthor({ token, authorId: author.id });
        // One author can have several reported posts in the queue; reflect the
        // new block state on every group by that author.
        setReports((prev) =>
          prev
            ? prev.map((g) =>
                g.post.author.id === author.id ? { ...g, authorBlocked: blocking } : g
              )
            : prev
        );
      } catch (e: any) {
        notify(
          blocking ? "Could not block member" : "Could not unblock member",
          e?.message ?? "Please try again."
        );
      } finally {
        setBusyId(null);
      }
    };
    if (blocking) {
      confirmAction(
        "Block member",
        `${author.name}'s posts will be hidden from everyone's feed. You can unblock them anytime.`,
        "Block",
        run
      );
    } else {
      void run();
    }
  };

  const openWarn = (group: ReportGroup) => {
    setWarnTarget(group);
    setWarnText(DEFAULT_WARN_MESSAGE);
  };

  const closeWarn = () => {
    if (warnSending) return;
    setWarnTarget(null);
    setWarnText("");
  };

  const sendWarn = async () => {
    if (!token || !warnTarget) return;
    const message = warnText.trim();
    if (!message) {
      notify("Add a message", "Please write a short warning before sending.");
      return;
    }
    const authorId = warnTarget.post.author.id;
    setWarnSending(true);
    try {
      await warnAuthor({ token, authorId, message });
      // One author can have several reported posts in the queue; reflect the new
      // warning state on every group by that author.
      setReports((prev) =>
        prev
          ? prev.map((g) => (g.post.author.id === authorId ? { ...g, authorWarned: true } : g))
          : prev
      );
      setWarnTarget(null);
      setWarnText("");
      notify("Warning sent", "The member will see your note the next time they open the feed.");
    } catch (e: any) {
      notify("Could not warn member", e?.message ?? "Please try again.");
    } finally {
      setWarnSending(false);
    }
  };

  const withdrawWarn = (group: ReportGroup) => {
    const author = group.post.author;
    confirmAction(
      "Withdraw warning",
      `${author.name}'s warning will be removed. They will no longer see it.`,
      "Withdraw",
      async () => {
        if (!token) return;
        setBusyId(group.post.id);
        try {
          await unwarnAuthor({ token, authorId: author.id });
          setReports((prev) =>
            prev
              ? prev.map((g) =>
                  g.post.author.id === author.id ? { ...g, authorWarned: false } : g
                )
              : prev
          );
        } catch (e: any) {
          notify("Could not withdraw warning", e?.message ?? "Please try again.");
        } finally {
          setBusyId(null);
        }
      }
    );
  };

  const dismiss = (group: ReportGroup) => {
    const plural = group.reportCount === 1 ? "report" : "reports";
    confirmAction(
      "Dismiss reports",
      `This clears all ${group.reportCount} ${plural} for this post but keeps the post visible.`,
      "Dismiss",
      async () => {
        if (!token) return;
        setBusyId(group.post.id);
        try {
          await dismissReportsForPost({ token, postId: group.post.id });
          setReports((prev) => (prev ? prev.filter((g) => g.post.id !== group.post.id) : prev));
        } catch (e: any) {
          notify("Could not dismiss reports", e?.message ?? "Please try again.");
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
          eyebrow="ADMIN"
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
          reports.map((group) => {
            const meta = POST_TYPE_META[group.post.type];
            const busy = busyId === group.post.id;
            return (
              <View key={group.post.id} style={styles.card}>
                <Pressable
                  style={styles.reporterRow}
                  onPress={() => router.push(`/community/${group.post.id}`)}
                >
                  <Ionicons name="flag" size={15} color={colors.danger} />
                  <Text style={styles.reporterText} numberOfLines={1}>
                    Reported by{" "}
                    <Text style={styles.reporterName}>
                      {group.reportCount} {group.reportCount === 1 ? "member" : "members"}
                    </Text>{" "}
                    · {timeAgo(group.latestCreatedAt)}
                  </Text>
                </Pressable>

                <View style={styles.reportList}>
                  {group.reports.map((entry, i) => (
                    <View
                      key={entry.id}
                      style={[styles.reportItem, i > 0 && styles.reportItemDivider]}
                    >
                      <View style={styles.reportItemHead}>
                        <Avatar author={entry.reporter} size={24} />
                        <Text style={styles.reportItemName} numberOfLines={1}>
                          {entry.reporter.name}
                        </Text>
                        <Text style={styles.reportItemTime}>{timeAgo(entry.createdAt)}</Text>
                      </View>
                      {entry.reason ? (
                        <Text style={styles.reportItemReason}>{entry.reason}</Text>
                      ) : (
                        <Text style={styles.reportItemNoReason}>No reason given</Text>
                      )}
                    </View>
                  ))}
                </View>

                <Pressable
                  style={styles.postPreview}
                  onPress={() => router.push(`/community/${group.post.id}`)}
                >
                  <View style={styles.postHead}>
                    <Avatar author={group.post.author} size={38} />
                    <View style={styles.postHeadText}>
                      <Text style={styles.postAuthor} numberOfLines={1}>
                        {group.post.author.name}
                      </Text>
                      <Text style={styles.postTime}>{timeAgo(group.post.createdAt)}</Text>
                    </View>
                    {group.authorReportCount > 1 ? (
                      <View style={styles.repeatBadge}>
                        <Ionicons name="flag" size={11} color={colors.danger} />
                        <Text style={styles.repeatText}>
                          {group.authorReportCount}× reported
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {group.authorBlocked ? (
                    <View style={styles.blockedNote}>
                      <Ionicons name="remove-circle" size={13} color={colors.danger} />
                      <Text style={styles.blockedNoteText}>
                        Blocked: this member's posts are hidden from the feed.
                      </Text>
                    </View>
                  ) : group.authorWarned ? (
                    <View style={styles.warnedNote}>
                      <Ionicons name="warning" size={13} color={colors.highlight} />
                      <Text style={styles.warnedNoteText}>
                        Warned: this member has an active warning.
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.tag}>
                    <Ionicons name={meta.icon} size={12} color={colors.accentDark} />
                    <Text style={styles.tagText}>{meta.label}</Text>
                  </View>

                  <Text style={styles.postBody} numberOfLines={6}>
                    {group.post.body}
                  </Text>

                  {group.post.photoKey ? (
                    <Image
                      source={{ uri: communityPhotoUri(group.post.photoKey) }}
                      style={styles.photo}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : null}
                </Pressable>

                <View style={styles.actions}>
                  <Pressable
                    style={[styles.actionBtn, styles.openBtn]}
                    onPress={() => router.push(`/community/${group.post.id}`)}
                    disabled={busy}
                  >
                    <Ionicons name="open-outline" size={16} color={colors.foreground} />
                    <Text style={styles.openText}>Open</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.dismissBtn]}
                    onPress={() => dismiss(group)}
                    disabled={busy}
                  >
                    <Ionicons name="checkmark-outline" size={16} color={colors.accentDark} />
                    <Text style={styles.dismissText}>Dismiss</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => removePost(group)}
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

                <View style={styles.moderationRow}>
                  <Pressable
                    style={[
                      styles.actionBtn,
                      styles.warnBtn,
                      group.authorWarned && styles.unwarnBtn,
                    ]}
                    onPress={() => (group.authorWarned ? withdrawWarn(group) : openWarn(group))}
                    disabled={busy}
                  >
                    <Ionicons
                      name={group.authorWarned ? "checkmark-circle-outline" : "warning-outline"}
                      size={16}
                      color={colors.highlight}
                    />
                    <Text style={styles.warnText}>
                      {group.authorWarned ? "Warned" : "Warn author"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.actionBtn,
                      styles.blockBtn,
                      group.authorBlocked && styles.unblockBtn,
                    ]}
                    onPress={() => toggleBlock(group)}
                    disabled={busy}
                  >
                    <Ionicons
                      name={group.authorBlocked ? "refresh-outline" : "remove-circle-outline"}
                      size={16}
                      color={group.authorBlocked ? colors.accentDark : colors.danger}
                    />
                    <Text
                      style={[
                        styles.blockText,
                        group.authorBlocked && styles.unblockText,
                      ]}
                    >
                      {group.authorBlocked ? "Unblock" : "Block author"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={!!warnTarget}
        transparent
        animationType="fade"
        onRequestClose={closeWarn}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Ionicons name="warning" size={20} color={colors.highlight} />
              <Text style={styles.modalTitle}>
                Warn {warnTarget?.post.author.name ?? "member"}
              </Text>
            </View>
            <Text style={styles.modalSub}>
              They keep posting but see this note the next time they open the feed. Lighter than a
              block, and you can withdraw it later.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={warnText}
              onChangeText={(t) => setWarnText(t.slice(0, MAX_WARN_CHARS))}
              placeholder="Write a short, kind warning..."
              placeholderTextColor={colors.muted}
              multiline
              editable={!warnSending}
            />
            <Text style={styles.modalCount}>
              {warnText.length}/{MAX_WARN_CHARS}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={closeWarn}
                disabled={warnSending}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalSend, !warnText.trim() && styles.modalSendOff]}
                onPress={sendWarn}
                disabled={warnSending || !warnText.trim()}
              >
                {warnSending ? (
                  <ActivityIndicator size="small" color={colors.onPrimaryStrong} />
                ) : (
                  <Text style={styles.modalSendText}>Send warning</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  reportList: {
    backgroundColor: colors.accentTintFaint,
    borderRadius: colors.radius,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 12,
  },
  reportItem: { paddingVertical: 10 },
  reportItemDivider: { borderTopWidth: 1, borderTopColor: colors.cardBorder },
  reportItemHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  reportItemName: {
    flex: 1,
    fontFamily: fonts.sansSemibold,
    fontSize: 13,
    color: colors.foreground,
  },
  reportItemTime: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  reportItemReason: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
    marginTop: 6,
  },
  reportItemNoReason: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    fontStyle: "italic",
    marginTop: 6,
  },
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
  moderationRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  warnBtn: {
    backgroundColor: colors.highlightTint,
    borderColor: colors.highlightBorder,
  },
  unwarnBtn: {
    backgroundColor: colors.highlightTintMd,
    borderColor: colors.highlightBorder,
  },
  warnText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.highlight },
  blockBtn: {
    backgroundColor: "rgba(217, 97, 79, 0.10)",
    borderColor: "rgba(217, 97, 79, 0.30)",
  },
  blockText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.danger },
  unblockBtn: { backgroundColor: colors.accentTint, borderColor: colors.accentBorderMd },
  unblockText: { color: colors.accentDark },
  repeatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(217, 97, 79, 0.10)",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  repeatText: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.danger },
  blockedNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "rgba(217, 97, 79, 0.08)",
    borderRadius: colors.radius,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  blockedNoteText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.danger, lineHeight: 17 },
  warnedNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: colors.highlightTint,
    borderRadius: colors.radius,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  warnedNoteText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.highlight, lineHeight: 17 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(74, 46, 51, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
  },
  modalHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalTitle: { flex: 1, fontFamily: fonts.serifSemibold, fontSize: 19, color: colors.foreground },
  modalSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 19,
    marginTop: 8,
  },
  modalInput: {
    minHeight: 110,
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
    marginTop: 14,
    textAlignVertical: "top",
  },
  modalCount: {
    alignSelf: "flex-end",
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  modalBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: colors.radius,
    paddingVertical: 12,
    borderWidth: 1,
  },
  modalCancel: { backgroundColor: colors.card, borderColor: colors.cardBorder },
  modalCancelText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  modalSend: { backgroundColor: colors.accent, borderColor: colors.accent },
  modalSendOff: { opacity: 0.45 },
  modalSendText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.onPrimaryStrong },
  guard: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  guardTitle: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground, marginTop: 8 },
  guardText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center" },
});
