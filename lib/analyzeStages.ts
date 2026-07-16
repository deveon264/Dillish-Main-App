// Presentation-driven progress for the meal "analyzing" experience. The AI
// call is a single opaque request, so the ring and stage checklist advance on
// a local ticker: quick at first, easing off toward a ceiling, then snapping
// to 100% when the response actually lands.

export type AnalyzeStageState = "done" | "active" | "pending";

// Fraction of progress at which each stage starts. Stage i is "done" once
// progress reaches the next stage's threshold (or 1 for the last stage).
export const ANALYZE_STAGE_THRESHOLDS = [0, 0.3, 0.6, 0.88] as const;

// Highest value the fake progress may reach while the request is in flight.
export const ANALYZE_PROGRESS_CEILING = 0.9;

export function analyzeStageStates(progress: number): AnalyzeStageState[] {
  const clamped = Math.max(0, Math.min(1, progress));
  return ANALYZE_STAGE_THRESHOLDS.map((threshold, i) => {
    const nextThreshold = ANALYZE_STAGE_THRESHOLDS[i + 1] ?? 1;
    if (clamped >= nextThreshold) return "done";
    if (clamped >= threshold) return "active";
    return "pending";
  });
}

// One ticker step (~120ms cadence): closes 6% of the remaining distance to
// the ceiling each tick, so the ring moves fast early and crawls near 90%.
export function nextAnalyzeProgress(current: number, done: boolean): number {
  if (done) return 1;
  const clamped = Math.max(0, Math.min(ANALYZE_PROGRESS_CEILING, current));
  return clamped + (ANALYZE_PROGRESS_CEILING - clamped) * 0.06;
}
