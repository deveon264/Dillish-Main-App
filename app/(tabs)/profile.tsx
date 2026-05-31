import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { todayKey } from "@/lib/storage";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const GOAL_LABELS: Record<string, string> = {
  "lose-weight": "Lose Weight",
  tone: "Tone & Sculpt",
  strength: "Build Strength",
  flexibility: "Improve Flexibility",
  wellness: "Mindful Wellness",
  energy: "Boost Energy",
};

export default function Profile() {
  const router = useRouter();
  const insets = useInsets();
  const { user, logout, updateUser } = useAuth();
  const { profile, completions, calorieLogs, weightLogs, updateProfile } = useData();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [notifications, setNotifications] = useState(true);

  const totalWorkouts = completions.length;
  const totalMeals = calorieLogs.length;

  const streak = useMemo(() => {
    const days = new Set(completions.map((c) => todayKey(new Date(c.ts))));
    let count = 0;
    const d = new Date();
    for (;;) {
      if (days.has(todayKey(d))) {
        count++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [completions]);

  const sortedWeights = useMemo(
    () => [...weightLogs].sort((a, b) => b.ts - a.ts),
    [weightLogs]
  );
  const currentWeight = sortedWeights[0]?.weight ?? profile.weight ?? null;
  const startWeight = sortedWeights.length
    ? sortedWeights[sortedWeights.length - 1].weight
    : profile.startWeight ?? currentWeight;

  const weightProgress = useMemo(() => {
    if (startWeight == null || currentWeight == null || !profile.goalWeight) return null;
    const total = startWeight - profile.goalWeight;
    const done = startWeight - currentWeight;
    if (total === 0) return null;
    return Math.max(0, Math.min(1, done / total));
  }, [startWeight, currentWeight, profile.goalWeight]);

  const bmi = useMemo(() => {
    if (currentWeight == null || profile.height == null || profile.height <= 0) return null;
    const kg = profile.weightUnit === "lbs" ? currentWeight * 0.453592 : currentWeight;
    const cm = profile.heightUnit === "ft" ? profile.height * 30.48 : profile.height;
    if (cm <= 0) return null;
    const m = cm / 100;
    return kg / (m * m);
  }, [currentWeight, profile.height, profile.weightUnit, profile.heightUnit]);

  const fmtStat = (n: number | null, digits = 0) =>
    n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(digits);

  const saveName = async () => {
    if (name.trim()) await updateUser({ name: name.trim() });
    setEditing(false);
  };

  const firstName = (user?.name ?? "F").charAt(0).toUpperCase();

  const PROFILE_TABS = ["Profile", "Plan", "History", "Settings"];

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>FLORISH</Text>
        <Text style={styles.title}>
          My <Text style={styles.titleItalic}>Profile</Text>
        </Text>

        <View style={styles.tabBar}>
          {PROFILE_TABS.map((t) =>
            t === "Profile" ? (
              <LinearGradient
                key={t}
                colors={colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tabActive}
              >
                <Text style={styles.tabActiveText}>{t}</Text>
              </LinearGradient>
            ) : (
              <View key={t} style={styles.tab}>
                <Text style={styles.tabText}>{t}</Text>
              </View>
            )
          )}
        </View>

        <Card style={styles.profileCard}>
          {editing ? (
            <View style={{ flex: 1 }}>
              <Input value={name} onChangeText={setName} placeholder="Your name" style={{ marginBottom: 0 }} />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Button label="Save" onPress={saveName} style={{ flex: 1 }} />
                <Button label="Cancel" variant="outline" onPress={() => setEditing(false)} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={styles.profileRow}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{firstName}</Text>
                </View>
                <Pressable
                  style={styles.cameraBadge}
                  onPress={() => { setName(user?.name ?? ""); setEditing(true); }}
                  hitSlop={8}
                >
                  <Ionicons name="camera" size={13} color={colors.onPrimary} />
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{user?.name}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Ionicons name="sparkles" size={12} color={colors.accent} />
                    <Text style={styles.badgeText}>Premium</Text>
                  </View>
                  <View style={styles.badge}>
                    <Ionicons name="flame" size={12} color={colors.primary} />
                    <Text style={styles.badgeText}>{streak} day streak</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statNum}>{fmtStat(profile.age)}</Text>
            <Text style={styles.statLbl}>Age</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNum}>{fmtStat(currentWeight, 1)}</Text>
            <Text style={styles.statLbl}>{profile.weightUnit}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNum}>{fmtStat(profile.height)}</Text>
            <Text style={styles.statLbl}>{profile.heightUnit}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNum}>{fmtStat(bmi, 1)}</Text>
            <Text style={styles.statLbl}>BMI</Text>
          </Card>
        </View>

        {weightProgress != null ? (
          <Card style={{ marginTop: 16 }}>
            <View style={styles.weightHead}>
              <Text style={styles.cardTitle}>Weight goal</Text>
              <Text style={styles.weightVals}>
                {currentWeight}{profile.weightUnit} → {profile.goalWeight}{profile.weightUnit}
              </Text>
            </View>
            <ProgressBar progress={weightProgress} height={8} style={{ marginTop: 14 }} />
            <Text style={styles.weightPct}>{Math.round(weightProgress * 100)}% of the way there</Text>
          </Card>
        ) : null}

        <Text style={styles.section}>Your goals</Text>
        <View style={styles.goalChips}>
          {profile.goals.length === 0 ? (
            <Text style={styles.emptyText}>No goals selected</Text>
          ) : (
            profile.goals.map((g) => (
              <View key={g} style={styles.goalChip}>
                <Text style={styles.goalChipText}>{GOAL_LABELS[g] ?? g}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.section}>Hydration goal</Text>
        <Card>
          <View style={styles.stepRow}>
            <Text style={styles.cardTitle}>Daily water</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => updateProfile({ waterGoalMl: Math.max(1000, profile.waterGoalMl - 250) })}
                hitSlop={6}
              >
                <Ionicons name="remove" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={styles.stepVal}>{(profile.waterGoalMl / 1000).toFixed(2)}L</Text>
              <Pressable
                style={styles.stepBtn}
                onPress={() => updateProfile({ waterGoalMl: Math.min(5000, profile.waterGoalMl + 250) })}
                hitSlop={6}
              >
                <Ionicons name="add" size={18} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
        </Card>

        <Text style={styles.section}>Settings</Text>
        <Card style={{ paddingVertical: 4 }}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color={colors.accent} />
              <Text style={styles.settingLabel}>Reminders</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: colors.track, true: colors.primary }}
              thumbColor={colors.foreground}
            />
          </View>
          <View style={styles.settingDivider} />
          <SettingLink icon="shield-checkmark-outline" label="Privacy" />
          <View style={styles.settingDivider} />
          <SettingLink icon="help-circle-outline" label="Help & Support" />
        </Card>

        <Button
          label="Log Out"
          icon="log-out-outline"
          variant="outline"
          onPress={async () => {
            await logout();
            router.replace("/welcome");
          }}
          style={{ marginTop: 24 }}
        />
        <Text style={styles.version}>Florish · v1.0</Text>
      </ScrollView>
    </GradientBackground>
  );
}

function SettingLink({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <Pressable style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={20} color={colors.accent} />
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  brand: { fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 3, color: colors.mutedForeground, marginBottom: 4 },
  title: { fontFamily: fonts.serif, fontSize: 36, color: colors.foreground, marginBottom: 18 },
  titleItalic: { fontFamily: fonts.serifItalic, color: colors.foreground },
  tabBar: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    padding: 4,
    marginBottom: 18,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center", borderRadius: colors.radiusSm },
  tabActive: { flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center", borderRadius: colors.radiusSm },
  tabText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  tabActiveText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.onPrimary },
  profileCard: {},
  profileRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarWrap: { width: 64, height: 64 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.serifSemibold, fontSize: 28, color: colors.accent },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
  profileEmail: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 16, paddingHorizontal: 4 },
  statNum: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.accent },
  statLbl: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 2, textAlign: "center" },
  cardTitle: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.foreground },
  weightHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weightVals: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.accent },
  weightPct: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 8 },
  section: { fontFamily: fonts.serif, fontSize: 22, color: colors.foreground, marginTop: 26, marginBottom: 14 },
  goalChips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  goalChip: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  goalChipText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepVal: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.foreground, width: 64, textAlign: "center" },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, paddingHorizontal: 14 },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingLabel: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.foreground },
  settingDivider: { height: 1, backgroundColor: colors.cardBorder, marginHorizontal: 14 },
  version: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, textAlign: "center", marginTop: 18 },
});
