---
name: Walkthrough reel template
description: How ambassador walkthrough reels are generated from one source instead of hand-duplicated copies.
---

# Walkthrough reel template

Ambassador walkthrough reels (Ajay, Sendry, J.loss, Dillish) are generated from a
single source in `pitch/walkthrough-src/`, not hand-copied.

- `template.html` — the reel markup with `{{NAME}}` and `{{BRAND}}` placeholders
  (built from the Ajay reel; `{{NAME}}`="Ajay" + `{{BRAND}}`="Shape" reproduces the
  original byte-for-byte).
- `ambassadors.json` — per-ambassador config: `name`, optional `brand` (defaults to
  "Shape" when omitted), source `assets` folder, and the list of `outputs` (each is
  an `html` path + `assetsDir`).
- `build.cjs` — `node pitch/walkthrough-src/build.cjs` renders the template per
  ambassador and copies assets to every output. Idempotent.
- `assets/shared/` (calories, progress, workouts — identical for everyone) +
  `assets/<id>/` (welcome, home — the only per-ambassador screenshots).

**Why:** previously each reel lived in two byte-identical copies (`public/` and
`pitch/`) and new ambassadors were made by sed-replacing the previous reel, which
drifted easily.

**How to apply:** to add an ambassador, add their `welcome.png`/`home.png` under
`assets/<id>/`, add a config entry, and re-run the build. To change copy/layout for
everyone, edit `template.html` and rebuild. Never hand-edit the generated outputs.

Per-ambassador brand override (mirrors the pitch deck's `brand`/`{{BRAND}}`):
- The product brand defaults to "Shape" everywhere. Dillish overrides it to
  "Florish" via `"brand": "Florish"` in her config entry, so her reel reads
  "Florish by Dillish" while the rest stay "Shape by <name>".
- Adding/omitting `brand` for the other three is a no-op (they re-render
  byte-identical), since `render()` defaults the substitution to "Shape".
- The brand word ALSO lives baked into the welcome screenshot (the in-app
  wordmark), not just the HTML text. Dillish's reel `assets/dillish/welcome.png`
  is the Florish-branded capture (same file the deck uses,
  `pitch/pitch-src/assets/dillish/welcome.png`). Changing the HTML brand without
  swapping the welcome image leaves a mismatched screenshot.

Verification:
- `verify-brand.cjs` (validation step `reel-brand`, run after `build.cjs`) asserts
  each ambassador's HTML outputs contain their expected brand (`amb.brand ||
  "Shape"`) and zero of any other roster brand. Expectations derive from
  `ambassadors.json`, so a new ambassador/brand is covered automatically.

Gotchas:
- Only the name + brand vary in the HTML (8 brand slots: title, og/twitter meta,
  anchor wordmark, intro + outro wordmark-xl; plus name in those + "led by <name>").
  No name/brand string appears in CSS/JS, so plain `{{NAME}}`/`{{BRAND}}` replaces
  are safe.
- Ajay's pitch output is the bare file `pitch/walkthrough.html` sharing
  `pitch/assets/`, which the pitch deck (`pitch/index.html`) also reads. The build
  only writes the five reel screenshots there and leaves `profile.png` (deck-only)
  untouched.
