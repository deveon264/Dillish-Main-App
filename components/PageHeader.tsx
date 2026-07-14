import React, { ReactNode } from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from "react-native";
import type { AppColors } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

// Single source of truth for the page-header and section-label type scale shared
// across the app. Tweak the look here and every screen follows.
//
// Two scales are supported:
// - "default" (tab screens): title 34 / eyebrow letterSpacing 2
// - "compact" (stacked/back-button screens like the library and admin tools):
//   title 30 / eyebrow letterSpacing 3
//
// Other screens that borrow these type tokens resolve them per-theme with
// `useThemedStyles(createPageHeaderStyles)`.
export const createPageHeaderStyles = (colors: AppColors) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accentDark, letterSpacing: 3 },
  eyebrowCompact: { letterSpacing: 3 },
  title: { fontFamily: fonts.serifMedium, fontSize: 32, color: colors.foreground, marginTop: 5, lineHeight: 37 },
  titleCompact: { fontSize: 27, lineHeight: 32 },
  titleAccent: { fontFamily: fonts.serifItalic, fontStyle: "italic", color: colors.foreground },
  sectionLabel: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.8, color: colors.mutedForeground },
});

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  accent?: string;
  action?: ReactNode;
  leading?: ReactNode;
  variant?: "default" | "compact";
  style?: StyleProp<ViewStyle>;
};

// Optional eyebrow + serif title with an optional italic accent word. Supports a
// leading element (e.g. a back button) and a trailing action (e.g. a HelpButton).
export function PageHeader({
  eyebrow,
  title,
  accent,
  action,
  leading,
  variant = "default",
  style,
}: PageHeaderProps) {
  const pageHeaderStyles = useThemedStyles(createPageHeaderStyles);
  const compact = variant === "compact";
  return (
    <View style={[pageHeaderStyles.header, style]}>
      {leading}
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text style={[pageHeaderStyles.eyebrow, compact && pageHeaderStyles.eyebrowCompact]}>{eyebrow}</Text>
        ) : null}
        <Text style={[pageHeaderStyles.title, compact && pageHeaderStyles.titleCompact]}>
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
  const pageHeaderStyles = useThemedStyles(createPageHeaderStyles);
  return <Text style={[pageHeaderStyles.sectionLabel, style]}>{children}</Text>;
}
