// Pure, testable weight-milestone math for the Progress tracker's Milestones
// card. Given the starting weight, current weight, and goal, it reports the
// three design tiles (First 2 kg, 5 kg down, Halfway) with how far each is away.

export type Milestone = {
  key: "first2" | "five" | "half";
  label: string;
  // Kilograms of progress this milestone requires (toward the goal direction).
  targetKg: number;
  done: boolean;
  // Remaining kilograms of progress until this milestone (0 once done).
  awayKg: number;
  // The nearest not-yet-reached milestone, highlighted in the UI.
  isNext: boolean;
};

const EPSILON = 1e-9;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeMilestones(
  start: number | null | undefined,
  current: number | null | undefined,
  goal: number | null | undefined,
): Milestone[] {
  const hasStart = typeof start === "number" && Number.isFinite(start);
  const hasCurrent = typeof current === "number" && Number.isFinite(current);
  const hasGoal = typeof goal === "number" && Number.isFinite(goal);

  // Progress made toward the goal direction. For a weight-loss goal (goal <
  // start) this is kilograms lost; for a gain goal it is kilograms gained.
  const lossGoal = !hasGoal || (hasStart && (goal as number) <= (start as number));
  const progress =
    hasStart && hasCurrent
      ? lossGoal
        ? (start as number) - (current as number)
        : (current as number) - (start as number)
      : 0;
  const totalToGoal = hasStart && hasGoal ? Math.abs((start as number) - (goal as number)) : 0;

  const targets: { key: Milestone["key"]; label: string; targetKg: number }[] = [
    { key: "first2", label: "First 2 kg", targetKg: 2 },
    { key: "five", label: "5 kg down", targetKg: 5 },
    { key: "half", label: "Halfway", targetKg: totalToGoal > 0 ? round1(totalToGoal / 2) : 0 },
  ];

  const milestones: Milestone[] = targets.map(({ key, label, targetKg }) => {
    const reachable = targetKg > 0;
    const done = reachable && progress >= targetKg - EPSILON;
    const awayKg = done || !reachable ? 0 : round1(targetKg - progress);
    return { key, label, targetKg, done, awayKg, isNext: false };
  });

  const nextIndex = milestones.findIndex((m) => !m.done && m.targetKg > 0);
  if (nextIndex >= 0) milestones[nextIndex].isNext = true;

  return milestones;
}
