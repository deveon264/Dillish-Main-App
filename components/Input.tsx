import React, { useState } from "react";
import { View, TextInput, StyleSheet, Pressable, TextInputProps, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

type IconName = keyof typeof Ionicons.glyphMap;

type Props = TextInputProps & {
  icon?: IconName;
  password?: boolean;
  label?: string;
};

export function Input({ icon, password, label, style, ...rest }: Props) {
  const [hidden, setHidden] = useState(!!password);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, focused && styles.fieldFocused]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.mutedForeground} style={styles.icon} /> : null}
        <TextInput
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, style]}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          {...rest}
        />
        {password ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
