import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ANALYZE_PROGRESS_CEILING,
  ANALYZE_STAGE_THRESHOLDS,
  analyzeStageStates,
  nextAnalyzeProgress,
} from "@/lib/analyzeStages";

test("progress 0 marks the first stage active and the rest pending", () => {
  assert.deepEqual(analyzeStageStates(0), ["active", "pending", "pending", "pending"]);
});

test("mid progress completes earlier stages and activates the current one", () => {
  assert.deepEqual(analyzeStageStates(0.65), ["done", "done", "active", "pending"]);
});

test("progress just below the last threshold keeps the final stage pending", () => {
  assert.deepEqual(analyzeStageStates(0.87), ["done", "done", "active", "pending"]);
});

test("full progress marks every stage done", () => {
  assert.deepEqual(analyzeStageStates(1), ["done", "done", "done", "done"]);
});

test("out-of-range progress is clamped", () => {
  assert.deepEqual(analyzeStageStates(-1), ["active", "pending", "pending", "pending"]);
  assert.deepEqual(analyzeStageStates(2), ["done", "done", "done", "done"]);
});

test("stage count matches the threshold table", () => {
  assert.equal(analyzeStageStates(0.5).length, ANALYZE_STAGE_THRESHOLDS.length);
});

test("pending progress is monotonic and never exceeds the ceiling", () => {
  let p = 0;
  for (let i = 0; i < 500; i++) {
    const next = nextAnalyzeProgress(p, false);
    assert.ok(next > p, `tick ${i} did not advance (${p} -> ${next})`);
    assert.ok(next <= ANALYZE_PROGRESS_CEILING, `tick ${i} exceeded the ceiling (${next})`);
    p = next;
  }
});

test("a done request snaps progress to 100%", () => {
  assert.equal(nextAnalyzeProgress(0.3, true), 1);
  assert.equal(nextAnalyzeProgress(0, true), 1);
});
