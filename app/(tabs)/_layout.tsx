import { Tabs } from "expo-router";
import { TabBar } from "@/components/TabBar";
import { colors } from "@/constants/colors";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="workouts" />
      <Tabs.Screen name="calories" />
      <Tabs.Screen name="water" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
