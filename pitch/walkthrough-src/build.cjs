#!/usr/bin/env node
// Generate every ambassador walkthrough reel from one template + config.
// Run: node pitch/walkthrough-src/build.cjs
// The public/ and pitch/ copies are produced from the same source, so they
// cannot drift. Edit template.html, ambassadors.json, or the source assets,
// then re-run this script.

const fs = require("fs");
const path = require("path");

const SRC = __dirname;
const ROOT = path.resolve(SRC, "../..");

const template = fs.readFileSync(path.join(SRC, "template.html"), "utf8");
const config = JSON.parse(fs.readFileSync(path.join(SRC, "ambassadors.json"), "utf8"));

function render(amb) {
  const brand = amb.brand || "Shape";
  return template
    .split("{{NAME}}").join(amb.name)
    .split("{{BRAND}}").join(brand);
}

function copyAsset(srcPath, destDir, file) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcPath, path.join(destDir, file));
}

let htmlCount = 0;
let assetCount = 0;

for (const amb of config.ambassadors) {
  const html = render(amb);
  const ambAssetsDir = path.join(SRC, "assets", amb.assets);

  for (const out of amb.outputs) {
    const htmlPath = path.join(ROOT, out.html);
    fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
    fs.writeFileSync(htmlPath, html);
    htmlCount++;

    const destDir = path.join(ROOT, out.assetsDir);
    for (const file of config.sharedAssets) {
      copyAsset(path.join(SRC, "assets", "shared", file), destDir, file);
      assetCount++;
    }
    for (const file of config.ambassadorAssets) {
      copyAsset(path.join(ambAssetsDir, file), destDir, file);
      assetCount++;
    }
  }
  console.log("built " + amb.id + " (" + amb.name + "): " + amb.outputs.length + " copies");
}

console.log("done: " + htmlCount + " html files, " + assetCount + " assets copied");
