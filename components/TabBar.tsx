import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useInsets } from "@/hooks/useInsets";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

type IconConf =
  | { lib: "ion"; name: keyof typeof Ionicons.glyphMap }
  | { lib: "mci"; name: keyof typeof MaterialCommunityIcons.glyphMap };

const CONF: Record<string, { label: string; icon: IconConf; center?: boolean }> = {
  index: { label: "Home", icon: { lib: "ion", name: "home-outline" } },
  workouts: { label: "Explore", icon: { lib: "mci", name: "dumbbell" } },
  calories: { label: "AI Scan", icon: { lib: "ion", name: "sparkles" }, center: true },
  water: { label: "Water", icon: { lib: "ion", name: "water-outline" } },
  profile: { label: "Profile", icon: { lib: "ion", name: "person-outline" } },
};

const ORDER = ["index", "workouts", "calories", "water", "profile"];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useInsets();

  const routesByName = Object.fromEntries(state.routes.map((r) => [r.name, r]));

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.bar}>
        {ORDER.map((name) => {
          const route = routesByName[name];
          if (!route) return null;
          const conf = CONF[name];
          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const focused = state.index === routeIndex;

          const onPress = () => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          if (conf.center) {
            return (
              <Pressable key={name} style={styles.centerWrap} onPress={onPress}>
                <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.center}>
                  <Ionicons name="sparkles" size={24} color={colors.onPrimary} />
                </LinearGradient>
              </Pressable>
            );
          }

          const color = focused ? colors.accent : colors.mutedForeground;
          return (
            <Pressable key={name} style={styles.item} onPress={onPress}>
              {conf.icon.lib === "ion" ? (
                <Ionicons name={conf.icon.name} size={23} color={color} />
              ) : (
                <MaterialCommunityIcons name={conf.icon.name} size={23} color={color} />
              )}
              <Text style={[styles.label, { color }]}>{conf.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(40,30,28,0.96)",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  item: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 4 },
  label: { fontFamily: fonts.sansMedium, fontSize: 10.5 },
  centerWrap: { flex: 1, alignItems: "center" },
  center: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
