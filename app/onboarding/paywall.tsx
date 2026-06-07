import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GradientBackground } from "@/components/GradientBackground";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { pageHeaderStyles } from "@/components/PageHeader";
import { useInsets } from "@/hooks/useInsets";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PLANS as PLAN_CATALOG, TRIAL_DAYS, type PlanKey } from "@/lib/subscription";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

// Display order on the paywall (recommended first). Prices, period labels, and
// the summary line all come from the shared catalog in lib/subscription so the
// numbers here always match the Plan tab and billing.
const PLAN_DISPLAY_ORDER: PlanKey[] = ["yearly", "monthly", "weekly"];

const PLAN_BILLING_COPY: Record<PlanKey, string> = {
  yearly: "Billed annually",
  monthly: "Billed every month",
  weekly: "Billed every week",
};

const PLANS = PLAN_DISPLAY_ORDER.map((key) => {
  const info = PLAN_CATALOG[key];
  // The savings callout ("Save 67%") lives in the catalog's fullLabel so it
  // stays in lockstep with the prices instead of being re-typed here.
  const save = info.fullLabel.match(/Save\s+\d+%/i)?.[0];
  return {
    key,
    info,
    sub: save ? `${PLAN_BILLING_COPY[key]} · ${save}` : PLAN_BILLING_COPY[key],
    recommended: info.best,
  };
});

const PLAN_PERKS = ["All workouts", "AI calorie tracker", "Progress analytics"];

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "barbell-outline", label: "200+ Workouts" },
  { icon: "restaurant-outline", label: "AI Food Log" },
  { icon: "trending-up-outline", label: "Progress Tracking" },
  { icon: "water-outline", label: "Hydration Goals" },
];

const TRUST: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "card-outline", label: "No card needed" },
  { icon: "refresh-outline", label: "Cancel anytime" },
  { icon: "shield-checkmark-outline", label: "Manage in-app" },
];

const SEGMENTS = 6;

export default function Paywall() {
  const router = useRouter();
  const insets = useInsets();
  const [selected, setSelected] = useState<PlanKey>("yearly");
  const [trial, setTrial] = useState(true);
  const { subscribe } = useSubscription();

  const activePlan = PLANS.find((p) => p.key === selected) ?? PLANS[0];

  const summaryLine = trial
    ? `Start your ${TRIAL_DAYS}-day free trial of ${activePlan.info.fullLabel}, no card needed yet`
    : `Activate ${activePlan.info.fullLabel}, no card needed yet`;

  // Every exit from the paywall — the primary CTA AND the top Skip link — routes
  // through the thank-you video, which auto-plays once and then continues to the
  // dashboard (or skips straight there when no video is set).
  const proceed = () => router.replace("/onboarding/thank-you");

  // The primary CTA starts the chosen subscription (with a trial when toggled
  // on) before continuing. Fire-and-forget so navigation is never blocked; the
  // Plan tab reconciles with the server on next load.
  const subscribeAndProceed = () => {
    subscribe(selected, { trial });
    proceed();
  };

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 150 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Logo size="sm" />
          <Pressable onPress={proceed} hitSlop={10}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.segments}>
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <View key={i} style={[styles.segment, i === SEGMENTS - 1 && styles.segmentActive]} />
          ))}
        </View>

        <Text style={[pageHeaderStyles.title, styles.title]}>
          Start your{"\n"}
          <Text style={pageHeaderStyles.titleAccent}>florish journey</Text>
        </Text>
        <Text style={styles.subtitle}>
          Unlock personalized workouts, calorie tracking, and full wellness features.
        </Text>

        <View style={styles.trialCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.trialTitle}>Free trial included</Text>
            <Text style={styles.trialSub}>{TRIAL_DAYS} days free, cancel anytime</Text>
          </View>
          <Switch
            value={trial}
            onValueChange={setTrial}
            trackColor={{ false: colors.track, true: colors.accent }}
            thumbColor={colors.onPrimary}
            ios_backgroundColor={colors.track}
          />
        </View>

        <View style={styles.plans}>
          {PLANS.map((plan) => {
            const on = plan.key === selected;
            return (
              <Pressable
                key={plan.key}
                onPress={() => setSelected(plan.key)}
                style={[styles.planCard, on && styles.planCardOn, plan.recommended && styles.planCardRecommended]}
              >
                {plan.recommended ? (
                  <LinearGradient
                    colors={colors.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.badge}
                  >
                    <Text style={styles.badgeText}>RECOMMENDED</Text>
                  </LinearGradient>
                ) : null}

                <View style={styles.planMain}>
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>{plan.info.name}</Text>
                    <Text style={styles.planSub}>{plan.sub}</Text>
                  </View>
                  <View style={styles.planPriceWrap}>
                    <View style={styles.priceRow}>
                      <Text style={styles.planPrice}>{plan.info.amountLabel}</Text>
                      <Text style={styles.planPer}> {plan.info.periodLabel}</Text>
                    </View>
                  </View>
                </View>

                {plan.recommended ? (
                  <View style={styles.perksRow}>
                    {PLAN_PERKS.map((perk) => (
                      <View key={perk} style={styles.perk}>
                        <Ionicons name="checkmark" size={14} color={colors.accent} />
                        <Text style={styles.perkText}>{perk}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.featureGrid}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featureTile}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={20} color={colors.accent} />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.trustRow}>
          {TRUST.map((t) => (
            <View key={t.label} style={styles.trustItem}>
              <Ionicons name={t.icon} size={13} color={colors.mutedForeground} />
              <Text style={styles.trustText}>{t.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.summary}>{summaryLine}</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.footerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Button
              label={trial ? "Start Free Trial" : "Subscribe Now"}
              iconRight="arrow-forward"
              onPress={subscribeAndProceed}
            />
          </View>
        </View>
        <Text style={styles.terms}>
          By continuing you agree to our Terms of Service and Privacy Policy. Billing isn't live yet, so you won't be charged, and your coach handles payments for now.
        </Text>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skip: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted, letterSpacing: 1 },
  segments: { flexDirection: "row", gap: 6, marginTop: 22 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.track },
  segmentActive: { backgroundColor: colors.accent },
  title: { fontSize: 38, lineHeight: 40, marginTop: 26 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 12, lineHeight: 22 },
  trialCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 24,
  },
  trialTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  trialSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 3 },
  plans: { marginTop: 16, gap: 12 },
  planCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radiusLg,
    padding: 18,
  },
  planCardOn: { borderColor: colors.accent, backgroundColor: colors.accentTintFaint },
  planCardRecommended: { paddingTop: 24, marginTop: 8 },
  badge: {
    position: "absolute",
    top: -10,
    left: 18,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.onPrimaryStrong, letterSpacing: 1 },
  planMain: { flexDirection: "row", alignItems: "center", gap: 14 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.accentBorderMd,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  planName: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
  planSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
  planPriceWrap: { alignItems: "flex-end" },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  planPrice: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground },
  planPer: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  perksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  perk: { flexDirection: "row", alignItems: "center", gap: 5 },
  perkText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground },
  featureGrid: { flexDirection: "row", gap: 10, marginTop: 24 },
  featureTile: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.foreground, textAlign: "center" },
  trustRow: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 16, marginTop: 22 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  trustText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },
  summary: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 22 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 54,
    height: 54,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  terms: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    textAlign: "center",
    marginTop: 12,
  },
});
