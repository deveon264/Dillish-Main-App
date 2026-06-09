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
const templateWide = fs.readFileSync(path.join(SRC, "template-16x9.html"), "utf8");
const config = JSON.parse(fs.readFileSync(path.join(SRC, "ambassadors.json"), "utf8"));

function render(tpl, amb) {
  const brand = amb.brand || "Shape";
  return tpl
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
  const htmlPortrait = render(template, amb);
  const htmlWide = render(templateWide, amb);
  const ambAssetsDir = path.join(SRC, "assets", amb.assets);

  function emit(outputs, html) {
    for (const out of outputs) {
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
  }

  emit(amb.outputs, htmlPortrait);
  emit(amb.outputs16x9 || [], htmlWide);

  const wideCount = (amb.outputs16x9 || []).length;
  console.log(
    "built " + amb.id + " (" + amb.name + "): " +
    amb.outputs.length + " portrait" +
    (wideCount ? ", " + wideCount + " landscape" : "")
  );
}

console.log("done: " + htmlCount + " html files, " + assetCount + " assets copied");
