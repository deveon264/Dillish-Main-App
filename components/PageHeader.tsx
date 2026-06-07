import React, { ReactNode } from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from "react-native";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

// Single source of truth for the page-header and section-label type scale shared
// across the tab screens. Tweak the look here and every tab follows.
export const pageHeaderStyles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  eyebrow: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted, letterSpacing: 2 },
  title: { fontFamily: fonts.serif, fontSize: 34, color: colors.foreground, marginTop: 2 },
  titleAccent: { fontFamily: fonts.serifItalic, fontStyle: "italic", color: colors.foreground },
  sectionLabel: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 2, color: colors.muted },
});

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  accent?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Eyebrow + serif title with an optional italic accent word, plus an optional
// trailing action (e.g. a HelpButton).
export function PageHeader({ eyebrow, title, accent, action, style }: PageHeaderProps) {
  return (
    <View style={[pageHeaderStyles.header, style]}>
      <View style={{ flex: 1 }}>
        <Text style={pageHeaderStyles.eyebrow}>{eyebrow}</Text>
        <Text style={pageHeaderStyles.title}>
          {accent ? (
            <>
              {title} <Text style={pageHeaderStyles.titleAccent}>{accent}</Text>
            </>
          ) : (
            title
          )}
        </Text>
      </View>
      {action}
    </View>
  );
}

type SectionLabelProps = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
};

// Small uppercase section label. Layout spacing (margins) is supplied by callers
// via `style`; the type token lives here.
export function SectionLabel({ children, style }: SectionLabelProps) {
  return <Text style={[pageHeaderStyles.sectionLabel, style]}>{children}</Text>;
}
