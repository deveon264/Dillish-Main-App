import React from "react";
import { Platform } from "react-native";
import { KeyboardToolbar } from "react-native-keyboard-controller";
import { useColors } from "@/hooks/useColors";

export function KeyboardFormToolbar({ showArrows = true }: { showArrows?: boolean }) {
  const colors = useColors();

  if (Platform.OS !== "ios") return null;

  const palette = {
    primary: colors.accent,
    disabled: colors.mutedForeground,
    background: colors.card,
    ripple: colors.accentTint,
  };
  const theme = { light: palette, dark: palette };

  return <KeyboardToolbar theme={theme} showArrows={showArrows} doneText="Done" />;
}
