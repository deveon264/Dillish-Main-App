import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "@/components/Button";
import type { AppColors } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

type Props = {
  label: string;
  note: string;
  onPress: () => void;
};

// Primary conversion control: the app's gradient pill button plus a small
// reassurance line beneath it.
export function PaywallCTA({ label, note, onPress }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View>
      <Button label={label} iconRight="arrow-forward" onPress={onPress} testID="paywall-cta" />
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    note: {
      fontFamily: fonts.sansSemibold,
      fontSize: 13,
      color: colors.primary,
      textAlign: "center",
      marginTop: 10,
    },
  });
