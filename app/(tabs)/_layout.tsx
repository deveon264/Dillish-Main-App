import { Tabs, Redirect } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { TabBar } from "@/components/TabBar";
import { AppShellSkeleton } from "@/components/LoadingSkeletons";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function TabsLayout() {
  const colors = useColors();
  const { user, loading } = useAuth();

  if (loading) return <AppShellSkeleton />;

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
      <Tabs.Screen name="community" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
