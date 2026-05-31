import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

// Shown to a verified coach. Surfaces the in-app controls that previously only
// existed as plumbing: rotating the coach passcode and explicitly locking coach
// tools again (e.g. on a shared device) instead of waiting for the 12h expiry.
export function AdminControls({ onLocked }: { onLocked?: () => void }) {
  const { lockAdmin, changePasscode } = useAuth();
  const [showChange, setShowChange] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setSuccess(false);
  };

  const toggleChange = () => {
    resetForm();
    setShowChange((v) => !v);
  };

  const submitChange = async () => {
    if (busy) return;
    setError(null);
    setSuccess(false);
    if (!current.trim() || !next.trim()) {
      setError("Fill in every field.");
      return;
    }
    if (next.trim().length < 6) {
      setError("New passcode must be at least 6 characters.");
      return;
    }
    if (next.trim() !== confirm.trim()) {
      setError("New passcodes don't match.");
      return;
    }
    setBusy(true);
    const res = await changePasscode(current, next);
    setBusy(false);
    if (res.ok) {
      resetForm();
      setSuccess(true);
      setShowChange(false);
    } else {
      setError(res.error ?? "Could not change passcode");
    }
  };

  const lock = async () => {
    await lockAdmin();
    onLocked?.();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.note}>
        <Ionicons name="shield-checkmark" size={15} color={colors.accent} />
        <Text style={styles.noteText}>
          You're verified as the coach. Anything you upload here is visible to every member.
        </Text>
      </View>

      {success ? (
        <View style={styles.successRow}>
          <Ionicons name="checkmark-circle" size={15} color={colors.accent} />
          <Text style={styles.successText}>Passcode updated. Use it next time you unlock.</Text>
        </View>
      ) : null}

      {showChange ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Change coach passcode</Text>
          <Text style={styles.help}>
            Confirm your current passcode, then set a new one. It takes effect immediately for
            future unlocks.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Current passcode"
            placeholderTextColor={colors.mutedForeground}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="New passcode"
            placeholderTextColor={colors.mutedForeground}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm new passcode"
            placeholderTextColor={colors.mutedForeground}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={submitChange}
            returnKeyType="go"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.formBtnRow}>
            <Pressable
              style={[styles.btn, styles.btnPrimary, busy && { opacity: 0.7 }]}
              onPress={submitChange}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.btnPrimaryText}>Save passcode</Text>
              )}
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={toggleChange} disabled={busy}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, styles.actionGhost]} onPress={toggleChange}>
            <Ionicons name="key-outline" size={16} color={colors.accent} />
            <Text style={styles.actionGhostText}>Change passcode</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionGhost]} onPress={lock}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.accent} />
            <Text style={styles.actionGhostText}>Lock coach tools</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, gap: 12 },
  note: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: "rgba(201,137,122,0.12)",
    borderWidth: 1,
    borderColor: "rgba(201,137,122,0.3)",
    borderRadius: colors.radius,
    padding: 14,
  },
  noteText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.foreground, lineHeight: 18 },
  successRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  successText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: colors.radius,
  },
  actionGhost: { borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card },
  actionGhostText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 18,
    gap: 12,
  },
  cardTitle: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.foreground },
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
  formBtnRow: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, borderRadius: colors.radius, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimary },
  btnGhost: { borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card },
  btnGhostText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.muted },
});
