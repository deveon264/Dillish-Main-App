import React from "react";
import { View, Text, StyleSheet, Pressable as StructuralPressable, Modal, ActivityIndicator } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

type Props = {
  visible: boolean;
  onClose: () => void;
  // The viewer authored this post (only delete is offered).
  isOwn: boolean;
  // The viewer is the coach (can delete anyone's post, and pin/unpin it).
  isAdmin: boolean;
  // Whether the post is currently pinned (drives the pin/unpin label).
  isPinned?: boolean;
  authorName: string;
  busy?: boolean;
  onReport: () => void;
  onBlock: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
};

// Cross-platform action sheet for a post's moderation options. Using a Modal
// (rather than ActionSheetIOS) keeps the same look and behavior on web, iOS, and
// Android.
export function PostMenu({
  visible,
  onClose,
  isOwn,
  isAdmin,
  isPinned,
  authorName,
  busy,
  onReport,
  onBlock,
  onEdit,
  onDelete,
  onTogglePin,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const canDelete = isOwn || isAdmin;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <StructuralPressable style={styles.backdrop} onPress={onClose}>
        <StructuralPressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <>
              {isOwn ? (
                <Row icon="create-outline" label="Edit post" onPress={onEdit} />
              ) : (
                <>
                  <Row icon="flag-outline" label="Report post" onPress={onReport} />
                  <Row icon="ban-outline" label={`Block ${authorName}`} onPress={onBlock} />
                </>
              )}
              {isAdmin ? (
                <Row
                  icon={isPinned ? "bookmark" : "bookmark-outline"}
                  label={isPinned ? "Unpin from top" : "Pin to top"}
                  onPress={onTogglePin}
                />
              ) : null}
              {canDelete ? (
                <Row icon="trash-outline" label="Delete post" danger onPress={onDelete} />
              ) : null}
              <Row icon="close-outline" label="Cancel" muted onPress={onClose} />
            </>
          )}
        </StructuralPressable>
      </StructuralPressable>
    </Modal>
  );
}

function Row({
  icon,
  label,
  onPress,
  danger,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const color = danger ? colors.danger : muted ? colors.muted : colors.foreground;
  return (
    <Pressable
      pressedScale={0.985}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16,17,17,0.45)",
    justifyContent: "flex-end",
    padding: 16,
  },
  sheet: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 8,
    gap: 2,
  },
  busy: { paddingVertical: 28, alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: colors.radius,
  },
  rowPressed: { backgroundColor: colors.accentTintFaint },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: 15 },
});
