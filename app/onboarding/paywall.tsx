import React, { useState } from "react";
import { View, StyleSheet, ScrollView, type LayoutChangeEvent } from "react-native";
import { useRouter } from "expo-router";
import { useInsets } from "@/hooks/useInsets";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PLANS as CATALOG, TRIAL_DAYS, PLAN_ORDER, type PlanKey } from "@/lib/subscription";
import type { AppColors } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useColors";
import { ScreenEntrance } from "@/components/Motion";
import { haptics } from "@/lib/haptics";
import { PaywallHero } from "@/components/paywall/PaywallHero";
import { FeatureCard } from "@/components/paywall/FeatureCard";
import { PricingPlanCard } from "@/components/paywall/PricingPlanCard";
import { TrustIndicatorRow } from "@/components/paywall/TrustIndicatorRow";
import { PaywallCTA } from "@/components/paywall/PaywallCTA";
import { LegalFooter } from "@/components/paywall/LegalFooter";
import { PreviewModal } from "@/components/paywall/PreviewModal";

// Plans are shown recommended-first. Billing sub-labels are presentation copy;
// every price, period, and savings number still comes from the shared catalog
// (lib/subscription) so the paywall can never drift from the Plan tab or billing.
const DISPLAY_ORDER: PlanKey[] = ["yearly", "monthly", "weekly"];

const BILLING_COPY: Record<PlanKey, string> = {
  yearly: "Billed annually",
  monthly: "Billed monthly",
  weekly: "Billed weekly",
};

// Derives the "$3.33 / month" equivalent from the yearly amount so it tracks the
// catalog price instead of being typed in by hand.
function perMonthLabel(amountLabel: string): string {
  const n = parseFloat(amountLabel.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return "";
  const symbol = amountLabel.replace(/[0-9.,\s]/g, "") || "$";
  return `${symbol}${(n / 12).toFixed(2)} / month`;
}

export default function Paywall() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { subscribe } = useSubscription();

  const [selected, setSelected] = useState<PlanKey>("yearly");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [footerHeight, setFooterHeight] = useState(200);

  // Every exit from the paywall routes through the thank-you video, which plays
  // once (or skips straight through when none is set) and then hands off to the
  // dashboard. `replace` keeps the back gesture from returning here.
  const proceed = () => router.replace("/onboarding/thank-you");

  // The CTA starts the chosen plan with a free trial before continuing. The
  // reference has no trial toggle, so the trial is always on. Fire-and-forget so
  // navigation is never blocked; the Plan tab reconciles with the server later.
  const subscribeAndProceed = () => {
    subscribe(selected, { trial: true });
    haptics.success();
    proceed();
  };

  const onSelect = (key: PlanKey) => {
    if (key === selected) return;
    haptics.selection();
    setSelected(key);
  };

  const onFooterLayout = (e: LayoutChangeEvent) => {
    setFooterHeight(e.nativeEvent.layout.height);
  };

  // Fall back to the catalog's own order if DISPLAY_ORDER ever drifts out of
  // sync with the catalog, so every plan still renders exactly once.
  const order = DISPLAY_ORDER.every((k) => CATALOG[k]) ? DISPLAY_ORDER : PLAN_ORDER;

  return (
    <View style={styles.root}>
      <ScreenEntrance style={styles.fill}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: footerHeight + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <PaywallHero
            onClose={() => router.back()}
            onSkip={proceed}
            onWatchPreview={() => setPreviewOpen(true)}
          />

          <FeatureCard />

          <View style={styles.plans}>
            {order.map((key) => {
              const info = CATALOG[key];
              const featured = key === "yearly";
              const save = featured ? info.fullLabel.match(/Save\s+\d+%/i)?.[0] : undefined;
              return (
                <PricingPlanCard
                  key={key}
                  name={info.name}
                  billing={BILLING_COPY[key]}
                  priceMain={info.amountLabel}
                  priceSuffix={featured ? undefined : info.periodLabel}
                  featured={featured}
                  savePill={save}
                  perMonth={featured ? perMonthLabel(info.amountLabel) : undefined}
                  cancelNote={featured ? "Cancel anytime" : undefined}
                  tagline={featured ? "Most popular choice" : undefined}
                  selected={selected === key}
                  onSelect={() => onSelect(key)}
                />
              );
            })}
          </View>

          <View style={styles.trust}>
            <TrustIndicatorRow />
          </View>
        </ScrollView>
      </ScreenEntrance>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
        onLayout={onFooterLayout}
      >
        <PaywallCTA
          label={`Start ${TRIAL_DAYS}-Day Free Trial`}
          note="No payment today. Cancel anytime."
          onPress={subscribeAndProceed}
        />
        <LegalFooter />
      </View>

      <PreviewModal visible={previewOpen} onClose={() => setPreviewOpen(false)} />
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    fill: { flex: 1 },
    scroll: { paddingHorizontal: 0 },
    plans: { marginTop: 24, paddingHorizontal: 20, gap: 12 },
    trust: { marginTop: 22, paddingHorizontal: 24 },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 24,
      paddingTop: 14,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
  });
