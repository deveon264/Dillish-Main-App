import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useOnboardingDraft } from "@/contexts/OnboardingDraftContext";
import { DEFAULT_PROFILE, type Profile } from "@/lib/profile";

// The one seam the onboarding steps read/write through. Signed-in members
// (the ?mode=personalize flow and legacy accounts that signed up before the
// questionnaire moved pre-auth) keep using the real profile, exactly as
// before. Signed-out members get the device-local draft, which the signup
// screen flushes into the profile once the account exists.
export function useOnboardingAnswers(): {
  answers: Profile;
  save: (patch: Partial<Profile>) => Promise<void>;
  ready: boolean;
} {
  const { user } = useAuth();
  const { profile, updateProfile, ready } = useData();
  const { draft, draftReady, updateDraft } = useOnboardingDraft();

  if (user) {
    return { answers: profile, save: updateProfile, ready };
  }
  return { answers: { ...DEFAULT_PROFILE, ...draft }, save: updateDraft, ready: draftReady };
}
