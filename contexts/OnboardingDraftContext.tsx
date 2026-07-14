import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Profile } from "@/lib/profile";
import { getJSON, setJSON, removeKey } from "@/lib/storage";

// Buffer for onboarding answers collected BEFORE an account exists. The
// questionnaire now runs pre-signup, but the real profile store (DataContext)
// is uid-namespaced and no-ops while signed out, so steps write here instead.
// The signup screen flushes the draft into the profile once the account is
// created, then clears it. Device-global on purpose: there is no user yet.
const DRAFT_KEY = "florish:onboardingDraft";

type OnboardingDraftContextType = {
  draft: Partial<Profile>;
  // False until the persisted draft has been read on app start, so onboarding
  // steps can gate their Continue button exactly like they do on DataContext's
  // `ready` when authed.
  draftReady: boolean;
  updateDraft: (patch: Partial<Profile>) => Promise<void>;
  clearDraft: () => Promise<void>;
};

const OnboardingDraftContext = createContext<OnboardingDraftContextType | undefined>(undefined);

export function OnboardingDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [draftReady, setDraftReady] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    let cancelled = false;
    getJSON<Partial<Profile>>(DRAFT_KEY, {})
      .then((d) => {
        if (cancelled) return;
        if (d && typeof d === "object") setDraft(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDraftReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateDraft = useCallback(async (patch: Partial<Profile>) => {
    const next = { ...draftRef.current, ...patch };
    setDraft(next);
    await setJSON(DRAFT_KEY, next);
  }, []);

  const clearDraft = useCallback(async () => {
    setDraft({});
    await removeKey(DRAFT_KEY);
  }, []);

  const value = useMemo(
    () => ({ draft, draftReady, updateDraft, clearDraft }),
    [draft, draftReady, updateDraft, clearDraft]
  );

  return <OnboardingDraftContext.Provider value={value}>{children}</OnboardingDraftContext.Provider>;
}

export function useOnboardingDraft() {
  const ctx = useContext(OnboardingDraftContext);
  if (!ctx) throw new Error("useOnboardingDraft must be used within OnboardingDraftProvider");
  return ctx;
}
