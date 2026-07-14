import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useNotices } from "@/contexts/NoticesContext";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { MotionListItem } from "@/components/Motion";

// Shows the signed-in member their moderation notices at the top of the feed: a
// block notice (an admin hid their posts) and any warnings an admin sent. The
// member can dismiss a warning; the block notice clears only when an admin
// unblocks them. Renders nothing when there are no notices. Notices are sourced
// from the app-wide NoticesContext, so dismissing one here also clears the
// community tab badge everywhere.
export function MemberNotices() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const { notices, refresh, dismiss } = useNotices();
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  // Pull the freshest notices whenever the feed gains focus, on top of the
  // context's background poll, so a just-sent notice shows without delay.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onDismiss = useCallback(
    async (id: string) => {
      setDismissingId(id);
      try {
        await dismiss(id);
      } catch {
        // The context restores the notice on failure; nothing more to do here.
      } finally {
        setDismissingId(null);
      }
    },
    [dismiss]
  );

  if (notices.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {notices.map((n) => {
        const isBlock = n.kind === "block";
        return (
          <MotionListItem
            key={n.id}
            style={[styles.card, isBlock ? styles.blockCard : styles.warnCard]}
          >
            <View style={styles.head}>
              <Ionicons
                name={isBlock ? "remove-circle" : "warning"}
                size={18}
                color={isBlock ? colors.danger : colors.highlight}
              />
              <Text style={[styles.title, isBlock ? styles.blockTitle : styles.warnTitle]}>
                {isBlock ? "Your account is blocked" : "A note from your admin"}
              </Text>
              {!isBlock ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => onDismiss(n.id)}
                  disabled={dismissingId === n.id}
                  style={styles.dismissBtn}
                >
                  {dismissingId === n.id ? (
                    <ActivityIndicator size="small" color={colors.muted} />
                  ) : (
                    <Ionicons name="close" size={18} color={colors.muted} />
                  )}
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.message}>{n.message}</Text>
            {!isBlock ? (
              <Pressable
                onPress={() => onDismiss(n.id)}
                disabled={dismissingId === n.id}
                style={styles.ackBtn}
              >
                <Text style={styles.ackText}>Got it</Text>
              </Pressable>
            ) : null}
          </MotionListItem>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { gap: 12, marginTop: 16 },
  card: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  blockCard: {
    backgroundColor: "rgba(217, 97, 79, 0.08)",
    borderColor: "rgba(217, 97, 79, 0.30)",
  },
  warnCard: {
    backgroundColor: colors.highlightTint,
    borderColor: colors.highlightBorder,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 14 },
  blockTitle: { color: colors.danger },
  warnTitle: { color: colors.highlight },
  dismissBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  message: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
    marginTop: 8,
  },
  ackBtn: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.highlightBorder,
    backgroundColor: colors.highlightTintMd,
  },
  ackText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.highlight },
});
