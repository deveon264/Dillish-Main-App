---
name: Pitch deck template
description: How ambassador partnership pitch decks are generated from one template + config (pitch/pitch-src/).
---

# Pitch deck template

Ambassador partnership pitch decks live under `pitch/pitch-src/` and are
generated, never hand-edited:
- `template.html` — the single deck with `{{PLACEHOLDER}}` slots.
- `ambassadors.json` — per-ambassador config + shared `currency`/`share`/`conversions`.
- `build.cjs` — `node pitch/pitch-src/build.cjs` renders each deck and copies assets.

Generated outputs (do NOT edit by hand): `pitch/index.html` (Ajay),
`pitch/jloss/index.html` (J.loss), plus their `assets/` copies.

**Why generated:** each deck's revenue slide (cards + conversion table) must stay
internally consistent. They are computed from the ambassador's audience, not typed.

**How to apply / add an ambassador:**
- Add screenshots to `pitch/pitch-src/assets/<id>/` (welcome.png, home.png);
  shared screens (calories/progress/workouts) are in `assets/shared/`.
- Add an entry to `ambassadors.json`: `name`, `assets` (folder), `platforms`
  (array of `{name,count}`), and `outputs` (html/assetsDir/pdf paths).
- `audience` = sum of `platforms[].count`. The slide-5 split line ("1M on TikTok
  and 105K on Instagram.") only renders when there are 2+ platforms; the
  following lead paragraph's margin-top switches 14↔18px accordingly.
- Run `node pitch/pitch-src/build.cjs`, then regenerate PDFs with
  `pitch/tooling/render.cjs <html> <pdf>` (needs `CHROMIUM_BIN`; the nix
  chromium path works).

**Gotchas:**
- The deck's thousands separator is a **non-breaking space (U+00A0)**, not ASCII
  space. `build.cjs` `group()` emits NBSP; any string-matching against deck
  numbers must use `\u00A0`.
- Revenue math (per conversion %): `subs = round(audience*pct)`;
  `profitUSD = subs*priceUSD`; `profitLocal = profitUSD*rate`;
  `shareX = profitX*share`. Display = `Math.round` then NBSP-group. The 1% row is
  the `hot` row and also feeds the four headline cards.
- Compact audience label: ≥1e6 → one-decimal "M" (1.105M→"1.1M"), ≥1e3 → "K".
