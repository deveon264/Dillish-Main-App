import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useInsets } from "@/hooks/useInsets";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

type IconConf =
  | { lib: "ion"; name: keyof typeof Ionicons.glyphMap; nameFocused: keyof typeof Ionicons.glyphMap }
  | { lib: "mci"; name: keyof typeof MaterialCommunityIcons.glyphMap; nameFocused: keyof typeof MaterialCommunityIcons.glyphMap };

const CONF: Record<string, { label: string; icon: IconConf }> = {
  index: { label: "Home", icon: { lib: "ion", name: "home-outline", nameFocused: "home" } },
  workouts: { label: "Workouts", icon: { lib: "mci", name: "dumbbell", nameFocused: "dumbbell" } },
  tracker: { label: "Tracker", icon: { lib: "ion", name: "flame-outline", nameFocused: "flame" } },
  progress: { label: "Progress", icon: { lib: "ion", name: "stats-chart-outline", nameFocused: "stats-chart" } },
  community: { label: "Community", icon: { lib: "ion", name: "people-outline", nameFocused: "people" } },
  profile: { label: "Profile", icon: { lib: "ion", name: "person-outline", nameFocused: "person" } },
};

const ORDER = ["index", "workouts", "tracker", "progress", "community", "profile"];

type TabBarProps = Pick<BottomTabBarProps, "state" | "navigation">;

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useInsets();

  const routesByName = Object.fromEntries(state.routes.map((r) => [r.name, r]));

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.bar}>
        {/* Native frosted-glass blur — content scrolls through it on iOS. */}
        <BlurView
          intensity={Platform.OS === "android" ? 40 : 55}
          tint="light"
          experimentalBlurMethod="dimezisBlurView"
          style={[StyleSheet.absoluteFill, styles.noTouch]}
        />
        {/* Warm translucent wash so the glass keeps the brand tone and reads
            cleanly even where native blur is limited (web/older Android). */}
        <View style={[StyleSheet.absoluteFill, styles.glassTint, styles.noTouch]} />
        <View style={styles.row}>
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

            const color = focused ? colors.primary : colors.mutedForeground;
            const iconName = focused ? conf.icon.nameFocused : conf.icon.name;

            return (
              <Pressable key={name} style={styles.item} onPress={onPress}>
                <View style={[styles.itemInner, focused && styles.itemInnerActive]}>
                  {conf.icon.lib === "ion" ? (
                    <Ionicons name={iconName as keyof typeof Ionicons.glyphMap} size={22} color={color} />
                  ) : (
                    <MaterialCommunityIcons name={iconName as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={color} />
                  )}
                  <Text numberOfLines={1} style={[styles.label, { color }, focused && styles.labelActive]}>{conf.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
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
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  bar: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.tabBarGlassBorder,
    // Clip the blur layer to the rounded pill.
    overflow: "hidden",
  },
  glassTint: {
    backgroundColor: colors.tabBarGlass,
  },
  noTouch: {
    pointerEvents: "none",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  item: { flex: 1, alignItems: "center" },
  itemInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 3,
    borderRadius: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: "transparent",
  },
  itemInnerActive: {
    backgroundColor: colors.accentTintMd,
    borderColor: colors.accentBorder,
  },
  label: { fontFamily: fonts.sansMedium, fontSize: 10 },
  labelActive: { fontFamily: fonts.sansSemibold },
});
