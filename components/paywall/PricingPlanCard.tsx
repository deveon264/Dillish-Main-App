import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ReduceMotion,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Bouncy } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

export type PricingPlanCardProps = {
  name: string;
  billing: string;
  priceMain: string;
  // Suffix shown after the price on compact plans, e.g. "/ month".
  priceSuffix?: string;
  featured?: boolean;
  savePill?: string;
  perMonth?: string;
  cancelNote?: string;
  tagline?: string;
  selected: boolean;
  onSelect: () => void;
};

// The animated selection dot, so tapping a plan feels responsive without a
// jarring snap. Under ~180ms and honours reduced-motion.
function Radio({ selected }: { selected: boolean }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const p = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    p.value = withTiming(selected ? 1 : 0, {
      duration: 180,
      reduceMotion: ReduceMotion.System,
    });
  }, [selected, p]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.5 + p.value * 0.5 }],
  }));

  return (
    <View style={[styles.radio, selected && styles.radioOn]}>
      <Animated.View style={[styles.radioDot, dotStyle]} />
    </View>
  );
}

export function PricingPlanCard(props: PricingPlanCardProps) {
  const {
    name,
    billing,
    priceMain,
    priceSuffix,
    featured,
    savePill,
    perMonth,
    cancelNote,
    tagline,
    selected,
    onSelect,
  } = props;
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <Bouncy
      onPress={onSelect}
      pressedScale={0.985}
      style={[
        styles.card,
        featured ? styles.cardFeatured : styles.cardPlain,
        selected && !featured && styles.cardPlainSelected,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name} plan, ${priceMain}${priceSuffix ? " " + priceSuffix : ""}`}
    >
      {featured ? (
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.badge}
        >
          <Text style={styles.badgeText}>BEST VALUE</Text>
        </LinearGradient>
      ) : null}

      <View style={styles.main}>
        <Radio selected={selected} />

        <View style={styles.left}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.billing}>{billing}</Text>
          {cancelNote ? <Text style={styles.cancelNote}>{cancelNote}</Text> : null}
        </View>

        {featured ? (
          <>
            <View style={styles.priceCol}>
              <Text style={styles.priceMain}>{priceMain}</Text>
              {savePill ? (
                <View style={styles.savePill}>
                  <Text style={styles.savePillText}>{savePill}</Text>
                </View>
              ) : null}
            </View>
            {perMonth ? (
              <>
                <View style={styles.vDivider} />
                <View style={styles.perMonthCol}>
                  {(() => {
                    // "$3.33 / month" → an amount over its period, so the callout
                    // reads as a tidy two-line unit instead of an awkward wrap.
                    const [amount, ...rest] = perMonth.split(" / ");
                    const period = rest.join(" / ");
                    return (
                      <>
                        <Text style={styles.perMonthAmount}>{amount}</Text>
                        {period ? <Text style={styles.perMonth}>/ {period}</Text> : null}
                      </>
                    );
                  })()}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <View style={styles.priceRowPlain}>
            <Text style={styles.priceMainPlain}>{priceMain}</Text>
            {priceSuffix ? <Text style={styles.priceSuffix}> {priceSuffix}</Text> : null}
          </View>
        )}
      </View>

      {featured && tagline ? (
        <>
          <View style={styles.hDivider} />
          <View style={styles.taglineRow}>
            <Ionicons name="sparkles" size={14} color={colors.primary} />
            <Text style={styles.tagline}>{tagline}</Text>
          </View>
        </>
      ) : null}
    </Bouncy>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      borderRadius: colors.radiusLg,
      padding: 18,
    },
    cardFeatured: {
      backgroundColor: colors.blushSurface,
      borderWidth: 1.5,
      borderColor: colors.primary,
      paddingTop: 22,
    },
    cardPlain: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    cardPlainSelected: {
      borderColor: colors.primary,
    },
    badge: {
      position: "absolute",
      top: -11,
      left: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
    },
    badgeText: {
      fontFamily: fonts.sansBold,
      fontSize: 10,
      color: colors.onPrimaryStrong,
      letterSpacing: 1,
    },
    main: { flexDirection: "row", alignItems: "center" },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.accentBorderMd,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOn: { borderColor: colors.primary },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
    left: { flex: 1, marginLeft: 14 },
    name: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
    billing: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
    cancelNote: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.primary, marginTop: 3 },
    // Featured price cluster.
    priceCol: { alignItems: "center" },
    priceMain: { fontFamily: fonts.serifSemibold, fontSize: 26, color: colors.foreground },
    savePill: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginTop: 6,
    },
    savePillText: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.onPrimaryStrong,
    },
    vDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.cardBorder,
      marginHorizontal: 14,
    },
    perMonthCol: { width: 62 },
    perMonthAmount: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
    perMonth: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 16, color: colors.muted },
    // Compact plan price.
    priceRowPlain: { flexDirection: "row", alignItems: "baseline" },
    priceMainPlain: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
    priceSuffix: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
    // Featured footer.
    hDivider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginTop: 16,
      marginBottom: 12,
    },
    taglineRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    tagline: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.primary },
  });
