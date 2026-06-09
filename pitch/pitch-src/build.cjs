#!/usr/bin/env node
// Generate every ambassador pitch deck from one template + config.
// Run: node pitch/pitch-src/build.cjs
//
// The revenue slide's headline cards and conversion table are computed here from
// each ambassador's audience and the shared currency settings, so the numbers
// are always internally consistent instead of being typed in by hand. The
// generated pitch/<...>/index.html files are produced from this source and must
// never be hand-edited. Edit template.html, ambassadors.json, or the source
// assets, then re-run this script (and pitch/tooling/render.cjs for the PDFs).

const fs = require("fs");
const path = require("path");

const SRC = __dirname;
const ROOT = path.resolve(SRC, "../..");

const NB = "\u00A0"; // non-breaking space: the thousands separator used in the deck

const template = fs.readFileSync(path.join(SRC, "template.html"), "utf8");
const config = JSON.parse(fs.readFileSync(path.join(SRC, "ambassadors.json"), "utf8"));

// --- formatting helpers ---------------------------------------------------
function group(n) {
  // round, then space-group with a non-breaking space (matches the deck style)
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NB);
}

function compact(n) {
  if (n >= 1e6) {
    const v = Math.round((n / 1e6) * 10) / 10; // one decimal, trimmed
    return v + "M";
  }
  if (n >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}

function platformLine(platforms) {
  const frags = platforms.map((p) => compact(p.count) + " on " + p.name);
  const joined =
    frags.length === 1
      ? frags[0]
      : frags.length === 2
      ? frags[0] + " and " + frags[1]
      : frags.slice(0, -1).join(", ") + " and " + frags[frags.length - 1];
  return (
    '<p class="lead" style="margin-top:14px; font-weight:600; color:var(--rose-deep);">' +
    joined +
    ".</p>\n        "
  );
}

// --- revenue model --------------------------------------------------------
function tableRow(conv, audience, cur, share) {
  const subs = Math.round(audience * (conv / 100));
  const profitUSD = subs * cur.priceUSD;
  const profitLocal = profitUSD * cur.rate;
  const shareUSD = profitUSD * share;
  const shareLocal = profitLocal * share;
  const sym = cur.symbol;
  const label = conv === 1 ? "1% (shown above)" : conv + "%";
  const hot = conv === 1 ? ' class="hot"' : "";
  return (
    "<tr" + hot + "><td>" + label + "</td>" +
    '<td class="num">' + group(subs) + "</td>" +
    '<td class="num">$' + group(profitUSD) + " (" + sym + group(profitLocal) + ")</td>" +
    '<td class="num">$' + group(shareUSD) + "</td>" +
    '<td class="num" style="text-align:center; width:24px; padding-left:4px; padding-right:4px;">=</td>' +
    '<td class="num">' + sym + group(shareLocal) + "</td></tr>"
  );
}

function render(amb) {
  const cur = config.currency;
  const share = config.share;
  const audience = amb.platforms.reduce((s, p) => s + p.count, 0);

  // headline (1%) figures
  const subs1 = Math.round(audience * 0.01);
  const profitUSD1 = subs1 * cur.priceUSD;
  const profitLocal1 = profitUSD1 * cur.rate;
  const shareUSD1 = profitUSD1 * share;
  const shareLocal1 = profitLocal1 * share;

  const rows = config.conversions
    .map((c) => "          " + tableRow(c, audience, cur, share))
    .join("\n");

  const showLine = amb.platforms.length >= 2 || amb.showPlatformLine === true;

  const values = {
    NAME: amb.name,
    BRAND: amb.brand || "Shape",
    AUDIENCE_BIG: compact(audience),
    AUDIENCE_FULL: group(audience),
    SPLIT_LINE: showLine ? platformLine(amb.platforms) : "",
    LEAD_MT: showLine ? "14" : "18",
    PRICE_USD: String(cur.priceUSD),
    PRICE_LOCAL: group(cur.priceUSD * cur.rate),
    LOCAL_SYM: cur.symbol,
    RATE: String(cur.rate),
    H_SUBS: group(subs1),
    H_PROFIT_USD: "$" + group(profitUSD1),
    H_PROFIT_LOCAL: group(profitLocal1),
    H_SHARE_USD: "$" + group(shareUSD1),
    H_SHARE_LOCAL: group(shareLocal1),
    TABLE_ROWS: rows,
  };

  let html = template;
  for (const [key, val] of Object.entries(values)) {
    html = html.split("{{" + key + "}}").join(val);
  }
  return html;
}

// --- write outputs --------------------------------------------------------
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
console.log("PDFs: re-render with pitch/tooling/render.cjs (see ambassadors.json `pdf` paths)");
