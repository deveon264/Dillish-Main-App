import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { AppShellSkeleton } from "@/components/LoadingSkeletons";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) return <AppShellSkeleton />;

  if (!user) return <Redirect href="/welcome" />;
  if (!user.onboardingComplete) return <Redirect href="/onboarding/goal" />;
  return <Redirect href="/(tabs)" />;
}
