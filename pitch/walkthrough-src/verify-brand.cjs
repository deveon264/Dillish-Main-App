#!/usr/bin/env node
// Verify every generated walkthrough reel carries the right brand name.
// Run after: node pitch/walkthrough-src/build.cjs
//   node pitch/walkthrough-src/verify-brand.cjs
//
// For each ambassador the expected brand is `amb.brand || "Shape"`. Each of
// that ambassador's HTML outputs must contain the expected brand at least once
// and must NOT contain any other ambassador's distinct brand. This catches a
// future edit that flips the wrong reel's brand or leaves a stray "Shape" in a
// rebranded reel.

const fs = require("fs");
const path = require("path");

const SRC = __dirname;
const ROOT = path.resolve(SRC, "../..");
const DEFAULT_BRAND = "Shape";

const config = JSON.parse(
  fs.readFileSync(path.join(SRC, "ambassadors.json"), "utf8")
);

function brandOf(amb) {
  return amb.brand || DEFAULT_BRAND;
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

// Every distinct brand used across the roster (e.g. "Shape", "Florish").
const allBrands = Array.from(new Set(config.ambassadors.map(brandOf)));

const failures = [];
let checkedFiles = 0;

for (const amb of config.ambassadors) {
  const expected = brandOf(amb);
  const forbidden = allBrands.filter((b) => b !== expected);

  for (const out of amb.outputs) {
    const htmlPath = path.join(ROOT, out.html);
    if (!fs.existsSync(htmlPath)) {
      failures.push(
        `${amb.id} (${amb.name}): missing output ${out.html} (run build.cjs first)`
      );
      continue;
    }
    checkedFiles++;
    const html = fs.readFileSync(htmlPath, "utf8");

    const expectedCount = countOccurrences(html, expected);
    if (expectedCount === 0) {
      failures.push(
        `${amb.id} (${amb.name}): ${out.html} should contain "${expected}" but found 0`
      );
    }
    for (const bad of forbidden) {
      const badCount = countOccurrences(html, bad);
      if (badCount > 0) {
        failures.push(
          `${amb.id} (${amb.name}): ${out.html} should contain 0 "${bad}" but found ${badCount}`
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error("brand verification FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}

console.log(
  `brand verification passed: ${checkedFiles} reel files, brands [${allBrands.join(", ")}]`
);
