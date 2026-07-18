import test from "node:test";
import assert from "node:assert/strict";

import { computeMilestones } from "@/lib/weightMilestones";

test("day-one state: nothing done, First 2 kg is next", () => {
  const [first, five, half] = computeMilestones(90, 90, 75);

  assert.deepEqual(
    { done: first.done, away: first.awayKg, next: first.isNext, target: first.targetKg },
    { done: false, away: 2, next: true, target: 2 },
  );
  assert.deepEqual({ done: five.done, away: five.awayKg, next: five.isNext }, { done: false, away: 5, next: false });
  // Halfway target = |90 - 75| / 2 = 7.5
  assert.deepEqual({ done: half.done, away: half.awayKg, target: half.targetKg }, { done: false, away: 7.5, target: 7.5 });
});

test("crossing the first milestone marks it done and advances 'next'", () => {
  const [first, five, half] = computeMilestones(90, 87.5, 75); // lost 2.5 kg

  assert.equal(first.done, true);
  assert.equal(first.awayKg, 0);
  assert.equal(first.isNext, false);
  assert.equal(five.isNext, true); // now the nearest unreached milestone
  assert.equal(five.awayKg, 2.5);
  assert.equal(half.done, false);
});

test("reaching halfway marks the earlier milestones done too", () => {
  const [first, five, half] = computeMilestones(90, 82.5, 75); // lost 7.5 kg (halfway)

  assert.equal(first.done, true);
  assert.equal(five.done, true);
  assert.equal(half.done, true);
  assert.equal(half.awayKg, 0);
  assert.ok(!first.isNext && !five.isNext && !half.isNext);
});

test("a weight-gain goal measures progress upward", () => {
  const [first] = computeMilestones(60, 62.5, 70); // gained 2.5 kg toward a higher goal
  assert.equal(first.done, true);
});

test("missing inputs yield unreached milestones without throwing", () => {
  const milestones = computeMilestones(null, null, null);
  assert.equal(milestones.length, 3);
  assert.ok(milestones.every((m) => !m.done));
  // With no start/goal the halfway target is 0 (not reachable) and never 'next'.
  assert.equal(milestones[2].targetKg, 0);
  assert.equal(milestones[2].isNext, false);
});
