import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

// Shown to a verified coach. Coach tools are unlocked automatically by the
// server-verified login, so there's no passcode to enter or rotate — this is
// just a reminder of what uploading here means, plus a link to the separate
// onboarding thank-you video the coach manages globally.
export function AdminControls() {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <View style={styles.note}>
        <Ionicons name="shield-checkmark" size={15} color={colors.accent} />
        <Text style={styles.noteText}>
          You're verified as the admin. Anything you upload here is visible to every member.
        </Text>
      </View>

      <Pressable style={styles.link} onPress={() => router.push("/admin/upload-thank-you")}>
        <Ionicons name="heart-outline" size={18} color={colors.accent} />
        <Text style={styles.linkText}>Onboarding thank-you video</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, gap: 12 },
  note: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: colors.accentTint,
    borderWidth: 1,
    borderColor: colors.accentBorderMd,
    borderRadius: colors.radius,
    padding: 14,
  },
  noteText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.foreground, lineHeight: 18 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  linkText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
});
