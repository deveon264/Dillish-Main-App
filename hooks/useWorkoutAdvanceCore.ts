import { useEffect, useState } from "react";
import {
  decideAdvanceTarget,
  decideJump,
  decideRestTick,
  type WorkoutPhase,
} from "@/lib/workoutAdvance";

// Side dependencies the rest/advance/replay state machine needs, injected so the
// hook imports ONLY `react` + the server-safe `@/lib/workoutAdvance` helpers and
// stays testable under the node:test + tsx suite (it never pulls in react-native,
// expo-video, haptics or the data context). The workout screen supplies the real
// implementations.
export type WorkoutAdvanceDeps = {
  // Total number of exercises in the workout.
  total: number;
  // Configured rest gap (seconds). Used only to size the player's render; the
  // hook itself reads the live `restRemaining`.
  restGap: number;
  // Whether the player is paused (the rest countdown pauses too).
  paused: boolean;
  // Duration (seconds) of the exercise at index i.
  durationAt: (i: number) => number;
  // The first exercise's duration, used to seed `remaining` once on mount.
  initialRemaining: number;
  // Side effects of finishing the workout (persist completion, haptics, clear the
  // countdown interval). The hook flips `phase` to "done" itself.
  onFinish: () => void;
  // Side effects of a replay jump (haptics, toast, un-pause). The hook owns the
  // index/phase/remaining reset.
  onReplay?: (i: number) => void;
  // Fired once per rest-countdown tick, BEFORE the second is decremented, with
  // the seconds left. The screen gates the near-end haptic on this.
  onRestTick?: (restRemaining: number) => void;
};

export type WorkoutAdvanceCore = {
  phase: WorkoutPhase;
  index: number;
  remaining: number;
  restRemaining: number;
  setPhase: React.Dispatch<React.SetStateAction<WorkoutPhase>>;
  setIndex: React.Dispatch<React.SetStateAction<number>>;
  setRemaining: React.Dispatch<React.SetStateAction<number>>;
  setRestRemaining: React.Dispatch<React.SetStateAction<number>>;
  // Move on from the current exercise: step to the next one (resetting phase to
  // "active", the index, the per-exercise countdown and the rest countdown) or,
  // if this was the last exercise, finish.
  goNext: () => void;
  // Replay an EARLIER exercise (a later/current tap is ignored). Resets phase,
  // index, the per-exercise countdown and the rest countdown, then runs the
  // replay side effects.
  jumpTo: (i: number) => void;
  // Finish the workout: run the finish side effects, then flip to the done phase.
  finish: () => void;
};

// The active/rest/done advance machine for the workout player, extracted from the
// screen so the wiring between the rest countdown, the auto-advance and the
// replay jump can be unit-tested in isolation (the pure decisions already live in
// `@/lib/workoutAdvance`; this hook owns the state and the effect that ties them
// to the player's index/remaining/restRemaining).
export function useWorkoutAdvanceCore(deps: WorkoutAdvanceDeps): WorkoutAdvanceCore {
  const { total, paused, durationAt, initialRemaining, onFinish, onReplay, onRestTick } = deps;

  const [phase, setPhase] = useState<WorkoutPhase>("active");
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(() => initialRemaining);
  const [restRemaining, setRestRemaining] = useState(0);

  const finish = () => {
    onFinish();
    setPhase("done");
  };

  const goNext = () => {
    const decision = decideAdvanceTarget({ index, total });
    if (decision.action === "advance") {
      const ni = decision.nextIndex;
      setRestRemaining(0);
      setPhase("active");
      setIndex(ni);
      setRemaining(durationAt(ni));
    } else {
      finish();
    }
  };

  const jumpTo = (i: number) => {
    if (decideJump({ target: i, index }) === "ignore") return;
    setPhase("active");
    setRestRemaining(0);
    setIndex(i);
    setRemaining(durationAt(i));
    onReplay?.(i);
  };

  // Rest countdown between exercises. Ticks down once per second (pausable), then
  // auto-advances to the next exercise (or finishes) when it reaches zero.
  useEffect(() => {
    const tick = decideRestTick({ phase, paused, restRemaining });
    if (tick === "idle") return;
    if (tick === "advance") {
      goNext();
      return;
    }
    const t = setTimeout(() => {
      onRestTick?.(restRemaining);
      setRestRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, restRemaining]);

  return {
    phase,
    index,
    remaining,
    restRemaining,
    setPhase,
    setIndex,
    setRemaining,
    setRestRemaining,
    goNext,
    jumpTo,
    finish,
  };
}
