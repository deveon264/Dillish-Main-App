---
name: Pitch deck home-screen is a baked screenshot
description: Editing name/avatar/etc on a deck's app mockup means photo-editing a PNG, not changing code; re-capture is wrong because in-app branding reverted.
---

# Deck app-mockup screens are baked PNG screenshots

Each ambassador deck shows the app via a static screenshot, e.g.
`pitch/pitch-src/assets/<amb>/home.png` (source) copied to
`pitch/<amb>/assets/home.png` (built). The greeting name ("Maria"), the
avatar, weekly streak, workout card etc. are all **pixels in the PNG**, not
text/code. Grepping the repo for the name finds nothing.

**Do NOT re-capture from the running app to change one of these.** The
Dillish/Florish deck screenshots were captured while the app was Dillish-branded;
the app has since reverted to Shape/Ajay branding, so a fresh capture produces a
completely different screen. Re-capture also shifts dynamic content (time-of-day
greeting, seeded values). For a minimal "change just X" request, surgically
photo-edit the existing PNG instead.

## Surgical PNG edit recipe (Pillow)
- App serif = Cormorant Garamond; real .ttf lives in
  `node_modules/@expo-google-fonts/cormorant-garamond/<weight>/...ttf`
  (`fonts.serif` = `CormorantGaramond_400Regular`). No font files in repo root.
- home.png is 2x scale (860x1864). Measure text/avatar bboxes by pixel scan.
- To erase text over the soft cream gradient without a visible rectangle:
  reconstruct each column by **vertical interpolation** between clean rows just
  above and below the band (copying a patch from elsewhere leaves a tonal seam
  because the bg has a radial highlight).
- Match text color sampled from the original glyphs; align new text by ink bbox
  (left edge + baseline), auto-tune font px to match cap height.

## Re-render the deck PDF
`CHROMIUM_BIN` is normally unset. A chromium binary exists under `/nix/store/*chromium*/bin/chromium`.
```
CHROMIUM_BIN=<that path> node pitch/tooling/render.cjs ../<amb>/index.html ../<PdfName>.pdf
```
render.cjs loads the deck via `file://` (no server needed), 1280x720, pages 1-10.
PDF target paths are in `pitch/pitch-src/ambassadors.json`.
