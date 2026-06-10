import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useInsets } from "@/hooks/useInsets";
import { useNotices } from "@/contexts/NoticesContext";
import { useNotifications } from "@/contexts/NotificationsContext";
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
  community: { label: "Circle", icon: { lib: "ion", name: "people-outline", nameFocused: "people" } },
  profile: { label: "Profile", icon: { lib: "ion", name: "person-outline", nameFocused: "person" } },
};

const ORDER = ["index", "workouts", "tracker", "progress", "community", "profile"];

type TabBarProps = Pick<BottomTabBarProps, "state" | "navigation">;

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useInsets();
  const { hasUnread } = useNotices();
  const { unreadCount, refreshUnread } = useNotifications();

  const routesByName = Object.fromEntries(state.routes.map((r) => [r.name, r]));

  // Refresh the unread badge whenever the member lands on the Circle tab, so a
  // like/comment that arrived while they were elsewhere shows up promptly.
  const activeRoute = state.routes[state.index]?.name;
  useEffect(() => {
    if (activeRoute === "community") refreshUnread();
  }, [activeRoute, refreshUnread]);

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 3 }]}>
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
            // The Circle tab carries two signals. An unread like/comment count
            // bubble takes priority; when there are none, a pending moderation
            // notice (warning or block) shows a dot so the member notices it
            // from any screen.
            const showCount = name === "community" && unreadCount > 0;
            const showDot = name === "community" && !showCount && hasUnread;

            return (
              <Pressable key={name} style={styles.item} onPress={onPress}>
                <View style={[styles.itemInner, focused && styles.itemInnerActive]}>
                  <View style={styles.iconWrap}>
                    {conf.icon.lib === "ion" ? (
                      <Ionicons name={iconName as keyof typeof Ionicons.glyphMap} size={22} color={color} />
                    ) : (
                      <MaterialCommunityIcons name={iconName as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={color} />
                    )}
                    {showCount ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText} numberOfLines={1}>
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Text>
                      </View>
                    ) : null}
                    {showDot ? <View style={styles.dot} /> : null}
                  </View>
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
  iconWrap: { position: "relative" },
  dot: {
    position: "absolute",
    top: -3,
    right: -5,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.tabBarGlassBorder,
  },
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
  badge: {
    position: "absolute",
    top: -6,
    right: -9,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  badgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    lineHeight: 13,
    color: colors.onPrimary,
  },
});
