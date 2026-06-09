#!/usr/bin/env node
// Generate every ambassador walkthrough reel from one template + config.
// Run: node pitch/walkthrough-src/build.cjs
// The public/ and pitch/ copies are produced from the same source, so they
// cannot drift. Edit template.html, ambassadors.json, or the source assets,
// then re-run this script.
//
// --check (CI / validation): instead of writing, re-render every output in
// memory and compare it against the committed file on disk (HTML and assets).
// Exits non-zero and lists every drifted/missing file. This catches a stale
// committed copy that a future edit forgot to rebuild, without touching the
// working tree and without needing git.

const fs = require("fs");
const path = require("path");

const SRC = __dirname;
const ROOT = path.resolve(SRC, "../..");
const CHECK = process.argv.includes("--check");

const template = fs.readFileSync(path.join(SRC, "template.html"), "utf8");
const templateWide = fs.readFileSync(path.join(SRC, "template-16x9.html"), "utf8");
const config = JSON.parse(fs.readFileSync(path.join(SRC, "ambassadors.json"), "utf8"));

function render(tpl, amb) {
  const brand = amb.brand || "Shape";
  return tpl
    .split("{{NAME}}").join(amb.name)
    .split("{{BRAND}}").join(brand);
}

const drift = [];

function writeText(destPath, content) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, content);
}

function checkText(destPath, content, label) {
  if (!fs.existsSync(destPath)) {
    drift.push(`${label}: missing committed file ${path.relative(ROOT, destPath)}`);
    return;
  }
  if (fs.readFileSync(destPath, "utf8") !== content) {
    drift.push(`${label}: ${path.relative(ROOT, destPath)} is stale (re-run build.cjs)`);
  }
}

function writeAsset(srcPath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
}

function checkAsset(srcPath, destPath, label) {
  if (!fs.existsSync(destPath)) {
    drift.push(`${label}: missing committed asset ${path.relative(ROOT, destPath)}`);
    return;
  }
  if (!fs.readFileSync(srcPath).equals(fs.readFileSync(destPath))) {
    drift.push(`${label}: ${path.relative(ROOT, destPath)} is stale (re-run build.cjs)`);
  }
}

let htmlCount = 0;
let assetCount = 0;

for (const amb of config.ambassadors) {
  const htmlPortrait = render(template, amb);
  const htmlWide = render(templateWide, amb);
  const ambAssetsDir = path.join(SRC, "assets", amb.assets);
  const label = amb.id + " (" + amb.name + ")";

  function emit(outputs, html) {
    for (const out of outputs) {
      const htmlPath = path.join(ROOT, out.html);
      if (CHECK) checkText(htmlPath, html, label);
      else writeText(htmlPath, html);
      htmlCount++;

      const destDir = path.join(ROOT, out.assetsDir);
      const assetSpecs = config.sharedAssets
        .map((file) => ({ src: path.join(SRC, "assets", "shared", file), file }))
        .concat(
          config.ambassadorAssets.map((file) => ({
            src: path.join(ambAssetsDir, file),
            file,
          }))
        );
      for (const spec of assetSpecs) {
        const destPath = path.join(destDir, spec.file);
        if (CHECK) checkAsset(spec.src, destPath, label);
        else writeAsset(spec.src, destPath);
        assetCount++;
      }
    }
  }

  emit(amb.outputs, htmlPortrait);
  emit(amb.outputs16x9 || [], htmlWide);

  const wideCount = (amb.outputs16x9 || []).length;
  if (!CHECK) {
    console.log(
      "built " + label + ": " +
      amb.outputs.length + " portrait" +
      (wideCount ? ", " + wideCount + " landscape" : "")
    );
  }
}

if (CHECK) {
  if (drift.length > 0) {
    console.error("walkthrough reel drift detected:");
    for (const d of drift) console.error("  - " + d);
    console.error(
      "\n" + drift.length + " stale/missing file(s). Run " +
      "`node pitch/walkthrough-src/build.cjs` and commit the result."
    );
    process.exit(1);
  }
  console.log(
    "reel freshness check passed: " + htmlCount + " html files, " +
    assetCount + " assets match source"
  );
} else {
  console.log("done: " + htmlCount + " html files, " + assetCount + " assets copied");
}
