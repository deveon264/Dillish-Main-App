---
name: Pitch deck template
description: How ambassador partnership pitch decks are generated from one template + config (pitch/pitch-src/), and the byte-equality traps when adding an ambassador.
---

# Pitch deck template

Ambassador partnership pitch decks live under `pitch/pitch-src/` and are
generated, never hand-edited:
- `template.html` — the single deck with `{{PLACEHOLDER}}` slots.
- `ambassadors.json` — per-ambassador config + shared `currency`/`share`/`conversions`.
- `build.cjs` — `node pitch/pitch-src/build.cjs` renders each deck and copies assets.

Generated outputs (do NOT edit by hand): `pitch/index.html` (Ajay),
`pitch/jloss/index.html` (J.loss), `pitch/dillish/index.html` (Dillish), plus
their `assets/` copies.

**Why generated:** each deck's revenue slide (cards + conversion table) must stay
internally consistent. They are computed from the ambassador's audience, not typed.

**How to apply / add an ambassador:**
- Add screenshots to `pitch/pitch-src/assets/<id>/` (welcome.png, home.png);
  shared screens (calories/progress/workouts) are in `assets/shared/`.
- Add an entry to `ambassadors.json`: `name`, optional `brand` (default "Shape"),
  `assets` (folder), `platforms` (array of `{name,count}`), optional
  `showPlatformLine`, and `outputs` (html/assetsDir/pdf paths).
- `audience` = sum of `platforms[].count`. Run `node pitch/pitch-src/build.cjs`,
  then regenerate PDFs with `pitch/tooling/render.cjs <html> <pdf>` (needs
  `CHROMIUM_BIN`; the nix chromium path works; paths are relative to
  `pitch/tooling/`).

## Per-ambassador brand name
The brand is `amb.brand || "Shape"` exposed as `{{BRAND}}` in the template.
Ajay/J.loss read "Shape"; Dillish reads "Florish". Only brand occurrences use
`{{BRAND}}`; the common-word body copy ("help shape this one", "the shape of the
opportunity") is lowercase and intentionally left literal.

## Single-platform reach line
The slide-5 "Why you" platform line renders when `platforms.length >= 2` OR the
ambassador sets `"showPlatformLine": true` (used by Dillish for the single line
"775K on Instagram."). The following lead paragraph's margin-top switches
14↔18px accordingly. Leaving the flag off keeps single-platform Ajay
byte-identical.

## Byte-for-byte constraint (build regen is all-or-nothing)
`build.cjs` regenerates ALL decks every run, and existing ambassadors must stay
byte-for-byte identical. So every `template.html`/`build.cjs` change must be a
NO-OP for Ajay and J.loss output. Verify with
`git show HEAD:pitch/index.html | diff - pitch/index.html` (and the jloss path);
a stale `.git/index.lock` can make `git diff`/`git status` unreliable in this
sandbox, so compare against `git show HEAD:` to bypass the index.

## Section-divider HTML comments are uppercase literals (the trap)
`template.html` has `<!-- ... MEET SHAPE ... -->` and `<!-- ... WHY AJAY ... -->`.
They are UPPERCASE and NOT placeholder-substituted, and committed ajay/jloss
inherited them verbatim (jloss's comment literally says "WHY AJAY"). They CANNOT
be templatized to `{{BRAND}}`/`{{NAME}}` without changing ajay/jloss bytes, so a
new ambassador's deck legitimately still contains those tokens INSIDE comments.
When verifying "no stray brand token remains," scope the check to VISIBLE content
(exclude `<!-- -->`); the dev comments are non-rendered and locked for
byte-equality.

## Other gotchas
- Thousands separator is a **non-breaking space (U+00A0)**, not ASCII space.
  `build.cjs` `group()` emits NBSP; any string-matching against deck numbers must
  use `\u00A0`.
- Revenue math (per conversion %): `subs = round(audience*pct)`;
  `profitUSD = subs*priceUSD`; `profitLocal = profitUSD*rate`;
  `shareX = profitX*share`. Display = `Math.round` then NBSP-group. The 1% row is
  the `hot` row and also feeds the four headline cards.
- Compact audience label: ≥1e6 → one-decimal "M" (1.105M→"1.1M"), ≥1e3 → "K".
- The rendered PDF is 8 pages (the established output for ajay/jloss too), even
  though the deck has 10 `.slide` sections; that is the accepted baseline, not a
  regression.
