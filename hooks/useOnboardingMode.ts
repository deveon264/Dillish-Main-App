import { useLocalSearchParams } from "expo-router";

// The seven fitness-personalization screens (goal → limitations) run in two
// flows: the full 10-step signup onboarding, and a 7-step "personalize"
// shortcut for existing accounts entered from the Home prompt card. The mode
// travels as ?mode=personalize and must be forwarded on every push, so route
// building goes through withMode().
export function useOnboardingMode() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const personalize = mode === "personalize";
  return {
    personalize,
    total: personalize ? 7 : 10,
    withMode: (path: string) => (personalize ? (`${path}?mode=personalize` as const) : path),
  };
}
