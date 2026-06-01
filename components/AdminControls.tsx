import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

// Shown to a verified coach. Coach tools are unlocked automatically by the
// server-verified login, so there's no passcode to enter or rotate — this is
// just a reminder of what uploading here means.
export function AdminControls() {
  return (
    <View style={styles.wrap}>
      <View style={styles.note}>
        <Ionicons name="shield-checkmark" size={15} color={colors.accent} />
        <Text style={styles.noteText}>
          You're verified as the coach. Anything you upload here is visible to every member.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
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
});
