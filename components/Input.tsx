import React, { forwardRef, useRef, useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  Text,
  InputAccessoryView,
  Keyboard,
  Platform,
} from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Ionicons } from "@expo/vector-icons";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

type IconName = keyof typeof Ionicons.glyphMap;

type Props = TextInputProps & {
  icon?: IconName;
  password?: boolean;
  label?: string;
  dismissKeyboardAccessory?: boolean;
};

const NUMERIC_KEYBOARDS = new Set(["number-pad", "decimal-pad", "numeric", "phone-pad"]);
let nextAccessoryId = 0;

function isNumericKeyboard(keyboardType: TextInputProps["keyboardType"]): boolean {
  return !!keyboardType && NUMERIC_KEYBOARDS.has(String(keyboardType));
}

export const Input = forwardRef<TextInput, Props>(function Input(
  {
    icon,
    password,
    label,
    style,
    dismissKeyboardAccessory,
    keyboardType,
    returnKeyType,
    onSubmitEditing,
    inputAccessoryViewID,
    onFocus,
    onBlur,
    ...rest
  },
  forwardedRef,
) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const [hidden, setHidden] = useState(!!password);
  const [focused, setFocused] = useState(false);
  const accessoryIdRef = useRef<string>("");

  if (!accessoryIdRef.current) {
    nextAccessoryId += 1;
    accessoryIdRef.current = `input-done-accessory-${nextAccessoryId}`;
  }

  const isNumeric = isNumericKeyboard(keyboardType);
  const shouldDismissKeyboard = dismissKeyboardAccessory ?? isNumeric;
  const resolvedAccessoryId = inputAccessoryViewID ?? accessoryIdRef.current;
  const showAutoAccessory = Platform.OS === "ios" && shouldDismissKeyboard && !inputAccessoryViewID;
  const resolvedReturnKeyType = returnKeyType ?? (shouldDismissKeyboard ? "done" : undefined);
  const resolvedOnSubmitEditing = onSubmitEditing ?? (shouldDismissKeyboard ? () => Keyboard.dismiss() : undefined);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, focused && styles.fieldFocused]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.mutedForeground} style={styles.icon} /> : null}
        <TextInput
          ref={forwardedRef}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, style]}
          secureTextEntry={hidden}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          autoCapitalize="none"
          keyboardType={keyboardType}
          returnKeyType={resolvedReturnKeyType}
          onSubmitEditing={resolvedOnSubmitEditing}
          inputAccessoryViewID={shouldDismissKeyboard ? resolvedAccessoryId : inputAccessoryViewID}
          {...rest}
        />
        {password ? (
          <Pressable
            onPress={() => {
              haptics.selection();
              setHidden((value) => !value);
            }}
            hitSlop={10}
          >
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {showAutoAccessory ? (
        <InputAccessoryView nativeID={resolvedAccessoryId}>
          <View style={styles.accessory}>
            <Pressable style={styles.doneButton} onPress={Keyboard.dismiss} hitSlop={8}>
              <Ionicons name="checkmark" size={18} color={colors.accent} />
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
});

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { width: "100%", marginBottom: 14 },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 8,
    marginLeft: 2,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    minHeight: 54,
  },
  fieldFocused: { borderColor: colors.accent },
  icon: { marginRight: 10 },
  input: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
    paddingVertical: 14,
  },
  accessory: {
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  doneButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  doneText: {
    fontFamily: fonts.sansSemibold,
    fontSize: 15,
    color: colors.accent,
  },
});
