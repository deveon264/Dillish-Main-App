import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, InteractionManager, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";
import { avatarUri } from "@/lib/avatar";
import { useOptimisticAvatar } from "@/lib/useOptimisticAvatar";
import { useData } from "@/contexts/DataContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  PLANS,
  PLAN_ORDER,
  type PlanKey,
  daysLeft as subDaysLeft,
  isSubscriptionActive,
  formatRenewalShort,
  formatRenewalLong,
} from "@/lib/subscription";
import { useInsets } from "@/hooks/useInsets";
import { todayKey } from "@/lib/storage";
import { colors, palette } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

const FITNESS_GOALS = [
  { id: "lose-weight", label: "Lose Weight", icon: "flame" as const },
  { id: "build-muscle", label: "Build Muscle", icon: "barbell" as const },
  { id: "stay-fit", label: "Stay Fit", icon: "pulse" as const },
];

const LEGACY_GOAL_MAP: Record<string, string> = {
  "lose-weight": "lose-weight",
  tone: "stay-fit",
  strength: "build-muscle",
  flexibility: "stay-fit",
  wellness: "stay-fit",
  energy: "stay-fit",
};

export default function Profile() {
  const router = useRouter();
  const insets = useInsets();
  const { user, isAdmin, logout, updateUser, uploadAvatar, removeAvatar: removeAvatarFn } = useAuth();
  const { profile, completions, calorieLogs, weightLogs, waterLogs, updateProfile } = useData();
  const { subscription, switchPlan, cancel, resume, subscribe } = useSubscription();

  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("Profile");
  const [notifs, setNotifs] = useState({
    workout: true,
    hydration: true,
    streak: true,
    content: false,
    weekly: true,
  });
  const [name, setName] = useState(user?.name ?? "");
  const [avatarModal, setAvatarModal] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const pickingRef = useRef(false);
  const pendingPickRef = useRef<"camera" | "library" | null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState(user?.email ?? "");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [goalWeightInput, setGoalWeightInput] = useState(
    profile.goalWeight != null ? String(profile.goalWeight) : ""
  );
  const [goalWeightError, setGoalWeightError] = useState<string | null>(null);
  const [waterGoalInput, setWaterGoalInput] = useState((profile.waterGoalMl / 1000).toFixed(2));
  const [waterGoalError, setWaterGoalError] = useState<string | null>(null);
  const [billingModal, setBillingModal] = useState(false);
  const [planBusy, setPlanBusy] = useState<PlanKey | "cancel" | "resume" | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    setGoalWeightInput(profile.goalWeight != null ? String(profile.goalWeight) : "");
  }, [profile.goalWeight]);

  useEffect(() => {
    setWaterGoalInput((profile.waterGoalMl / 1000).toFixed(2));
  }, [profile.waterGoalMl]);

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

  const todayWaterMl = useMemo(() => {
    const tk = todayKey();
    return waterLogs
      .filter((l) => todayKey(new Date(l.ts)) === tk)
      .reduce((s, l) => s + l.amountMl, 0);
  }, [waterLogs]);

  const waterProgress = useMemo(
    () => (profile.waterGoalMl > 0 ? Math.min(1, todayWaterMl / profile.waterGoalMl) : 0),
    [todayWaterMl, profile.waterGoalMl]
  );

  const bmi = useMemo(() => {
    if (currentWeight == null || profile.height == null || profile.height <= 0) return null;
    const kg = profile.weightUnit === "lbs" ? currentWeight * 0.453592 : currentWeight;
    const cm = profile.heightUnit === "ft" ? profile.height * 30.48 : profile.height;
    if (cm <= 0) return null;
    const m = cm / 100;
    return kg / (m * m);
  }, [currentWeight, profile.height, profile.weightUnit, profile.heightUnit]);

  const fmtStat = (n: number | null, digits = 0) =>
    n == null ? "-" : Number.isInteger(n) ? String(n) : n.toFixed(digits);

  const kgToGo = useMemo(() => {
    if (currentWeight == null || profile.goalWeight == null) return null;
    return Math.abs(currentWeight - profile.goalWeight);
  }, [currentWeight, profile.goalWeight]);

  const selectedGoal = useMemo(() => {
    const raw = profile.goals[0];
    if (raw && FITNESS_GOALS.some((g) => g.id === raw)) return raw;
    return (raw && LEGACY_GOAL_MAP[raw]) || "lose-weight";
  }, [profile.goals]);

  const selectGoal = (id: string) => {
    if (id !== selectedGoal || profile.goals[0] !== id) updateProfile({ goals: [id] });
  };

  const saveGoalWeight = async () => {
    const trimmed = goalWeightInput.trim().replace(",", ".");
    const val = Number(trimmed);
    if (!trimmed || !Number.isFinite(val) || val <= 0) {
      setGoalWeightError("Enter a valid goal weight.");
      return;
    }
    setGoalWeightError(null);
    await updateProfile({ goalWeight: val });
  };

  const saveWaterGoal = async () => {
    const trimmed = waterGoalInput.trim().replace(",", ".");
    const val = Number(trimmed);
    if (!trimmed || !Number.isFinite(val) || val <= 0) {
      setWaterGoalError("Enter a valid water goal.");
      return;
    }
    const ml = Math.round(val * 1000);
    if (ml < 1000 || ml > 5000) {
      setWaterGoalError("Water goal must be between 1 and 5 L.");
      return;
    }
    setWaterGoalError(null);
    await updateProfile({ waterGoalMl: ml });
  };

  // --- Subscription / Plan tab -------------------------------------------
  const planActive = isSubscriptionActive(subscription);
  const currentPlan = PLANS[subscription.planKey] ?? PLANS.yearly;
  const planDaysLeft = subDaysLeft(subscription);
  const renewalShort = formatRenewalShort(subscription.currentPeriodEnd);
  const renewalLong = formatRenewalLong(subscription.currentPeriodEnd);
  const isTrial = subscription.status === "trialing";
  const willCancel = planActive && subscription.cancelAtPeriodEnd;

  const planStatusLabel = !planActive
    ? "Inactive"
    : willCancel
    ? "Cancels soon"
    : isTrial
    ? "Free trial"
    : "Active";

  const runPlanAction = async (
    key: PlanKey | "cancel" | "resume",
    fn: () => Promise<{ ok: boolean; error?: string }>
  ) => {
    if (planBusy) return;
    setPlanError(null);
    setPlanBusy(key);
    const res = await fn();
    if (!res.ok) setPlanError(res.error ?? "Something went wrong. Please try again.");
    setPlanBusy(null);
  };

  const onSwitchPlan = (key: PlanKey) =>
    runPlanAction(key, () => (planActive ? switchPlan(key) : subscribe(key)));
  const onCancelPlan = () => runPlanAction("cancel", () => cancel());
  const onResumePlan = () => runPlanAction("resume", () => resume());

  const saveName = async () => {
    if (name.trim()) await updateUser({ name: name.trim() });
    setEditing(false);
  };

  // Records which picker the user chose, then closes the sheet. The picker is
  // launched only AFTER the modal has fully gone away (see runPickAvatar /
  // onDismiss below), never in the same tick as the dismiss.
  const startPickAvatar = (mode: "camera" | "library") => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    setAvatarError("");
    pendingPickRef.current = mode;
    setAvatarModal(false);
    // `onDismiss` is iOS-only; it fires once the native modal view controller is
    // fully dismissed — the only safe moment to present the picker's own view
    // controller. On Android/web there is no such callback, so we wait for the
    // interaction/animation queue to clear (web uses a plain timeout) and launch
    // directly.
    if (Platform.OS !== "ios") {
      const launch = () => {
        const m = pendingPickRef.current;
        pendingPickRef.current = null;
        if (m) runPickAvatar(m);
      };
      if (Platform.OS === "web" || !InteractionManager?.runAfterInteractions) {
        setTimeout(launch, 400);
      } else {
        InteractionManager.runAfterInteractions(launch);
      }
    }
  };

  // Fired from the avatar Modal's onDismiss (iOS) once it has fully closed.
  const handleAvatarModalDismissed = () => {
    const m = pendingPickRef.current;
    pendingPickRef.current = null;
    if (m) runPickAvatar(m);
  };

  const runPickAvatar = async (mode: "camera" | "library") => {
    pickingRef.current = true;
    try {
      const perm =
        mode === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setAvatarError("Permission is required to add a photo.");
        return;
      }
      // No base64: the bytes upload straight to object storage from the file
      // (native) or blob (web), so they never travel inside the account record.
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      };
      const res =
        mode === "camera"
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      // Show the picked image instantly, before the upload round-trip. A
      // background effect warms the new canonical object-storage URL once the
      // upload finishes and then swaps to it.
      showPicked(asset.uri);
      const result = await uploadAvatar(asset.uri, asset.mimeType ?? "image/jpeg");
      if (!result.ok) {
        // Upload failed: drop the optimistic preview so we don't keep showing a
        // photo that didn't save, then surface the error.
        clearPicked();
        setAvatarError(result.error ?? "Couldn't add the photo. Please try again.");
        return;
      }
    } catch (e: any) {
      clearPicked();
      setAvatarError(e?.message ?? "Couldn't add the photo. Please try again.");
    } finally {
      pickingRef.current = false;
    }
  };

  const removeAvatar = async () => {
    setAvatarModal(false);
    setAvatarError("");
    // Drop any optimistic preview so the avatar falls back to initials at once.
    clearPicked();
    const result = await removeAvatarFn();
    if (!result.ok) setAvatarError(result.error ?? "Couldn't remove the photo. Please try again.");
  };

  const openEmailModal = () => {
    setEmailInput(user?.email ?? "");
    setEmailError("");
    setEmailSuccess(false);
    setEmailModal(true);
  };

  const saveEmail = async () => {
    const res = await updateUser({ email: emailInput });
    if (!res.ok) {
      setEmailError(res.error ?? "Couldn't update your email.");
      return;
    }
    setEmailError("");
    setEmailSuccess(true);
    setTimeout(() => setEmailModal(false), 900);
  };

  const firstName = (user?.name ?? "F").charAt(0).toUpperCase();
  const canonicalAvatar = avatarUri(user);
  // Instant profile photo: show the just-picked image right after an upload,
  // warm the canonical object-storage URL in the background, then swap to it.
  // Also clears the preview on a user switch.
  const { avatarSource, showPicked, clearPicked } = useOptimisticAvatar(
    canonicalAvatar,
    user?.id,
    Image.prefetch
  );

  const PROFILE_TABS = ["Profile", "Plan", "History", "Settings"];

  const NOTIF_ROWS: { key: keyof typeof notifs; title: string; sub: string }[] = [
    { key: "workout", title: "Workout Reminders", sub: "Daily at 7:00 AM" },
    { key: "hydration", title: "Hydration Reminders", sub: "Every 2 hours" },
    { key: "streak", title: "Streak Alerts", sub: "Don't break your streak!" },
    { key: "content", title: "New Content Alerts", sub: "New workouts from Dillish" },
    { key: "weekly", title: "Weekly Progress Report", sub: "Every Sunday evening" },
  ];

  const isMetric = profile.weightUnit === "kg";
  const PREF_ROWS = [
    { key: "units", title: "Units", sub: isMetric ? "Metric (kg, cm)" : "Imperial (lbs, ft)", value: isMetric ? "Metric" : "Imperial" },
    { key: "water", title: "Daily Water Goal", sub: `${profile.waterGoalMl.toLocaleString()} ml`, value: `${(profile.waterGoalMl / 1000).toFixed(1)} L` },
    { key: "calorie", title: "Daily Calorie Goal", sub: `${profile.calorieGoal.toLocaleString()} kcal`, value: String(profile.calorieGoal) },
    { key: "language", title: "Language", sub: "English", value: "EN" },
  ];

  const ACCOUNT_ROWS: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void }[] = [
    { key: "email", icon: "mail-outline", label: "Change Email", onPress: openEmailModal },
    { key: "password", icon: "lock-closed-outline", label: "Change Password" },
    { key: "privacy", icon: "document-text-outline", label: "Privacy Policy" },
    { key: "about", icon: "information-circle-outline", label: "About Florish" },
    { key: "support", icon: "headset-outline", label: "Support" },
  ];

  const PLAN_FEATURES = [
    "Unlimited workout videos with Dillish",
    "AI-powered calorie tracking",
    "Hydration & progress tracking",
    "Private progress photo gallery",
    "Push notifications & streak reminders",
    "Priority support & new content first",
  ];

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>SHAPE</Text>
        <Text style={styles.title}>
          My <Text style={styles.titleItalic}>Profile</Text>
        </Text>

        <View style={styles.tabBar}>
          {PROFILE_TABS.map((t) => {
            const active = t === activeTab;
            return (
              <Pressable key={t} style={styles.tabPress} onPress={() => setActiveTab(t)}>
                {active ? (
                  <LinearGradient
                    colors={colors.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.tabActive}
                  >
                    <Text style={styles.tabActiveText}>{t}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.tab}>
                    <Text style={styles.tabText}>{t}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {activeTab === "Settings" ? (
          <>
            <Text style={styles.label}>NOTIFICATIONS</Text>
            <Card style={styles.settingsCard}>
              {NOTIF_ROWS.map((row, i) => (
                <View key={row.key}>
                  {i > 0 ? <View style={styles.settingsDivider} /> : null}
                  <View style={styles.notifRow}>
                    <View style={styles.notifTextWrap}>
                      <Text style={styles.notifTitle}>{row.title}</Text>
                      <Text style={styles.notifSub}>{row.sub}</Text>
                    </View>
                    <Toggle
                      value={notifs[row.key]}
                      onValueChange={(v) => setNotifs((prev) => ({ ...prev, [row.key]: v }))}
                    />
                  </View>
                </View>
              ))}
            </Card>

            <Text style={styles.label}>PREFERENCES</Text>
            <Card style={styles.settingsCard}>
              {PREF_ROWS.map((row, i) => (
                <View key={row.key}>
                  {i > 0 ? <View style={styles.settingsDivider} /> : null}
                  <Pressable style={styles.prefRow}>
                    <View style={styles.prefLeft}>
                      <Text style={styles.prefTitle}>{row.title}</Text>
                      <Text style={styles.prefSub}>{row.sub}</Text>
                    </View>
                    <View style={styles.prefRight}>
                      <Text style={styles.prefValue}>{row.value}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                    </View>
                  </Pressable>
                </View>
              ))}
            </Card>

            <Text style={styles.label}>ACCOUNT &amp; PRIVACY</Text>
            <Card style={styles.settingsCard}>
              {ACCOUNT_ROWS.map((row, i) => (
                <View key={row.key}>
                  {i > 0 ? <View style={styles.settingsDivider} /> : null}
                  <Pressable style={styles.acctRow} onPress={row.onPress}>
                    <View style={styles.acctLeft}>
                      <Ionicons name={row.icon} size={20} color={colors.accent} />
                      <Text style={styles.acctLabel}>{row.label}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </Card>

            {isAdmin ? (
              <>
                <Text style={styles.label}>COACH TOOLS</Text>
                <Card style={styles.settingsCard}>
                  <Pressable
                    style={styles.acctRow}
                    onPress={() => router.push("/admin/upload-thank-you")}
                  >
                    <View style={styles.acctLeft}>
                      <Ionicons name="heart-outline" size={20} color={colors.accent} />
                      <Text style={styles.acctLabel}>Onboarding Thank-you Video</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                  </Pressable>
                  <View style={styles.settingsDivider} />
                  <Pressable
                    style={styles.acctRow}
                    onPress={() => router.push("/admin/reports")}
                  >
                    <View style={styles.acctLeft}>
                      <Ionicons name="flag-outline" size={20} color={colors.accent} />
                      <Text style={styles.acctLabel}>Reported Posts</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </Card>
              </>
            ) : null}
          </>
        ) : activeTab === "Plan" ? (
          <>
            <Card style={styles.planCard}>
              <View style={styles.planTopRow}>
                <View style={styles.planIconTile}>
                  <Ionicons name="sparkles" size={20} color={colors.onPrimaryStrong} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{planActive ? "Florish Premium" : "No active plan"}</Text>
                  <Text style={styles.planCadence}>
                    {planActive ? `${currentPlan.name} Plan` : "Choose a plan to get started"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.planActiveBadge,
                    !planActive && styles.planInactiveBadge,
                    willCancel && styles.planCancelBadge,
                  ]}
                >
                  {planActive && !willCancel ? <View style={styles.planActiveDot} /> : null}
                  <Text
                    style={[
                      styles.planActiveText,
                      !planActive && styles.planInactiveText,
                      willCancel && styles.planCancelText,
                    ]}
                  >
                    {planStatusLabel}
                  </Text>
                </View>
              </View>

              {planActive ? (
                <>
                  <View style={styles.planStatsRow}>
                    <View style={styles.planStatTile}>
                      <Text style={styles.planStatNum}>{currentPlan.amountLabel}</Text>
                      <Text style={styles.planStatLbl}>{currentPlan.periodLabel}</Text>
                    </View>
                    <View style={styles.planStatTile}>
                      <Text style={styles.planStatNum}>{renewalShort}</Text>
                      <Text style={styles.planStatLbl}>{willCancel ? "Ends" : "Renews"}</Text>
                    </View>
                    <View style={styles.planStatTile}>
                      <Text style={styles.planStatNum}>{planDaysLeft}</Text>
                      <Text style={styles.planStatLbl}>days left</Text>
                    </View>
                  </View>

                  <View style={styles.planBtnRow}>
                    <Pressable
                      onPress={() => { setPlanError(null); setBillingModal(true); }}
                      style={({ pressed }) => [styles.planManageBtn, { opacity: pressed ? 0.9 : 1 }]}
                    >
                      <LinearGradient
                        colors={colors.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.planManageInner}
                      >
                        <Text style={styles.planManageText}>Manage Plan</Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable
                      onPress={() => { setPlanError(null); setBillingModal(true); }}
                      style={({ pressed }) => [styles.planBillingBtn, { opacity: pressed ? 0.85 : 1 }]}
                    >
                      <Text style={styles.planBillingText}>Billing</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={() => onSwitchPlan(currentPlan.key)}
                  disabled={!!planBusy}
                  style={({ pressed }) => [styles.planManageBtn, { marginTop: 18, opacity: pressed || planBusy ? 0.9 : 1 }]}
                >
                  <LinearGradient
                    colors={colors.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.planManageInner}
                  >
                    <Text style={styles.planManageText}>
                      {planBusy ? "Activating…" : `Subscribe to ${currentPlan.fullLabel}`}
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}

              {planError ? <Text style={styles.planErrorText}>{planError}</Text> : null}
              {willCancel ? (
                <Text style={styles.planNoteText}>
                  Your plan won't renew. You keep access until {renewalLong}.
                </Text>
              ) : null}
            </Card>

            <Text style={styles.label}>WHAT'S INCLUDED</Text>
            <Card>
              {PLAN_FEATURES.map((f, i) => (
                <View key={f} style={[styles.includedRow, i > 0 && styles.includedRowGap]}>
                  <View style={styles.includedCheck}>
                    <Ionicons name="checkmark" size={13} color={colors.primary} />
                  </View>
                  <Text style={styles.includedText}>{f}</Text>
                </View>
              ))}
            </Card>

            <Text style={styles.label}>{planActive ? "CHANGE PLAN" : "CHOOSE A PLAN"}</Text>
            {PLAN_ORDER.map((key) => {
              const p = PLANS[key];
              const isCurrent = planActive && key === subscription.planKey;
              const busy = planBusy === key;
              return (
                <Card key={p.key} style={[styles.changeCard, isCurrent && styles.changeCardCurrent]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.changeNameRow}>
                      <Text style={styles.changeName}>{p.name}</Text>
                      {p.best ? (
                        <View style={styles.bestBadge}>
                          <Text style={styles.bestBadgeText}>BEST VALUE</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.changePrice}>{p.fullLabel}</Text>
                  </View>
                  {isCurrent ? (
                    <View style={styles.currentMark}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      <Text style={styles.currentMarkText}>Current</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => onSwitchPlan(key)}
                      disabled={!!planBusy}
                      style={({ pressed }) => [styles.switchBtn, { opacity: pressed || planBusy ? 0.6 : 1 }]}
                    >
                      <Text style={styles.switchBtnText}>
                        {busy ? "…" : planActive ? "Switch" : "Select"}
                      </Text>
                    </Pressable>
                  )}
                </Card>
              );
            })}
            {planError ? <Text style={styles.planErrorText}>{planError}</Text> : null}
          </>
        ) : (
        <>
        <View style={styles.headerPanel}>
          <Card style={styles.profileCard}>
            {editing ? (
              <View style={{ flex: 1 }}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={palette.mauve}
                  style={styles.editName}
                  autoFocus
                />
                <View style={styles.editBtnRow}>
                  <Pressable onPress={saveName} style={({ pressed }) => [styles.editSave, { opacity: pressed ? 0.9 : 1 }]}>
                    <LinearGradient
                      colors={colors.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.editSaveInner}
                    >
                      <Text style={styles.editSaveText}>Save</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditing(false)}
                    style={({ pressed }) => [styles.editCancel, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.profileRow}>
                <View style={styles.avatarWrap}>
                  {avatarSource ? (
                    <Image source={{ uri: avatarSource }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{firstName}</Text>
                    </View>
                  )}
                  <Pressable
                    style={styles.cameraBadge}
                    onPress={() => { setAvatarError(""); setAvatarModal(true); }}
                    hitSlop={8}
                  >
                    <Ionicons name="camera" size={13} color={colors.foreground} />
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.profileName} numberOfLines={1}>{user?.name}</Text>
                    <Pressable
                      style={styles.nameEditBtn}
                      onPress={() => { setName(user?.name ?? ""); setEditing(true); }}
                      hitSlop={8}
                    >
                      <Ionicons name="pencil" size={15} color={colors.accent} />
                    </Pressable>
                  </View>
                  {avatarError ? <Text style={styles.avatarErrorText}>{avatarError}</Text> : null}
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, styles.badgePremium]}>
                      <Ionicons name="sparkles" size={12} color={colors.foreground} />
                      <Text style={[styles.badgeText, styles.badgeTextPremium]}>Premium</Text>
                    </View>
                    <View style={styles.badge}>
                      <Ionicons name="flame" size={12} color={colors.highlight} />
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
            <Card style={[styles.statCard, styles.statCardAccent]}>
              <Text style={[styles.statNum, styles.statNumAccent]}>{fmtStat(bmi, 1)}</Text>
              <Text style={styles.statLbl}>BMI</Text>
            </Card>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <Text style={styles.label}>FITNESS GOAL</Text>
        <View style={styles.goalRow}>
          {FITNESS_GOALS.map((g) => {
            const active = g.id === selectedGoal;
            return (
              <Pressable
                key={g.id}
                onPress={() => selectGoal(g.id)}
                style={[styles.goalCard, active && styles.goalCardActive]}
              >
                <Ionicons
                  name={g.icon}
                  size={22}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.goalCardText, active && styles.goalCardTextActive]}>
                  {g.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionDivider} />

        {bmi != null ? (
          <>
            <Card style={styles.bmiCard}>
              <View style={styles.bmiHeader}>
                <Text style={styles.bmiCardLabel}>YOUR BMI</Text>
                <View style={styles.bmiBadge}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                  <Text style={styles.bmiBadgeText}>{bmiCategory(bmi)}</Text>
                </View>
              </View>
              <View style={styles.bmiValueRow}>
                <Text style={styles.bmiValue}>{fmtStat(bmi, 1)}</Text>
                <Text style={styles.bmiValueUnit}>BMI</Text>
              </View>
              <Text style={styles.bmiSub}>
                Height: {fmtStat(profile.height)} {profile.heightUnit} · Weight: {fmtStat(currentWeight, 1)} {profile.weightUnit}
              </Text>
              <View style={styles.bmiBarWrap}>
                <LinearGradient
                  colors={[colors.accentSoft, colors.success, colors.highlight, colors.danger]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.bmiBar}
                />
                <View style={[styles.bmiThumb, { left: `${bmiToPercent(bmi)}%` }]} />
              </View>
              <View style={styles.bmiScaleLabels}>
                <Text style={[styles.bmiScaleLabel, { color: colors.accentSoft }]}>Under</Text>
                <Text style={[styles.bmiScaleLabel, { color: colors.success }]}>Normal</Text>
                <Text style={[styles.bmiScaleLabel, { color: colors.highlight }]}>Over</Text>
                <Text style={[styles.bmiScaleLabel, { color: colors.danger }]}>Obese</Text>
              </View>
            </Card>

            <View style={styles.sectionDivider} />
          </>
        ) : null}

        <View style={styles.goalWeightHead}>
          <Text style={styles.label}>WEIGHT GOAL</Text>
          {kgToGo != null ? (
            <Text style={styles.toGo}>
              {fmtStat(kgToGo, 1)} {profile.weightUnit} to go
            </Text>
          ) : null}
        </View>
        <View style={styles.goalWeightRow}>
          <View style={styles.goalWeightField}>
            <TextInput
              value={goalWeightInput}
              onChangeText={(t) => {
                setGoalWeightInput(t);
                if (goalWeightError) setGoalWeightError(null);
              }}
              keyboardType="decimal-pad"
              placeholder="-"
              placeholderTextColor={colors.mutedForeground}
              style={styles.goalWeightInput}
            />
            <Text style={styles.goalWeightUnit}>{profile.weightUnit}</Text>
          </View>
          <Pressable onPress={saveGoalWeight} style={({ pressed }) => [styles.updateBtn, { opacity: pressed ? 0.9 : 1 }]}>
            <LinearGradient
              colors={colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.updateBtnInner}
            >
              <Text style={styles.updateBtnText}>Update</Text>
            </LinearGradient>
          </Pressable>
        </View>
        {goalWeightError ? <Text style={styles.goalWeightError}>{goalWeightError}</Text> : null}

        {weightProgress != null ? (
          <>
            <ProgressBar progress={weightProgress} height={8} style={{ marginTop: 16 }} />
            <View style={styles.goalScaleRow}>
              <Text style={styles.goalScaleText}>
                Start: {fmtStat(startWeight, 1)} {profile.weightUnit}
              </Text>
              <Text style={styles.goalScaleText}>
                Goal: {fmtStat(profile.goalWeight, 1)} {profile.weightUnit}
              </Text>
            </View>
          </>
        ) : null}

        <View style={styles.sectionDivider} />

        <View style={styles.goalWeightHead}>
          <Text style={styles.label}>HYDRATION GOAL</Text>
          <Text style={styles.toGo}>{(profile.waterGoalMl / 1000).toFixed(2)} L / day</Text>
        </View>
        <View style={styles.goalWeightRow}>
          <View style={styles.goalWeightField}>
            <TextInput
              value={waterGoalInput}
              onChangeText={(t) => {
                setWaterGoalInput(t);
                if (waterGoalError) setWaterGoalError(null);
              }}
              keyboardType="decimal-pad"
              placeholder="-"
              placeholderTextColor={colors.mutedForeground}
              style={styles.goalWeightInput}
            />
            <Text style={styles.goalWeightUnit}>L</Text>
          </View>
          <Pressable onPress={saveWaterGoal} style={({ pressed }) => [styles.updateBtn, { opacity: pressed ? 0.9 : 1 }]}>
            <LinearGradient
              colors={colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.updateBtnInner}
            >
              <Text style={styles.updateBtnText}>Update</Text>
            </LinearGradient>
          </Pressable>
        </View>
        {waterGoalError ? <Text style={styles.goalWeightError}>{waterGoalError}</Text> : null}

        <ProgressBar progress={waterProgress} height={8} style={{ marginTop: 16 }} />
        <View style={styles.goalScaleRow}>
          <Text style={styles.goalScaleText}>Today: {(todayWaterMl / 1000).toFixed(2)} L</Text>
          <Text style={styles.goalScaleText}>Goal: {(profile.waterGoalMl / 1000).toFixed(2)} L</Text>
        </View>

        <View style={styles.sectionDivider} />

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
        </>
        )}
      </ScrollView>

      <Modal
        visible={avatarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModal(false)}
        onDismiss={handleAvatarModalDismissed}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAvatarModal(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Profile Photo</Text>
            <Pressable style={styles.sheetOption} onPress={() => startPickAvatar("camera")}>
              <Ionicons name="camera-outline" size={20} color={colors.accent} />
              <Text style={styles.sheetOptionText}>Take Photo</Text>
            </Pressable>
            <Pressable style={styles.sheetOption} onPress={() => startPickAvatar("library")}>
              <Ionicons name="images-outline" size={20} color={colors.accent} />
              <Text style={styles.sheetOptionText}>Choose from Library</Text>
            </Pressable>
            {avatarSource ? (
              <Pressable style={styles.sheetOption} onPress={removeAvatar}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text style={[styles.sheetOptionText, { color: colors.danger }]}>Remove Photo</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.sheetCancel} onPress={() => setAvatarModal(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={emailModal} transparent animationType="fade" onRequestClose={() => setEmailModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEmailModal(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Change Email</Text>
            <Text style={styles.sheetSub}>This is the address you use to sign in.</Text>
            <TextInput
              value={emailInput}
              onChangeText={(t) => {
                setEmailInput(t);
                if (emailError) setEmailError("");
              }}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={styles.emailInput}
            />
            {emailError ? <Text style={styles.avatarErrorText}>{emailError}</Text> : null}
            {emailSuccess ? <Text style={styles.emailSuccessText}>Email updated</Text> : null}
            <View style={styles.editBtnRow}>
              <Pressable onPress={saveEmail} style={({ pressed }) => [styles.editSave, { opacity: pressed ? 0.9 : 1 }]}>
                <LinearGradient
                  colors={colors.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.editSaveInner}
                >
                  <Text style={styles.editSaveText}>Save</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={() => setEmailModal(false)}
                style={({ pressed }) => [styles.editCancel, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={billingModal} transparent animationType="fade" onRequestClose={() => setBillingModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBillingModal(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Manage Plan</Text>
            <Text style={styles.sheetSub}>
              {planActive
                ? `${currentPlan.name} · ${currentPlan.fullLabel}`
                : "You don't have an active plan."}
            </Text>

            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>Status</Text>
              <Text style={styles.billingValue}>{planStatusLabel}</Text>
            </View>
            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>{willCancel ? "Access until" : "Renews on"}</Text>
              <Text style={styles.billingValue}>{renewalLong}</Text>
            </View>
            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>Days left</Text>
              <Text style={styles.billingValue}>{planDaysLeft}</Text>
            </View>

            <Text style={styles.billingNote}>
              Payments are handled by your coach for now. Plan changes apply immediately in the app.
            </Text>

            {planError ? <Text style={styles.planErrorText}>{planError}</Text> : null}

            {planActive && willCancel ? (
              <Pressable
                onPress={onResumePlan}
                disabled={!!planBusy}
                style={({ pressed }) => [styles.editSave, { opacity: pressed || planBusy ? 0.9 : 1 }]}
              >
                <LinearGradient
                  colors={colors.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.editSaveInner}
                >
                  <Text style={styles.editSaveText}>
                    {planBusy === "resume" ? "Resuming…" : "Resume plan"}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : planActive ? (
              <Pressable
                onPress={onCancelPlan}
                disabled={!!planBusy}
                style={({ pressed }) => [styles.cancelPlanBtn, { opacity: pressed || planBusy ? 0.8 : 1 }]}
              >
                <Text style={styles.cancelPlanText}>
                  {planBusy === "cancel" ? "Cancelling…" : "Cancel subscription"}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setBillingModal(false)}
              style={({ pressed }) => [styles.editCancel, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.editCancelText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </GradientBackground>
  );
}

function bmiCategory(b: number) {
  if (b < 18.5) return "Underweight";
  if (b < 25) return "Normal";
  if (b < 30) return "Overweight";
  return "Obese";
}

function bmiToPercent(b: number) {
  let pct: number;
  if (b < 18.5) pct = ((b - 15) / (18.5 - 15)) * 25;
  else if (b < 25) pct = 25 + ((b - 18.5) / (25 - 18.5)) * 25;
  else if (b < 30) pct = 50 + ((b - 25) / (30 - 25)) * 25;
  else pct = 75 + ((b - 30) / (40 - 30)) * 25;
  return Math.max(2, Math.min(98, pct));
}

function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      style={[styles.toggleTrack, value ? styles.toggleTrackOn : styles.toggleTrackOff]}
    >
      <View style={[styles.toggleThumb, value ? styles.toggleThumbOn : styles.toggleThumbOff]} />
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
  tabPress: { flex: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center", borderRadius: colors.radiusSm },
  tabActive: { flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center", borderRadius: colors.radiusSm },
  tabText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  tabActiveText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.onPrimaryStrong },
  notifRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, paddingHorizontal: 14 },
  notifTextWrap: { flex: 1, paddingRight: 12 },
  notifTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  notifSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, marginTop: 3 },
  settingsCard: { paddingVertical: 4 },
  settingsDivider: { height: 1, backgroundColor: colors.cardBorder, marginHorizontal: 14 },
  sectionDivider: { height: 1, backgroundColor: colors.cardBorder, marginTop: 24 },
  bmiCard: { marginTop: 24 },
  bmiHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bmiCardLabel: { fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 2, color: colors.mutedForeground },
  bmiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accentTintMd,
    borderWidth: 1,
    borderColor: colors.accentBorderLg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  bmiBadgeText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
  bmiValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 12 },
  bmiValue: { fontFamily: fonts.serifSemibold, fontSize: 40, lineHeight: 44, color: colors.foreground },
  bmiValueUnit: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.mutedForeground, marginBottom: 6 },
  bmiSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
  bmiBarWrap: { height: 16, justifyContent: "center", marginTop: 16 },
  bmiBar: { height: 8, borderRadius: 4, width: "100%" },
  bmiThumb: {
    position: "absolute",
    top: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "rgba(16,17,17,0.2)",
    transform: [{ translateX: -8 }],
  },
  bmiScaleLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  bmiScaleLabel: { fontFamily: fonts.sansMedium, fontSize: 11 },
  prefRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 14 },
  prefLeft: { flex: 1, paddingRight: 12 },
  prefTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  prefSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  prefRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  prefValue: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground },
  acctRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, paddingHorizontal: 14 },
  acctLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  acctLabel: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.foreground },
  toggleTrack: { width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: "center" },
  toggleTrackOn: { backgroundColor: colors.primary },
  toggleTrackOff: { backgroundColor: "rgba(16,17,17,0.25)" },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF" },
  toggleThumbOn: { alignSelf: "flex-end" },
  toggleThumbOff: { alignSelf: "flex-start" },
  headerPanel: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 14,
    overflow: "hidden",
  },
  profileCard: {
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
  },
  editName: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.track,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 54,
  },
  editBtnRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  editSave: { flex: 1, borderRadius: colors.radius, overflow: "hidden" },
  editSaveInner: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: colors.radius },
  editSaveText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimary },
  editCancel: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.track,
  },
  editCancelText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarWrap: { width: 64, height: 64 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.accentBorderLg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.serifSemibold, fontSize: 28, color: palette.petal },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: palette.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground, flexShrink: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameEditBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.track,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarErrorText: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger, marginTop: 6 },
  emailSuccessText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent, marginTop: 6 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,17,17,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
  },
  sheetTitle: { fontFamily: fonts.serifSemibold, fontSize: 20, color: colors.foreground, marginBottom: 4 },
  sheetSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, marginBottom: 12 },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  sheetOptionText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  sheetCancel: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  sheetCancelText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.mutedForeground },
  emailInput: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.track,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.track,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgePremium: {
    backgroundColor: colors.blushTintMd,
    borderColor: colors.blushBorder,
  },
  badgeText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground },
  badgeTextPremium: { color: colors.foreground },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 4,
    backgroundColor: colors.cardElevated,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
  },
  statCardAccent: {
    backgroundColor: colors.accentTintMd,
    borderColor: colors.accentBorderLg,
  },
  statNum: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground },
  statNumAccent: { color: colors.primary },
  statLbl: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2, textAlign: "center" },
  label: {
    fontFamily: fonts.sansSemibold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.mutedForeground,
    marginTop: 26,
    marginBottom: 12,
  },
  goalRow: { flexDirection: "row", gap: 10 },
  goalCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 6,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  goalCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.accentTintMd,
  },
  goalCardText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted, textAlign: "center" },
  goalCardTextActive: { fontFamily: fonts.sansSemibold, color: colors.foreground },
  goalWeightHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toGo: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.primary, marginTop: 26, marginBottom: 12 },
  goalWeightRow: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  goalWeightField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  goalWeightInput: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.foreground, paddingVertical: 12 },
  goalWeightUnit: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.mutedForeground, marginLeft: 8 },
  updateBtn: { borderRadius: colors.radius, overflow: "hidden" },
  updateBtnInner: { paddingHorizontal: 24, minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: colors.radius },
  updateBtnText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimary },
  goalWeightError: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger, marginTop: 8 },
  goalScaleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  goalScaleText: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  version: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, textAlign: "center", marginTop: 18 },
  planCard: { marginTop: 4 },
  planTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  planIconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  planName: { fontFamily: fonts.serifSemibold, fontSize: 19, color: colors.foreground },
  planCadence: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  planActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.successTint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  planActiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  planActiveText: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.success },
  planStatsRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  planStatTile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    backgroundColor: colors.track,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  planStatNum: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.foreground },
  planStatLbl: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 3, textAlign: "center" },
  planBtnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  planManageBtn: { flex: 1, borderRadius: colors.radius, overflow: "hidden" },
  planManageInner: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: colors.radius },
  planManageText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimaryStrong },
  planBillingBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.accentBorderMd,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  planBillingText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.accentDark },
  includedRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  includedRowGap: { marginTop: 14 },
  includedCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentTintMd,
    alignItems: "center",
    justifyContent: "center",
  },
  includedText: { fontFamily: fonts.sans, fontSize: 14, color: colors.foreground, flex: 1 },
  changeCard: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  changeCardCurrent: { borderColor: colors.primary, backgroundColor: colors.accentTint },
  changeNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  changeName: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.foreground },
  changePrice: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, marginTop: 3 },
  bestBadge: { backgroundColor: colors.blushTintMd, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  bestBadgeText: { fontFamily: fonts.sansSemibold, fontSize: 9, letterSpacing: 0.5, color: colors.accentDark },
  currentMark: { flexDirection: "row", alignItems: "center", gap: 6 },
  currentMarkText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.primary },
  switchBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accentBorderMd,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  switchBtnText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accentDark },
  planInactiveBadge: { backgroundColor: colors.track },
  planInactiveText: { color: colors.mutedForeground },
  planCancelBadge: { backgroundColor: colors.blushTint },
  planCancelText: { color: colors.danger },
  planErrorText: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger, marginTop: 12 },
  planNoteText: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, marginTop: 12 },
  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  billingLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground },
  billingValue: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  billingNote: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 14, lineHeight: 18 },
  cancelPlanBtn: {
    minHeight: 50,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  cancelPlanText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.danger },
});
