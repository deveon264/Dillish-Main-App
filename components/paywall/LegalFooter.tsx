import React from "react";
import { Text, StyleSheet } from "react-native";
import type { AppColors } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

// Small print under the CTA. "Terms of Service" / "Privacy Policy" are shown as
// plain emphasized text because the app surfaces those through an in-app modal
// rather than dedicated routes; wire onPress handlers here if routes are added.
export function LegalFooter() {
  const styles = useThemedStyles(createStyles);
  return (
    <Text style={styles.legal}>
      By continuing you agree to our <Text style={styles.emphasis}>Terms of Service</Text> and{" "}
      <Text style={styles.emphasis}>Privacy Policy</Text>. Billing isn't live yet, so you won't be
      charged.
    </Text>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    legal: {
      fontFamily: fonts.sans,
      fontSize: 11,
      lineHeight: 16,
      color: colors.muted,
      textAlign: "center",
      marginTop: 12,
    },
    emphasis: {
      fontFamily: fonts.sansMedium,
      color: colors.mutedForeground,
    },
  });
