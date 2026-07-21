import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Bouncy } from "@/components/Bouncy";
import { useInsets } from "@/hooks/useInsets";
import { useNotices } from "@/contexts/NoticesContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";

// Every icon is an Ionicon so the whole bar renders from one reliable glyph
// font — a mixed second font (MaterialCommunityIcons) was intermittently
// failing to load and showing tofu/garbled characters for the Workouts tab.
const CONF: Record<
  string,
  { label: string; name: keyof typeof Ionicons.glyphMap; nameFocused: keyof typeof Ionicons.glyphMap }
> = {
  index: { label: "Home", name: "home-outline", nameFocused: "home" },
  workouts: { label: "Workouts", name: "barbell-outline", nameFocused: "barbell" },
  tracker: { label: "Tracker", name: "flame-outline", nameFocused: "flame" },
  community: { label: "Circle", name: "people-outline", nameFocused: "people" },
  profile: { label: "Profile", name: "person-outline", nameFocused: "person" },
};

const ORDER = ["index", "workouts", "tracker", "community", "profile"];

type TabBarProps = Pick<BottomTabBarProps, "state" | "navigation">;

// Fixed bottom tab bar: a solid, full-width bar anchored flush to the bottom
// edge with a thin top divider (Twitter/Facebook style). Every tab is an
// equal-width slot (flex: 1) that never changes size, so switching tabs can
// never shift the layout or push icons off-screen. The active tab fills its own
// slot with a pink pill; inactive tabs show a bare line icon centered in their
// slot. (A glassy floating variant is a deliberate later step.)
export function TabBar({ state, navigation }: TabBarProps) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useInsets();
  const { hasUnread, unreadCount: noticeCount, hasBlock } = useNotices();
  const { unreadCount, refreshUnread } = useNotifications();

  const routesByName = Object.fromEntries(state.routes.map((r) => [r.name, r]));

  // Refresh the unread badge whenever the member lands on the Circle tab, so a
  // like/comment that arrived while they were elsewhere shows up promptly.
  const activeRoute = state.routes[state.index]?.name;
  useEffect(() => {
    if (activeRoute === "community") refreshUnread();
  }, [activeRoute, refreshUnread]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.row}>
          {ORDER.map((name) => {
            const route = routesByName[name];
            if (!route) return null;
            const conf = CONF[name];
            const routeIndex = state.routes.findIndex((r) => r.key === route.key);
            const focused = state.index === routeIndex;

            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };

            const color = focused ? colors.onPrimary : colors.tabBarInactive;
            const iconName = focused ? conf.nameFocused : conf.name;
            // The Circle tab carries two signals. An unread like/comment count
            // bubble takes priority; when there are none, a pending moderation
            // notice (warning or block) shows its own indicator so the member
            // notices it from any screen.
            const showCount = name === "community" && unreadCount > 0;
            const showNotice = name === "community" && !showCount && hasUnread;
            const showNoticeCount = showNotice && noticeCount > 1;
            const showNoticeDot = showNotice && !showNoticeCount;
            const noticeColor = hasBlock ? colors.danger : colors.highlight;

            return (
              // Outer slot is always flex: 1 and fixed height, so the five
              // slots always sum to the full row and never move.
              <Bouncy
                key={name}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={conf.label}
                style={styles.slot}
                onPress={onPress}
              >
                <View style={[styles.pill, focused && styles.pillActive]}>
                  <View style={styles.iconWrap}>
                    <Ionicons name={iconName} size={22} color={color} />
                    {showCount ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText} numberOfLines={1}>
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Text>
                      </View>
                    ) : null}
                    {showNoticeCount ? (
                      <View style={[styles.badge, { backgroundColor: noticeColor }]}>
                        <Text style={styles.badgeText} numberOfLines={1}>
                          {noticeCount > 9 ? "9+" : noticeCount}
                        </Text>
                      </View>
                    ) : null}
                    {showNoticeDot ? <View style={[styles.dot, { backgroundColor: noticeColor }]} /> : null}
                  </View>
                </View>
              </Bouncy>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  bar: {
    // Opaque, full-width, flush to the bottom edge with a hairline top divider.
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.tabBarGlassBorder,
    // Soft upward lift so content reads as passing beneath the bar.
    shadowColor: "#3E2733",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  // Fixed equal-width slot: five of these always fill the row exactly.
  slot: {
    flex: 1,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  pill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  iconWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  dot: {
    position: "absolute",
    top: -3,
    right: -5,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
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
    borderColor: "#FFFFFF",
  },
  badgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    lineHeight: 13,
    color: colors.onPrimary,
  },
});
