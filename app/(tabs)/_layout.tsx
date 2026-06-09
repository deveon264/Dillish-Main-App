import { Tabs, Redirect } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { View, ActivityIndicator } from "react-native";
import { TabBar } from "@/components/TabBar";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/colors";

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!user) return <Redirect href="/welcome" />;
  if (!user.onboardingComplete) return <Redirect href="/onboarding/goal" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as unknown as BottomTabBarProps)} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="workouts" />
      <Tabs.Screen name="tracker" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
