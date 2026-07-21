import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable as StructuralPressable, TextInput, Modal, InteractionManager, Platform, Share, Keyboard } from "react-native";
import { KeyboardAwareScrollView, KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useNavigation, useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { useScrollDecor } from "@/components/BackgroundDecor";
import { Card } from "@/components/Card";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ProgressRing } from "@/components/ProgressRing";
import { LineChart, type LinePoint } from "@/components/LineChart";
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
import { useDataRefresh } from "@/hooks/useDataRefresh";
import { WORKOUTS } from "@/constants/workouts";
import { palette } from "@/constants/colors";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

export default function Profile() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useInsets();
  const { user, isAdmin, logout, updateUser, uploadAvatar, removeAvatar: removeAvatarFn } = useAuth();
  const { profile, completions, calorieLogs, weightLogs, updateProfile, streak, streakBest } = useData();
  const { refreshControl, scrollRef } = useDataRefresh();
  // Petal texture embedded in the scroll content so it moves with the page.
  const { decor, onContentSizeChange } = useScrollDecor();
  const { subscription, switchPlan, cancel, resume, subscribe } = useSubscription();

  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("Settings");
  const [name, setName] = useState(user?.name ?? "");
  const [avatarModal, setAvatarModal] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const pickingRef = useRef(false);
  const pendingPickRef = useRef<"camera" | "library" | null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState(user?.email ?? "");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [goalWeightModal, setGoalWeightModal] = useState(false);
  const [goalWeightInput, setGoalWeightInput] = useState(
    profile.goalWeight != null ? String(profile.goalWeight) : ""
  );
  const [goalWeightError, setGoalWeightError] = useState<string | null>(null);
  const [billingModal, setBillingModal] = useState(false);
  const [planBusy, setPlanBusy] = useState<PlanKey | "cancel" | "resume" | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [unitsModal, setUnitsModal] = useState(false);
  const [waterModal, setWaterModal] = useState(false);
  const [waterInput, setWaterInput] = useState("");
  const [waterError, setWaterError] = useState<string | null>(null);
  const [calorieModal, setCalorieModal] = useState(false);
  const [calorieInput, setCalorieInput] = useState("");
  const [calorieError, setCalorieError] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; body: string } | null>(null);
  const [timeModal, setTimeModal] = useState(false);
  const [timeDraft, setTimeDraft] = useState("07:00");
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    setGoalWeightInput(profile.goalWeight != null ? String(profile.goalWeight) : "");
  }, [profile.goalWeight]);

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener?.("tabPress", () => {
      setActiveTab("Settings");
    });
    return unsubscribe;
  }, [navigation]);

  const selectProfileTab = (tab: string) => {
    if (tab === activeTab) return;
    haptics.selection();
    setActiveTab(tab);
  };

  const totalWorkouts = completions.length;
  const totalMeals = calorieLogs.length;


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

  const history = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 1).getTime();
    const end = new Date(year, month + 1, 1).getTime();
    const monthCompletions = completions.filter((c) => c.ts >= start && c.ts < end);
    const activeDays = new Set(monthCompletions.map((c) => new Date(c.ts).getDate()));
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendar = [
      ...Array.from({ length: firstDay }, (_, i) => ({ key: `blank-${i}`, day: 0, active: false, today: false })),
      ...Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        return { key: String(day), day, active: activeDays.has(day), today: day === now.getDate() };
      }),
    ];
    const recent = [...completions]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 3)
      .map((c) => ({ completion: c, workout: WORKOUTS.find((w) => w.id === c.workoutId) }));
    return {
      monthLabel: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase(),
      workouts: monthCompletions.length,
      minutes: monthCompletions.reduce((s, c) => s + c.durationMin, 0),
      kcal: monthCompletions.reduce((s, c) => s + c.kcal, 0),
      activeDays: activeDays.size,
      calendar,
      recent,
    };
  }, [completions]);

  const historyWeightTrend: LinePoint[] = useMemo(() => {
    const sorted = [...weightLogs].sort((a, b) => a.ts - b.ts).slice(-8);
    return sorted.map((l) => ({
      label: new Date(l.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: l.weight,
    }));
  }, [weightLogs]);

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

  // Net weight change since the first logged weigh-in (or the onboarding start
  // weight): negative = lost, positive = gained. Shown as a small pill on the
  // weight stat.
  const weightDelta =
    currentWeight != null && startWeight != null ? currentWeight - startWeight : null;

  const kgToGo = useMemo(() => {
    if (currentWeight == null || profile.goalWeight == null) return null;
    return Math.abs(currentWeight - profile.goalWeight);
  }, [currentWeight, profile.goalWeight]);

  const saveGoalWeight = async () => {
    const trimmed = goalWeightInput.trim().replace(",", ".");
    const val = Number(trimmed);
    if (!trimmed || !Number.isFinite(val) || val <= 0) {
      haptics.warning();
      setGoalWeightError("Enter a valid goal weight.");
      return;
    }
    setGoalWeightError(null);
    await updateProfile({ goalWeight: val });
    setGoalWeightModal(false);
  };

  const setUnit = (weightUnit: "kg" | "lbs") => {
    if (weightUnit === profile.weightUnit) return setUnitsModal(false);
    haptics.selection();
    void updateProfile({ weightUnit });
    setUnitsModal(false);
  };

  const openWaterModal = () => {
    setWaterInput((profile.waterGoalMl / 1000).toFixed(1));
    setWaterError(null);
    setWaterModal(true);
  };

  const saveWater = async () => {
    const val = Number(waterInput.trim().replace(",", "."));
    if (!Number.isFinite(val) || val < 1 || val > 5) {
      haptics.warning();
      setWaterError("Enter a goal between 1 and 5 L.");
      return;
    }
    setWaterError(null);
    await updateProfile({ waterGoalMl: Math.round(val * 1000) });
    setWaterModal(false);
  };

  const openCalorieModal = () => {
    setCalorieInput(String(profile.calorieGoal));
    setCalorieError(null);
    setCalorieModal(true);
  };

  const saveCalorie = async () => {
    const val = Number(calorieInput.trim());
    if (!Number.isFinite(val) || val < 500 || val > 10000) {
      haptics.warning();
      setCalorieError("Enter a goal between 500 and 10000 kcal.");
      return;
    }
    setCalorieError(null);
    await updateProfile({ calorieGoal: Math.round(val) });
    setCalorieModal(false);
  };

  const openTimeModal = () => {
    setTimeDraft(profile.workoutReminderTime);
    setTimeModal(true);
  };

  const shiftTime = (deltaMin: number) => {
    setTimeDraft((t) => {
      const [h, m] = t.split(":").map(Number);
      const total = ((h * 60 + m + deltaMin) % 1440 + 1440) % 1440;
      const nh = Math.floor(total / 60);
      const nm = total % 60;
      return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
    });
  };

  const saveTime = async () => {
    await updateProfile({ workoutReminderTime: timeDraft });
    setTimeModal(false);
  };

  const toggleRestDay = (key: string) => {
    const active = profile.restDays.includes(key);
    const next = active ? profile.restDays.filter((x) => x !== key) : [...profile.restDays, key];
    haptics.selection();
    void updateProfile({ restDays: next });
  };

  const setNotif = (key: keyof typeof profile.notifications, value: boolean) => {
    if (profile.notifications[key] === value) return;
    haptics.selection();
    void updateProfile({ notifications: { ...profile.notifications, [key]: value } });
  };

  const flashShareNote = (msg: string) => {
    setShareNote(msg);
    setTimeout(() => setShareNote(null), 1800);
  };

  const shareText = async (message: string, title: string) => {
    try {
      if (Platform.OS === "web") {
        const nav: any = typeof navigator !== "undefined" ? navigator : undefined;
        if (nav?.share) {
          await nav.share({ title, text: message });
        } else if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(message);
          flashShareNote("Copied to clipboard");
        } else {
          flashShareNote("Sharing is not available here");
        }
        return;
      }
      await Share.share({ message });
    } catch {
      // Member dismissed the share sheet, or sharing is unavailable: ignore.
    }
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
    if (!res.ok) {
      haptics.warning();
      setPlanError(res.error ?? "Something went wrong. Please try again.");
    }
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
        haptics.warning();
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
        haptics.warning();
        setAvatarError(result.error ?? "Couldn't add the photo. Please try again.");
        return;
      }
    } catch (e: any) {
      clearPicked();
      haptics.warning();
      setAvatarError(e?.message ?? "Couldn't add the photo. Please try again.");
    } finally {
      pickingRef.current = false;
    }
  };

  const removeAvatar = async () => {
    haptics.warning();
    setAvatarModal(false);
    setAvatarError("");
    // Drop any optimistic preview so the avatar falls back to initials at once.
    clearPicked();
    const result = await removeAvatarFn();
    if (!result.ok) {
      haptics.warning();
      setAvatarError(result.error ?? "Couldn't remove the photo. Please try again.");
    }
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
      haptics.warning();
      setEmailError(res.error ?? "Couldn't update your email.");
      return;
    }
    setEmailError("");
    setEmailSuccess(true);
    setTimeout(() => setEmailModal(false), 900);
  };

  const openGoalWeightModal = () => {
    setGoalWeightInput(profile.goalWeight != null ? String(profile.goalWeight) : "");
    setGoalWeightError(null);
    setGoalWeightModal(true);
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

  const PROFILE_TABS = ["Settings", "History", "Plan"];

  const NOTIF_ROWS: { key: keyof typeof profile.notifications; title: string; sub: string; chip?: string }[] = [
    { key: "workout", title: "Workout Reminders", sub: "Daily - tap time to change", chip: formatTime12(profile.workoutReminderTime) },
    { key: "hydration", title: "Hydration Reminders", sub: "Every 2 hours" },
    { key: "streak", title: "Streak Alerts", sub: "Don't break your streak!" },
    { key: "content", title: "New Content Alerts", sub: "New workouts from Ajay" },
    { key: "weekly", title: "Weekly Progress Report", sub: "Every Sunday evening" },
  ];
  const REST_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

  const isMetric = profile.weightUnit === "kg";
  const PREF_ROWS: { key: string; title: string; sub: string; value: string; onPress?: () => void }[] = [
    { key: "units", title: "Units", sub: isMetric ? "Metric (kg, cm)" : "Imperial (lbs, ft)", value: isMetric ? "Metric" : "Imperial", onPress: () => setUnitsModal(true) },
    {
      key: "goal-weight",
      title: "Goal Weight",
      sub: "Target weight",
      value: profile.goalWeight != null ? `${fmtStat(profile.goalWeight, 1)} ${profile.weightUnit}` : "Not set",
      onPress: openGoalWeightModal,
    },
    { key: "water", title: "Daily Water Goal", sub: `${profile.waterGoalMl.toLocaleString()} ml`, value: `${(profile.waterGoalMl / 1000).toFixed(1)} L`, onPress: openWaterModal },
    { key: "calorie", title: "Daily Calorie Goal", sub: `${profile.calorieGoal.toLocaleString()} kcal`, value: String(profile.calorieGoal), onPress: openCalorieModal },
  ];

  const ACCOUNT_ROWS: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void }[] = [
    { key: "email", icon: "mail-outline", label: "Change Email", onPress: openEmailModal },
    { key: "password", icon: "lock-closed-outline", label: "Change Password", onPress: () => router.push("/forgot-password") },
    { key: "privacy", icon: "document-text-outline", label: "Privacy Policy", onPress: () => setInfoModal({ title: "Privacy Policy", body: PRIVACY_TEXT }) },
    { key: "about", icon: "information-circle-outline", label: "About Shape", onPress: () => setInfoModal({ title: "About Shape", body: ABOUT_TEXT }) },
    { key: "support", icon: "headset-outline", label: "Support", onPress: () => setInfoModal({ title: "Support", body: SUPPORT_TEXT }) },
  ];

  const PLAN_FEATURES = [
    "Unlimited workout videos with Ajay",
    "AI-powered calorie tracking",
    "Hydration & progress tracking",
    "Private progress photo gallery",
    "Push notifications & streak reminders",
    "Priority support & new content first",
  ];

  const profileHeader = (
    <View style={styles.headerPanel}>
      <View style={styles.memberCard}>
        {/* Blush cover strip: wordmark + (subscribed) gold Premium badge. */}
        <LinearGradient
          colors={["#FCE4EC", "#F8D3E0", "#F3C3D5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cover}
        >
          <View style={styles.coverGlow} pointerEvents="none" />
          <Text style={styles.wordmark}>SHAPE</Text>
          {planActive ? (
            <LinearGradient
              colors={["#F6DDA9", "#DBA968"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumBadge}
            >
              <Ionicons name="sparkles" size={9} color="#6E4A18" />
              <Text style={styles.premiumText}>PREMIUM</Text>
            </LinearGradient>
          ) : null}
        </LinearGradient>

        {/* Body, pulled up so the avatar overlaps the cover by half. */}
        <View style={styles.memberBody}>
          <View style={styles.avatarWrap}>
            {avatarSource ? (
              <Image source={{ uri: avatarSource }} style={styles.avatar} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={["#F5C9D9", "#E45D87"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{firstName}</Text>
              </LinearGradient>
            )}
            <Pressable
              style={styles.cameraBadge}
              onPress={() => { setAvatarError(""); setAvatarModal(true); }}
              hitSlop={8}
            >
              <Ionicons name="camera" size={14} color={colors.onPrimary} />
            </Pressable>
          </View>

          {editing ? (
            <View style={styles.editWrap}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={palette.mauve}
                style={styles.editName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
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
            <>
              <View style={styles.nameRow}>
                <Text style={styles.profileName} numberOfLines={1}>{user?.name}</Text>
                <Pressable
                  onPress={() => { setName(user?.name ?? ""); setEditing(true); }}
                  hitSlop={8}
                >
                  <Ionicons name="pencil" size={13} color={colors.accent} />
                </Pressable>
              </View>
              {avatarError ? <Text style={styles.avatarErrorText}>{avatarError}</Text> : null}
              <View style={styles.streakLine}>
                <View style={styles.streakSeg}>
                  <Ionicons name="flame" size={13} color={colors.primary} />
                  <Text style={styles.streakText}>
                    <Text style={styles.streakStrong}>{streak}</Text> day streak
                  </Text>
                </View>
                <View style={styles.streakDot} />
                <Text style={styles.streakText}>
                  Best <Text style={styles.streakStrong}>{streakBest}</Text>
                </Text>
              </View>
            </>
          )}

          <View style={styles.statsStrip}>
            <View style={[styles.statCell, styles.statCellDivider]}>
              <Text style={styles.statNum}>{fmtStat(profile.age)}</Text>
              <Text style={styles.statLbl}>AGE</Text>
              <View style={styles.statDeltaSlot} />
            </View>
            <View style={[styles.statCell, styles.statCellDivider]}>
              <Text style={styles.statNum}>{fmtStat(currentWeight, 1)}</Text>
              <Text style={styles.statLbl}>{profile.weightUnit.toUpperCase()}</Text>
              <View style={styles.statDeltaSlot}>
                {weightDelta != null && Math.abs(weightDelta) >= 0.1 ? (
                  <View style={[styles.deltaPill, weightDelta > 0 ? styles.deltaPillUp : styles.deltaPillDown]}>
                    <Ionicons
                      name={weightDelta > 0 ? "trending-up" : "trending-down"}
                      size={10}
                      color={weightDelta > 0 ? colors.highlight : colors.success}
                    />
                    <Text style={[styles.deltaText, { color: weightDelta > 0 ? colors.highlight : colors.success }]}>
                      {weightDelta > 0 ? "+" : ""}{weightDelta.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={[styles.statCell, styles.statCellDivider]}>
              <Text style={styles.statNum}>{fmtStat(profile.height)}</Text>
              <Text style={styles.statLbl}>{profile.heightUnit.toUpperCase()}</Text>
              <View style={styles.statDeltaSlot} />
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{fmtStat(bmi, 1)}</Text>
              <Text style={styles.statLbl}>BMI</Text>
              <View style={styles.statDeltaSlot}>
                {bmi != null ? (
                  <View style={[styles.bmiSummaryPill, bmiSummaryPillStyle(bmi, colors)]}>
                    <Text style={[styles.bmiSummaryText, bmiSummaryTextStyle(bmi, colors)]}>
                      {bmiSummaryCategory(bmi)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const weightGoalSection = (
    <Card style={styles.weightGoalCard}>
      <View style={styles.weightGoalTop}>
        <View style={styles.labelWithTip}>
          <Text style={styles.weightGoalLabel}>WEIGHT GOAL</Text>
          <InfoTip
            title="Weight Goal"
            body="Your progress from your starting weight toward your goal weight. The ring fills up as you get closer."
          />
        </View>
        {kgToGo != null ? (
          <Text style={styles.weightGoalToGo}>
            {fmtStat(kgToGo, 1)} {profile.weightUnit} to go
          </Text>
        ) : null}
      </View>
      <View style={styles.weightRingWrap}>
        <ProgressRing size={130} strokeWidth={10} progress={weightProgress ?? 0} gradientId="profileWeightGoalRing">
          <Text style={styles.weightRingNum}>{fmtStat(currentWeight, 1)}</Text>
          <Text style={styles.weightRingUnit}>{profile.weightUnit.toUpperCase()} NOW</Text>
        </ProgressRing>
      </View>
      {profile.goalWeight != null ? (
        <Text style={styles.weightGoalCopy}>
          Goal <Text style={styles.weightGoalStrong}>{fmtStat(profile.goalWeight, 0)} {profile.weightUnit}</Text>
          {weightProgress != null ? ` - ${Math.round(weightProgress * 100)}% of the way there` : ""}
        </Text>
      ) : null}
    </Card>
  );

  const bmiSection = bmi != null ? (
    <Card style={styles.bmiCard}>
      <View style={styles.bmiHeader}>
        <View style={styles.labelWithTip}>
          <Text style={styles.bmiCardLabel}>YOUR BMI</Text>
          <InfoTip
            title="Your BMI"
            body="Body Mass Index estimates whether your weight sits in a healthy range for your height. It's a general guide, not medical advice."
          />
        </View>
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
        Height: {fmtStat(profile.height)} {profile.heightUnit} - Weight: {fmtStat(currentWeight, 1)} {profile.weightUnit}
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
  ) : null;

  return (
    <GradientBackground showDecor={false}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={96}
        refreshControl={refreshControl}
        onContentSizeChange={onContentSizeChange}
      >
        {decor}
        {profileHeader}

        <View style={styles.tabBar}>
          {PROFILE_TABS.map((t) => {
            const active = t === activeTab;
            return (
              <Pressable key={t} style={styles.tabPress} onPress={() => selectProfileTab(t)}>
                <Text style={[styles.tabText, active && styles.tabActiveText]}>{t}</Text>
                <View style={[styles.tabDot, active && styles.tabDotActive]} />
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
                    {row.chip ? (
                      <Pressable style={styles.notifChip} onPress={openTimeModal}>
                        <Text style={styles.notifChipText}>{row.chip}</Text>
                      </Pressable>
                    ) : null}
                    <Toggle
                      value={profile.notifications[row.key]}
                      onValueChange={(v) => setNotif(row.key, v)}
                    />
                  </View>
                </View>
              ))}
            </Card>

            <Text style={styles.label}>STREAK &amp; REST DAYS</Text>
            <Card style={styles.restCard}>
              <Text style={styles.restTitle}>Rest Days</Text>
              <Text style={styles.restSub}>Planned rest days won't break your streak</Text>
              <View style={styles.restDayRow}>
                {REST_DAY_LABELS.map((d, i) => {
                  const key = `${d}-${i}`;
                  const active = profile.restDays.includes(key);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => toggleRestDay(key)}
                      style={[styles.restDay, active && styles.restDayActive]}
                    >
                      <Text style={[styles.restDayText, active && styles.restDayTextActive]}>{d}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Text style={styles.label}>PREFERENCES</Text>
            <Card style={styles.settingsCard}>
              {PREF_ROWS.map((row, i) => (
                <View key={row.key}>
                  {i > 0 ? <View style={styles.settingsDivider} /> : null}
                  <Pressable style={styles.prefRow} onPress={row.onPress} disabled={!row.onPress}>
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

            <Text style={styles.label}>REFER A FRIEND</Text>
            <Card style={styles.referCard}>
              <View style={styles.referIcon}>
                <Ionicons name="gift-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.referTitle}>Give a week, get a week</Text>
                <Text style={styles.referSub}>
                  Your code: <Text style={styles.referCode}>AMARA10</Text>
                </Text>
              </View>
              <Pressable
                style={styles.inviteBtn}
                onPress={() =>
                  shareText(
                    "Join me on Shape and we both get a free week! Use my code AMARA10 when you sign up.",
                    "Join me on Shape"
                  )
                }
              >
                <Text style={styles.inviteText}>Invite</Text>
              </Pressable>
            </Card>

            {isAdmin ? (
              <>
                <Text style={styles.label}>ADMIN TOOLS</Text>
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
                  <View style={styles.settingsDivider} />
                  <Pressable
                    style={styles.acctRow}
                    onPress={() => router.push("/admin/blocked-members")}
                  >
                    <View style={styles.acctLeft}>
                      <Ionicons name="remove-circle-outline" size={20} color={colors.accent} />
                      <Text style={styles.acctLabel}>Blocked Members</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </Card>
              </>
            ) : null}

            <LinearGradient
              colors={colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.shareStreakCard}
            >
              <View style={styles.shareDaysBadge}>
                <Text style={styles.shareDaysNum}>{Math.max(1, streak)}</Text>
                <Text style={styles.shareDaysText}>DAYS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shareTitle}>Share your streak</Text>
                <Text style={styles.shareSub}>Create a story card for Instagram</Text>
              </View>
              <Pressable
                style={styles.shareBtn}
                onPress={() =>
                  shareText(
                    `I'm on a ${Math.max(1, streak)}-day streak on Shape! Showing up for myself, one session at a time.`,
                    "My Shape streak"
                  )
                }
              >
                <Text style={styles.shareBtnText}>Share</Text>
              </Pressable>
            </LinearGradient>

            <View style={styles.memberSinceRow}>
              <View style={styles.memberSinceLine} />
              <Text style={styles.memberSinceText}>Premium member since March 2026</Text>
              <View style={styles.memberSinceLine} />
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
            <Text style={styles.version}>Shape · v1.0</Text>
          </>
        ) : activeTab === "Plan" ? (
          <>
            <Card style={styles.planCard}>
              <View style={styles.planTopRow}>
                <Image
                  source={require("@/assets/images/icon.png")}
                  style={styles.planIconTile}
                  contentFit="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{planActive ? "Shape Premium" : "No active plan"}</Text>
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
        ) : activeTab === "History" ? (
          <>
            <View style={styles.historyStatsRow}>
              <View style={styles.historyStat}>
                <Text style={styles.historyStatNum}>{history.workouts}</Text>
                <Text style={styles.historyStatLabel}>WORKOUTS</Text>
              </View>
              <View style={styles.historyStat}>
                <Text style={styles.historyStatNum}>{history.minutes}</Text>
                <Text style={styles.historyStatLabel}>MINUTES</Text>
              </View>
              <View style={[styles.historyStat, styles.historyStatLast]}>
                <Text style={[styles.historyStatNum, styles.historyStatAccent]}>~{history.kcal.toLocaleString()}</Text>
                <Text style={styles.historyStatLabel}>KCAL</Text>
              </View>
            </View>

            <Card style={styles.historyCard}>
              <View style={styles.historyCardHead}>
                <View style={styles.labelWithTip}>
                  <Text style={styles.historyEyebrow}>{history.monthLabel}</Text>
                  <InfoTip
                    title="Workout Calendar"
                    body="This calendar shows your workout activity for the current month. Filled pink days are days you completed at least one workout, and the highlighted day marks today."
                    size={14}
                  />
                </View>
                <Text style={styles.historyActive}>{history.activeDays} workout days</Text>
              </View>
              <View style={styles.weekdayRow}>
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <Text key={`${d}-${i}`} style={styles.weekday}>{d}</Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {history.calendar.map((d) => (
                  <View
                    key={d.key}
                    style={[
                      styles.calendarCell,
                      d.today && styles.calendarCellToday,
                      d.active && styles.calendarCellActive,
                      d.day === 0 && styles.calendarCellBlank,
                    ]}
                  >
                    {d.day ? <Text style={[styles.calendarDay, d.today && !d.active && styles.calendarDayToday, d.active && styles.calendarDayActive]}>{d.day}</Text> : null}
                  </View>
                ))}
              </View>
            </Card>

            <Card style={styles.historyCard}>
              <View style={styles.historyCardHead}>
                <View style={styles.labelWithTip}>
                  <Text style={styles.historyEyebrow}>WEIGHT TREND</Text>
                  <InfoTip
                    title="Weight Trend"
                    body="How your weight has moved across your recent weigh-ins. The badge shows the net change over the period shown."
                  />
                </View>
                {historyWeightTrend.length >= 2 ? (
                  <View style={styles.historyTrendPill}>
                    <Text style={styles.historyTrendText}>
                      {(historyWeightTrend[historyWeightTrend.length - 1].value - historyWeightTrend[0].value).toFixed(1)} {profile.weightUnit}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.historyWeightRow}>
                <Text style={styles.historyWeightNum}>{fmtStat(currentWeight, 1)}</Text>
                <Text style={styles.historyWeightUnit}>{profile.weightUnit} - last 90 days</Text>
              </View>
              {historyWeightTrend.length >= 2 ? (
                <LineChart data={historyWeightTrend} unit={profile.weightUnit} height={82} />
              ) : (
                <Text style={styles.historyEmpty}>Log at least two weigh-ins to see your trend.</Text>
              )}
            </Card>

            {weightGoalSection}
            {bmiSection ? (
              <>
                <View style={styles.sectionDivider} />
                {bmiSection}
              </>
            ) : null}

            <Text style={styles.label}>RECENT WORKOUTS</Text>
            <Card style={styles.settingsCard}>
              {history.recent.length ? (
                history.recent.map(({ completion, workout }, i) => (
                  <View key={completion.id}>
                    {i > 0 ? <View style={styles.settingsDivider} /> : null}
                    <View style={styles.historyWorkoutRow}>
                      <View style={styles.historyWorkoutThumb}>
                        <Ionicons name="barbell-outline" size={19} color={colors.accentDark} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyWorkoutTitle} numberOfLines={1}>
                          {workout?.title ?? "Ajay Workout"}
                        </Text>
                        <Text style={styles.historyWorkoutSub}>
                          with Ajay - {completion.durationMin} min - ~{completion.kcal} kcal
                        </Text>
                      </View>
                      <Text style={styles.historyWorkoutDay}>
                        {new Date(completion.ts).toLocaleDateString("en-US", { weekday: "short" })}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState
                  compact
                  icon="calendar-outline"
                  title="No workouts completed yet"
                  description="Browse the library and choose a session to get started."
                  actionLabel="Browse workouts"
                  onAction={() => router.push("/(tabs)/workouts")}
                />
              )}
            </Card>
          </>
        ) : null}
      </KeyboardAwareScrollView>

      <Modal
        visible={avatarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModal(false)}
        onDismiss={handleAvatarModalDismissed}
      >
        <StructuralPressable style={styles.modalBackdrop} onPress={() => setAvatarModal(false)}>
          <StructuralPressable style={styles.sheet} onPress={() => {}}>
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
          </StructuralPressable>
        </StructuralPressable>
      </Modal>

      <Modal visible={emailModal} transparent animationType="fade" onRequestClose={() => setEmailModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <StructuralPressable style={styles.modalBackdrop} onPress={() => setEmailModal(false)}>
          <StructuralPressable style={styles.sheet} onPress={() => {}}>
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
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
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
          </StructuralPressable>
        </StructuralPressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={goalWeightModal} transparent animationType="fade" onRequestClose={() => setGoalWeightModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <StructuralPressable style={styles.modalBackdrop} onPress={() => setGoalWeightModal(false)}>
          <StructuralPressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Goal Weight</Text>
            <Text style={styles.sheetSub}>Set the target shown in your History progress card.</Text>
            <View style={[styles.goalWeightField, styles.goalWeightModalField]}>
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
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <Text style={styles.goalWeightUnit}>{profile.weightUnit}</Text>
            </View>
            {goalWeightError ? <Text style={styles.goalWeightError}>{goalWeightError}</Text> : null}
            <View style={styles.editBtnRow}>
              <Pressable onPress={saveGoalWeight} style={({ pressed }) => [styles.editSave, { opacity: pressed ? 0.9 : 1 }]}>
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
                onPress={() => setGoalWeightModal(false)}
                style={({ pressed }) => [styles.editCancel, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </StructuralPressable>
        </StructuralPressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={billingModal} transparent animationType="fade" onRequestClose={() => setBillingModal(false)}>
        <StructuralPressable style={styles.modalBackdrop} onPress={() => setBillingModal(false)}>
          <StructuralPressable style={styles.sheet} onPress={() => {}}>
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
              Payments are handled by your admin for now. Plan changes apply immediately in the app.
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
          </StructuralPressable>
        </StructuralPressable>
      </Modal>

      <Modal visible={unitsModal} transparent animationType="fade" onRequestClose={() => setUnitsModal(false)}>
        <StructuralPressable style={styles.modalBackdrop} onPress={() => setUnitsModal(false)}>
          <StructuralPressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Units</Text>
            <Text style={styles.sheetSub}>Choose how weights and measurements are shown.</Text>
            {([
              { unit: "kg" as const, label: "Metric", detail: "kg, cm" },
              { unit: "lbs" as const, label: "Imperial", detail: "lbs, ft" },
            ]).map((opt) => {
              const active = profile.weightUnit === opt.unit;
              return (
                <Pressable
                  key={opt.unit}
                  onPress={() => setUnit(opt.unit)}
                  style={[styles.choiceRow, active && styles.choiceRowActive]}
                >
                  <View>
                    <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{opt.label}</Text>
                    <Text style={styles.choiceDetail}>{opt.detail}</Text>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
            <View style={styles.editBtnRow}>
              <Pressable
                onPress={() => setUnitsModal(false)}
                style={({ pressed }) => [styles.editCancel, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </StructuralPressable>
        </StructuralPressable>
      </Modal>

      <Modal visible={waterModal} transparent animationType="fade" onRequestClose={() => setWaterModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <StructuralPressable style={styles.modalBackdrop} onPress={() => setWaterModal(false)}>
          <StructuralPressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Daily Water Goal</Text>
            <Text style={styles.sheetSub}>How much water you aim to drink each day.</Text>
            <View style={[styles.goalWeightField, styles.goalWeightModalField]}>
              <TextInput
                value={waterInput}
                onChangeText={(t) => {
                  setWaterInput(t);
                  if (waterError) setWaterError(null);
                }}
                keyboardType="decimal-pad"
                placeholder="2.5"
                placeholderTextColor={colors.mutedForeground}
                style={styles.goalWeightInput}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <Text style={styles.goalWeightUnit}>L</Text>
            </View>
            {waterError ? <Text style={styles.goalWeightError}>{waterError}</Text> : null}
            <View style={styles.editBtnRow}>
              <Pressable onPress={saveWater} style={({ pressed }) => [styles.editSave, { opacity: pressed ? 0.9 : 1 }]}>
                <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.editSaveInner}>
                  <Text style={styles.editSaveText}>Save</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => setWaterModal(false)} style={({ pressed }) => [styles.editCancel, { opacity: pressed ? 0.85 : 1 }]}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </StructuralPressable>
        </StructuralPressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={calorieModal} transparent animationType="fade" onRequestClose={() => setCalorieModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <StructuralPressable style={styles.modalBackdrop} onPress={() => setCalorieModal(false)}>
          <StructuralPressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Daily Calorie Goal</Text>
            <Text style={styles.sheetSub}>Your target daily calorie intake.</Text>
            <View style={[styles.goalWeightField, styles.goalWeightModalField]}>
              <TextInput
                value={calorieInput}
                onChangeText={(t) => {
                  setCalorieInput(t);
                  if (calorieError) setCalorieError(null);
                }}
                keyboardType="number-pad"
                placeholder="1800"
                placeholderTextColor={colors.mutedForeground}
                style={styles.goalWeightInput}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <Text style={styles.goalWeightUnit}>kcal</Text>
            </View>
            {calorieError ? <Text style={styles.goalWeightError}>{calorieError}</Text> : null}
            <View style={styles.editBtnRow}>
              <Pressable onPress={saveCalorie} style={({ pressed }) => [styles.editSave, { opacity: pressed ? 0.9 : 1 }]}>
                <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.editSaveInner}>
                  <Text style={styles.editSaveText}>Save</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => setCalorieModal(false)} style={({ pressed }) => [styles.editCancel, { opacity: pressed ? 0.85 : 1 }]}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </StructuralPressable>
        </StructuralPressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={timeModal} transparent animationType="fade" onRequestClose={() => setTimeModal(false)}>
        <StructuralPressable style={styles.modalBackdrop} onPress={() => setTimeModal(false)}>
          <StructuralPressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Reminder Time</Text>
            <Text style={styles.sheetSub}>When to send your daily workout reminder.</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeStepper}>
                <Pressable onPress={() => shiftTime(60)} hitSlop={8} style={styles.timeStepBtn}>
                  <Ionicons name="chevron-up" size={20} color={colors.accent} />
                </Pressable>
                <Pressable onPress={() => shiftTime(-60)} hitSlop={8} style={styles.timeStepBtn}>
                  <Ionicons name="chevron-down" size={20} color={colors.accent} />
                </Pressable>
              </View>
              <Text style={styles.timeValue}>{formatTime12(timeDraft)}</Text>
              <View style={styles.timeStepper}>
                <Pressable onPress={() => shiftTime(5)} hitSlop={8} style={styles.timeStepBtn}>
                  <Ionicons name="chevron-up" size={20} color={colors.accent} />
                </Pressable>
                <Pressable onPress={() => shiftTime(-5)} hitSlop={8} style={styles.timeStepBtn}>
                  <Ionicons name="chevron-down" size={20} color={colors.accent} />
                </Pressable>
              </View>
            </View>
            <Text style={styles.timeHint}>Hour · Minute</Text>
            <View style={styles.editBtnRow}>
              <Pressable onPress={saveTime} style={({ pressed }) => [styles.editSave, { opacity: pressed ? 0.9 : 1 }]}>
                <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.editSaveInner}>
                  <Text style={styles.editSaveText}>Save</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => setTimeModal(false)} style={({ pressed }) => [styles.editCancel, { opacity: pressed ? 0.85 : 1 }]}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </StructuralPressable>
        </StructuralPressable>
      </Modal>

      <Modal visible={infoModal != null} transparent animationType="fade" onRequestClose={() => setInfoModal(null)}>
        <StructuralPressable style={styles.modalBackdrop} onPress={() => setInfoModal(null)}>
          <StructuralPressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{infoModal?.title}</Text>
            <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.infoBody}>{infoModal?.body}</Text>
            </ScrollView>
            <Pressable
              onPress={() => setInfoModal(null)}
              style={({ pressed }) => [styles.editCancel, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.editCancelText}>Close</Text>
            </Pressable>
          </StructuralPressable>
        </StructuralPressable>
      </Modal>

      {shareNote ? (
        <View pointerEvents="none" style={styles.shareToast}>
          <Text style={styles.shareToastText}>{shareNote}</Text>
        </View>
      ) : null}
    </GradientBackground>
  );
}

const formatTime12 = (t: string) => {
  const [hStr, mStr] = t.split(":");
  let h = Number(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${(mStr ?? "00").padStart(2, "0")} ${ampm}`;
};

const PRIVACY_TEXT =
  "Shape respects your privacy. We collect only the information needed to run your account and personalize your workouts, nutrition, and progress tracking, such as your profile details, activity, and photos you choose to add.\n\nYour progress photos stay private to your account. We never sell your personal data. You can request deletion of your account and data at any time from Support.\n\nThis is placeholder copy for the demo build; the full, legally-reviewed policy will replace it before launch.";

const ABOUT_TEXT =
  "Everything you need to feel your best, in one place. Shape pairs Ajay's guided workouts with easy hydration and calorie tracking, progress photos, and a supportive community, so building better habits actually feels good.\n\nWe're here to help you show up for yourself, one session at a time.\n\nShape · v1.0";

const SUPPORT_TEXT =
  "Need a hand? We're here to help.\n\nEmail us at support@shape.app and we'll get back to you within 1–2 business days. Please include your account email and a short description of what's happening.\n\nThis is placeholder contact info for the demo build.";

function bmiCategory(b: number) {
  if (b < 18.5) return "Underweight";
  if (b < 25) return "Normal";
  if (b < 30) return "Overweight";
  return "Obese";
}

function bmiSummaryCategory(b: number) {
  if (b < 18.5) return "Under";
  if (b < 25) return "Normal";
  if (b < 30) return "Over";
  return "Obese";
}

function bmiSummaryPillStyle(b: number, colors: AppColors) {
  if (b < 18.5) return { backgroundColor: colors.accentTintMd };
  if (b < 25) return { backgroundColor: colors.successTint };
  if (b < 30) return { backgroundColor: colors.highlightTintMd };
  return { backgroundColor: colors.blush };
}

function bmiSummaryTextStyle(b: number, colors: AppColors) {
  if (b < 18.5) return { color: colors.accent };
  if (b < 25) return { color: colors.success };
  if (b < 30) return { color: colors.highlight };
  return { color: colors.danger };
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
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 220, reduceMotion: ReduceMotion.System });
  }, [progress, value]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 18 }],
  }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      style={[styles.toggleTrack, value ? styles.toggleTrackOn : styles.toggleTrackOff]}
    >
      <Animated.View style={[styles.toggleThumb, thumbStyle]} />
    </Pressable>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  tabBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(62, 39, 51, 0.07)",
    paddingBottom: 10,
    marginTop: 18,
    marginBottom: 20,
  },
  tabPress: { alignItems: "center", gap: 5 },
  tabText: { fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.mutedForeground },
  tabActiveText: { fontFamily: fonts.sansBold, color: colors.foreground },
  tabDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "transparent" },
  tabDotActive: { backgroundColor: colors.primary },
  notifRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, paddingHorizontal: 14 },
  notifTextWrap: { flex: 1, paddingRight: 12 },
  notifTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  notifSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, marginTop: 3 },
  notifChip: {
    marginRight: 10,
    borderRadius: 999,
    backgroundColor: colors.blush,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  notifChipText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accentDark },
  settingsCard: { paddingVertical: 4 },
  settingsDivider: { height: 1, backgroundColor: colors.cardBorder, marginHorizontal: 14 },
  restCard: { padding: 18 },
  restTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
  restSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 3 },
  restDayRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 18 },
  restDay: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(62, 39, 51, 0.06)",
  },
  restDayActive: { backgroundColor: colors.foreground },
  restDayText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.mutedForeground },
  restDayTextActive: { color: colors.onPrimary },
  referCard: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  referIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  referTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
  referSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 3 },
  referCode: { fontFamily: fonts.sansBold, color: colors.primary },
  inviteBtn: {
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 11,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  inviteText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.onPrimary },
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
  toggleTrack: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: "center" },
  toggleTrackOn: { backgroundColor: colors.primary },
  toggleTrackOff: { backgroundColor: "rgba(16,17,17,0.25)" },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF" },
  // Outer layer holds the drop shadow; the inner card clips its contents with
  // overflow:hidden (which would otherwise suppress the shadow on iOS).
  // A soft neutral lift only - no coloured glow.
  headerPanel: {
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    shadowColor: colors.foreground,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  memberCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(228, 93, 135, 0.22)",
    borderRadius: colors.radiusLg,
    overflow: "hidden",
  },
  cover: { height: 118 },
  // Soft highlight in the cover's top-right — an approximation of the design's
  // CSS radial-gradient (React Native has no native radial gradient).
  coverGlow: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  wordmark: {
    position: "absolute",
    top: 16,
    left: 20,
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.accent,
  },
  premiumBadge: {
    position: "absolute",
    top: 14,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    shadowColor: "#6E4A18",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  premiumText: { fontFamily: fonts.sansBold, fontSize: 9, letterSpacing: 0.5, color: "#6E4A18" },
  memberBody: {
    paddingHorizontal: 22,
    paddingBottom: 22,
    marginTop: -54,
    alignItems: "center",
  },
  editWrap: { width: "100%", marginTop: 12 },
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
  avatarWrap: { width: 100, height: 100 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3E2733",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  avatarText: { fontFamily: fonts.serifSemibold, fontSize: 34, color: palette.white },
  cameraBadge: {
    position: "absolute",
    bottom: 4,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { fontFamily: fonts.serifSemibold, fontSize: 26, color: colors.foreground, flexShrink: 1, textAlign: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 },
  avatarErrorText: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger, marginTop: 6, textAlign: "center" },
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
  choiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 10,
  },
  choiceRowActive: { borderColor: colors.primary, backgroundColor: colors.accentTint },
  choiceLabel: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  choiceLabelActive: { color: colors.primary },
  choiceDetail: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingVertical: 8,
    marginBottom: 4,
  },
  timeStepper: { alignItems: "center", gap: 6 },
  timeStepBtn: {
    width: 40,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  timeValue: { fontFamily: fonts.serifSemibold, fontSize: 30, color: colors.foreground, minWidth: 130, textAlign: "center" },
  timeHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, textAlign: "center", marginBottom: 12 },
  infoScroll: { maxHeight: 320, marginBottom: 12 },
  infoBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.foreground },
  shareToast: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    backgroundColor: colors.foreground,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  shareToastText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.background },
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
  streakLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9 },
  streakSeg: { flexDirection: "row", alignItems: "center", gap: 4 },
  streakText: { fontFamily: fonts.sansSemibold, fontSize: 12.5, color: "rgba(62,39,51,0.55)" },
  streakStrong: { fontFamily: fonts.sansBold, color: colors.foreground },
  streakDot: { width: 3, height: 3, borderRadius: 999, backgroundColor: "rgba(62,39,51,0.3)" },
  statsStrip: {
    flexDirection: "row",
    alignSelf: "stretch",
    marginTop: 18,
    backgroundColor: "#FBF3F6",
    borderRadius: 18,
    paddingVertical: 13,
  },
  statCell: { flex: 1, alignItems: "center" },
  statCellDivider: { borderRightWidth: 1, borderRightColor: colors.cardBorder },
  statNum: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground },
  statLbl: {
    fontFamily: fonts.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: "rgba(62,39,51,0.45)",
    marginTop: 6,
    textAlign: "center",
  },
  // Reserved in every cell so all four columns stay equal-height (aligned
  // numbers, full-height dividers); only the weight cell fills it with a pill.
  statDeltaSlot: { height: 20, marginTop: 5, alignItems: "center", justifyContent: "center" },
  deltaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  deltaPillDown: { backgroundColor: colors.successTint },
  deltaPillUp: { backgroundColor: colors.highlightTint },
  deltaText: { fontFamily: fonts.sansBold, fontSize: 10.5 },
  bmiSummaryPill: {
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  bmiSummaryText: { fontFamily: fonts.sansBold, fontSize: 10.5 },
  label: {
    fontFamily: fonts.sansSemibold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.mutedForeground,
    marginTop: 26,
    marginBottom: 12,
  },
  weightGoalCard: { marginTop: 24 },
  labelWithTip: { flexDirection: "row", alignItems: "center", gap: 6 },
  weightGoalTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weightGoalLabel: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 2, color: colors.mutedForeground },
  weightGoalToGo: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primary },
  weightRingWrap: { alignItems: "center", marginTop: 14 },
  weightRingNum: { fontFamily: fonts.serifSemibold, fontSize: 30, lineHeight: 34, color: colors.foreground },
  weightRingUnit: { fontFamily: fonts.sansBold, fontSize: 9, letterSpacing: 1.2, color: colors.mutedForeground },
  weightGoalCopy: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.mutedForeground, textAlign: "center", marginTop: 12 },
  weightGoalStrong: { fontFamily: fonts.sansBold, color: colors.foreground },
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
  goalWeightModalField: { flex: 0 },
  goalWeightInput: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.foreground, paddingVertical: 12 },
  goalWeightUnit: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.mutedForeground, marginLeft: 8 },
  goalWeightError: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger, marginTop: 8 },
  shareStreakCard: {
    marginTop: 18,
    borderRadius: colors.radius,
    padding: 16,
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  shareDaysBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareDaysNum: { fontFamily: fonts.serifSemibold, fontSize: 19, lineHeight: 20, color: colors.onPrimary },
  shareDaysText: { fontFamily: fonts.sansBold, fontSize: 8, letterSpacing: 0.6, color: colors.onPrimary },
  shareTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.onPrimary },
  shareSub: { fontFamily: fonts.sans, fontSize: 11.5, color: "rgba(255,255,255,0.9)", marginTop: 2 },
  shareBtn: { borderRadius: 999, backgroundColor: colors.onPrimary, paddingHorizontal: 22, paddingVertical: 10 },
  shareBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.primary },
  memberSinceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  memberSinceLine: { flex: 1, height: 1, backgroundColor: colors.cardBorder },
  memberSinceText: { fontFamily: fonts.serifItalic, fontSize: 12, color: colors.mutedForeground },
  version: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, textAlign: "center", marginTop: 18 },
  historyStatsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 14,
  },
  historyStat: {
    flex: 1,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: colors.cardBorder,
  },
  historyStatLast: { borderRightWidth: 0 },
  historyStatNum: { fontFamily: fonts.sansBold, fontSize: 19, color: colors.foreground },
  historyStatAccent: { color: colors.primary },
  historyStatLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: "rgba(62, 39, 51, 0.4)",
    marginTop: 2,
  },
  historyCard: { marginTop: 20 },
  historyCardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 },
  historyEyebrow: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.8, color: colors.mutedForeground },
  historyActive: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.accentDark },
  weekdayRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.sansBold,
    fontSize: 9.5,
    color: "rgba(62, 39, 51, 0.35)",
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  calendarCell: {
    width: "12.8%",
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.track,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  calendarCellActive: { backgroundColor: colors.primary },
  calendarCellToday: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.blushSurface },
  calendarCellBlank: { backgroundColor: "transparent" },
  calendarDay: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.muted, textAlign: "center", textAlignVertical: "center", includeFontPadding: false },
  calendarDayActive: { color: colors.onPrimary },
  calendarDayToday: { color: colors.primary },
  historyTrendPill: {
    borderRadius: 999,
    backgroundColor: colors.successTint,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  historyTrendText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.success },
  historyWeightRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 10 },
  historyWeightNum: { fontFamily: fonts.serifSemibold, fontSize: 30, color: colors.foreground },
  historyWeightUnit: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  historyWorkoutRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  historyWorkoutThumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  historyWorkoutTitle: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  historyWorkoutSub: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.mutedForeground, marginTop: 2 },
  historyWorkoutDay: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.mutedForeground },
  historyEmptyBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  historyEmpty: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 19 },
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
