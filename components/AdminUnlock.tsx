import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

// Shown to a signed-in coach who has not yet proven their identity to the
// server. Exchanging the passcode for a signed token is what actually grants
// upload/delete access — UI gating alone is cosmetic.
export function AdminUnlock({ onUnlocked }: { onUnlocked?: () => void }) {
  const { unlockAdmin } = useAuth();
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!passcode.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await unlockAdmin(passcode);
    setBusy(false);
    if (res.ok) {
      setPasscode("");
      onUnlocked?.();
    } else {
      setError(res.error ?? "Could not unlock coach tools");
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="lock-closed-outline" size={18} color={colors.accent} />
        <Text style={styles.title}>Unlock coach tools</Text>
      </View>
      <Text style={styles.help}>
        Enter your coach passcode to upload and manage videos. This verifies you with the server.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Coach passcode"
        placeholderTextColor={colors.mutedForeground}
        value={passcode}
        onChangeText={setPasscode}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.btn, busy && { opacity: 0.7 }]} onPress={submit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.btnText}>Unlock</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 18,
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.foreground },
  help: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, lineHeight: 18 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
  },
  error: { fontFamily: fonts.sansMedium, fontSize: 13, color: "#e06b6b" },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: colors.radius,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimary },
});
