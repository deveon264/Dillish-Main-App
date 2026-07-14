// Generates docs/filming-brief.md: the shoot list for the coach's per-exercise
// clips. Walks the workout catalog, dedupes exercises by canonical moveId, and
// emits one filming entry per unique move with cues, equipment, suggested clip
// length, and every workout that will play the clip.
//
//   npm run filming-brief
//
// The output is deterministic (sorted by move name) so re-runs produce clean
// diffs. Do not edit docs/filming-brief.md by hand; edit the catalog and re-run.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Module from "node:module";
import { createRequire } from "node:module";

const ext = (Module as unknown as { _extensions: Record<string, unknown> })._extensions;
for (const e of [".webp", ".png", ".jpg", ".jpeg"]) {
  ext[e] = (m: { exports: unknown }, filename: string) => {
    m.exports = { uri: filename };
  };
}

const require = createRequire(import.meta.url);
const { WORKOUTS } = require("../constants/workouts") as typeof import("../constants/workouts");

const EQUIPMENT_LABEL: Record<string, string> = {
  none: "None (bodyweight)",
  dumbbells: "Dumbbells",
  resistance_bands: "Resistance bands",
  yoga_mat: "Yoga mat",
  pilates_equipment: "Pilates equipment",
  gym_equipment: "Gym equipment",
};

type Usage = {
  workoutTitle: string;
  exerciseName: string;
  sets: number;
  seconds: number;
  cues: string[];
  modifications: string;
  equipmentNeeded?: string[];
  workoutEquipment: string[];
};

const byMove = new Map<string, Usage[]>();
for (const w of WORKOUTS) {
  for (const e of w.exercises) {
    const usages = byMove.get(e.moveId) ?? [];
    usages.push({
      workoutTitle: w.title,
      exerciseName: e.name,
      sets: e.sets,
      seconds: e.seconds,
      cues: e.cues,
      modifications: e.modifications,
      equipmentNeeded: e.equipmentNeeded,
      workoutEquipment: w.equipment,
    });
    byMove.set(e.moveId, usages);
  }
}

// A move's filming equipment: explicit per-exercise equipment when the catalog
// has it, otherwise whatever equipment EVERY workout using the move requires
// (a move that also appears in a no-equipment workout films as bodyweight).
function moveEquipment(usages: Usage[]): string[] {
  const explicit = [...new Set(usages.flatMap((u) => u.equipmentNeeded ?? []))];
  if (explicit.length > 0) return explicit;
  let shared: Set<string> | null = null;
  for (const u of usages) {
    const s = new Set(u.workoutEquipment);
    shared = shared === null ? s : new Set([...shared].filter((x) => s.has(x)));
  }
  return [...(shared ?? new Set<string>())];
}

// Canonical display name: the most frequent name across usages; remaining
// distinct names are listed as in-app aliases.
function moveNames(usages: Usage[]): { name: string; aliases: string[] } {
  const counts = new Map<string, number>();
  for (const u of usages) counts.set(u.exerciseName, (counts.get(u.exerciseName) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { name: ranked[0][0], aliases: ranked.slice(1).map(([n]) => n) };
}

type Entry = {
  moveId: string;
  name: string;
  aliases: string[];
  equipment: string[];
  maxSeconds: number;
  cues: string[];
  modifications: string;
  usages: Usage[];
};

const entries: Entry[] = [...byMove.entries()]
  .map(([moveId, usages]) => {
    const { name, aliases } = moveNames(usages);
    const richest = [...usages].sort((a, b) => b.cues.length - a.cues.length)[0];
    return {
      moveId,
      name,
      aliases,
      equipment: moveEquipment(usages),
      maxSeconds: Math.max(...usages.map((u) => u.seconds)),
      cues: richest.cues,
      modifications: richest.modifications,
      usages,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const bodyweight = entries.filter((e) => e.equipment.length === 0);
const withEquipment = entries.filter((e) => e.equipment.length > 0);
const equipmentCounts = new Map<string, number>();
for (const e of withEquipment) {
  for (const eq of e.equipment) equipmentCounts.set(eq, (equipmentCounts.get(eq) ?? 0) + 1);
}

const lines: string[] = [];
lines.push("# Dillish Filming Brief");
lines.push("");
lines.push(
  "One short clip per move, filmed once, reused everywhere: each clip plays in every workout that includes the move, so nothing on this list needs to be filmed twice."
);
lines.push("");
lines.push("How to film each clip:");
lines.push("");
lines.push("- Perform the move continuously for at least the listed clip length, with clean form at a steady, followable pace.");
lines.push("- Face the camera (or the most readable angle for the move) in a consistent setting and outfit style across the shoot.");
lines.push("- A brief spoken form cue at the start is welcome; the app also shows the written cues below during the exercise.");
lines.push("- Where a modification is listed, showing it briefly near the end of the clip helps beginners follow along.");
lines.push("");
lines.push(`## Summary`);
lines.push("");
lines.push(`- Total unique moves to film: **${entries.length}**`);
lines.push(`- Bodyweight only: ${bodyweight.length}`);
for (const [eq, count] of [...equipmentCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  lines.push(`- ${EQUIPMENT_LABEL[eq] ?? eq}: ${count}`);
}
lines.push("");
lines.push("## Moves");
lines.push("");

for (const e of entries) {
  lines.push(`### ${e.name}`);
  lines.push("");
  lines.push(`- [ ] Filmed`);
  if (e.aliases.length > 0) {
    lines.push(`- Also appears in the app as: ${e.aliases.join(", ")}`);
  }
  lines.push(
    `- Equipment: ${e.equipment.length > 0 ? e.equipment.map((eq) => EQUIPMENT_LABEL[eq] ?? eq).join(", ") : "none (bodyweight)"}`
  );
  lines.push(`- Clip length: at least ${e.maxSeconds} seconds of continuous movement`);
  lines.push(`- Cues shown in the app:`);
  for (const c of e.cues) lines.push(`  - ${c}`);
  if (e.modifications.trim()) lines.push(`- Modification to show: ${e.modifications}`);
  const usageList = e.usages
    .map((u) => `${u.workoutTitle} (${u.sets} x ${u.seconds}s)`)
    .sort((a, b) => a.localeCompare(b));
  lines.push(`- Plays in: ${usageList.join("; ")}`);
  lines.push("");
}

const outPath = fileURLToPath(new URL("../docs/filming-brief.md", import.meta.url));
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`filming-brief: wrote ${entries.length} moves to docs/filming-brief.md`);
