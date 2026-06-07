---
name: Pitch deck PDF render (pitch/)
description: Why exported deck pages came out blank/cut, and how the deck is built and re-rendered.
---

# Pitch deck (pitch/) PDF rendering

The `pitch/` deck is a single `index.html` of fixed 1280x720 `.slide`
sections, exported to `Shape-by-Ajay-Pitch.pdf` by
`pitch/tooling/render.cjs` (puppeteer + system chromium).

## Blank / cut pages root cause
On screen the `.deck` uses `gap` and outer `padding` between slides. Those
pixels accumulate down the document, so in a fixed-height PDF (page.pdf
width/height 1280x720) each slide drifts further past its page boundary,
producing blank or cut pages (slide 4 lost its phone images entirely).

**Fix:** `@media print { .deck { gap: 0; padding: 0; } }` so each 720px
slide maps to exactly one page. puppeteer `page.pdf` uses print emulation
by default, so the print block applies.

**Why:** any fixed-height, one-section-per-page HTML deck must zero out
inter-section spacing in print, or pagination drifts.

## Content clipping within a slide
`.slide` is `overflow:hidden` at a fixed 720px. Content taller than the
~576px usable area (after pad padding) is silently clipped, not flagged.
Slide 4's four phones at 236x512 pushed their captions off-slide; shrinking
to 182x394 made them fit. When adding/enlarging slide content, check it
fits the fixed height.

## Re-render command
`cd pitch/tooling && CHROMIUM_BIN="$(command -v chromium)" node render.cjs`
- node_modules in `pitch/tooling` is gitignored (run `npm install` there if
  missing).
- Verify with `pdfinfo` (page count = 10), `pdftotext` (bottom-of-slide
  text present = not clipped), and `pdftoppm -png` to eyeball pages.
