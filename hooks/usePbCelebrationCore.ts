import { useCallback, useEffect, useMemo, useState } from "react";
import {
  advancePbCelebration,
  isCelebratingToday,
  type PbCelebration,
  DEFAULT_PB_CELEBRATION,
} from "@/lib/streak";

// Side dependencies the personal-best celebration orchestration needs, injected
// so the hook imports ONLY `react` + the server-safe `@/lib/streak` helpers and
// stays testable under the node:test + tsx suite (it never pulls in
// react-native, expo or the data context's network code). The data context
// supplies the real implementations.
export type PbCelebrationDeps = {
  // Persist the record for the given account (the app writes the device-local
  // streak_pb cache; a test injects a recorder).
  persist: (uid: string, rec: PbCelebration) => void;
  // Today's day key ("YYYY-MM-DD"). Injected so a test can pin "today".
  today: () => string;
};

export type PbCelebrationCore = {
  // The current device-local celebration record.
  pbCelebration: PbCelebration;
  // The record value to celebrate when the member has just beaten their best
  // today, or null when there is nothing new to celebrate.
  newBestToday: number | null;
  // Seed the baseline once, from a freshly hydrated record + the pre-today best.
  // A fresh (never-seeded) record is baselined silently at `baselineBest` so an
  // already-established best is never celebrated retroactively (this also covers
  // a member loading on a new device); an already-seeded record is kept as-is.
  // The streakBest-driven effect below then advances it if the best was beaten
  // today. Call this from the data context's hydrate, before `ready` flips true.
  hydratePb: (loaded: PbCelebration, baselineBest: number) => void;
  // Clear back to the unseeded default (e.g. on sign-out).
  resetPb: () => void;
};

// The personal-best celebration lifecycle, extracted from the data context so it
// can be unit-tested in isolation. It owns the device-local celebration record
// and decides, across a load + a session, whether THIS device should surface the
// one-time "new personal best" celebration:
//
//  - hydratePb seeds the baseline once per load. An existing best is baselined
//    silently (day ""), so it is never congratulated retroactively, including on
//    a fresh device where the record is re-derived from the server best.
//  - the effect below stamps today's date the moment the displayed best climbs
//    past the baselined/celebrated value, de-duped to one stamp per record value
//    (reopening the same day does not re-fire, and a streak that rebuilds below
//    the all-time best never fires because the best can't drop).
export function usePbCelebrationCore(args: {
  uid: string | null;
  ready: boolean;
  streakBest: number;
  deps: PbCelebrationDeps;
}): PbCelebrationCore {
  const { uid, ready, streakBest, deps } = args;
  const [pbCelebration, setPbCelebration] = useState<PbCelebration>(DEFAULT_PB_CELEBRATION);

  const hydratePb = useCallback(
    (loaded: PbCelebration, baselineBest: number) => {
      if (!uid) return;
      const seeded =
        loaded.value < 0 ? { value: Math.max(0, Math.floor(baselineBest)), day: "" } : loaded;
      if (seeded !== loaded) deps.persist(uid, seeded);
      setPbCelebration(seeded);
    },
    [uid, deps]
  );

  const resetPb = useCallback(() => setPbCelebration(DEFAULT_PB_CELEBRATION), []);

  // Stamp a new personal best the moment the displayed best climbs past the last
  // value we baselined/celebrated. The baseline itself is seeded once via
  // hydratePb (so an existing record is never congratulated); this only advances
  // it afterwards, de-duped to one stamp per record value.
  useEffect(() => {
    if (!uid || !ready) return;
    setPbCelebration((prev) => {
      if (prev.value < 0) return prev;
      const next = advancePbCelebration(prev, streakBest, deps.today());
      if (next === prev) return prev;
      deps.persist(uid, next);
      return next;
    });
  }, [uid, ready, streakBest, deps]);

  const newBestToday = useMemo(
    () => (isCelebratingToday(pbCelebration, deps.today()) ? pbCelebration.value : null),
    [pbCelebration, deps]
  );

  return { pbCelebration, newBestToday, hydratePb, resetPb };
}
