import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/colors";

export default function Index() {
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
  return <Redirect href="/(tabs)" />;
}
