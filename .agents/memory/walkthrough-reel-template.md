---
name: Walkthrough reel template
description: How ambassador walkthrough reels are generated from one source instead of hand-duplicated copies.
---

# Walkthrough reel template

Ambassador walkthrough reels (Ajay, Sendry, J.loss) are generated from a single
source in `pitch/walkthrough-src/`, not hand-copied.

- `template.html` — the reel markup with `{{NAME}}` placeholders (built from the
  Ajay reel; `{{NAME}}` replaced with "Ajay" reproduces the original byte-for-byte).
- `ambassadors.json` — per-ambassador config: `name`, source `assets` folder, and
  the list of `outputs` (each is an `html` path + `assetsDir`).
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

Gotchas:
- Only the literal name varies in the HTML (9 slots: title, og/twitter meta,
  anchor wordmark, intro + outro wordmark-xl, "led by <name>"). No name string
  appears in CSS/JS, so a plain `{{NAME}}` replace is safe.
- Ajay's pitch output is the bare file `pitch/walkthrough.html` sharing
  `pitch/assets/`, which the pitch deck (`pitch/index.html`) also reads. The build
  only writes the five reel screenshots there and leaves `profile.png` (deck-only)
  untouched.
