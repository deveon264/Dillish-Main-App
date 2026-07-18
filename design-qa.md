# Florish Home and Calorie Tracker — Design QA

## Evidence

- Source visual truth: `C:\Users\LENOVO\Downloads\Mobile app UI polish (2).zip`
  - `design_handoff_home_and_tracker/home-20a-modified.html`
  - `design_handoff_home_and_tracker/tracker-22b.html`
- Rendered implementation: `http://localhost:8083`
- Primary viewport: 402×874, light theme, Chrome, authenticated `Admin` QA account, personalized live program, 10-day streak, two saved workouts, empty calorie/water state.
- Responsive viewport: 390×844 with the same state.
- Implementation screenshots:
  - `artifacts/design-qa/implementation-home-402x874.png`
  - `artifacts/design-qa/implementation-tracker-402x874.png`
  - `artifacts/design-qa/implementation-home-390x844.png`
  - `artifacts/design-qa/implementation-tracker-390x844.png`
- Source captures:
  - `artifacts/design-qa/source-home-20a-modified-402x874.png`
  - `artifacts/design-qa/source-tracker-22b-402x874.png`

## Full-view comparison evidence

- `artifacts/design-qa/comparison-home-full-402x874.png`
- `artifacts/design-qa/comparison-tracker-full-402x874.png`

The source and implementation are presented together in each comparison image at the same 402×874 content size. The reference's decorative rounded device frame is not part of the production app and was excluded from mismatch severity.

## Focused-region comparison evidence

- `artifacts/design-qa/comparison-home-focused-hero.png`
- `artifacts/design-qa/comparison-tracker-focused-dashboard.png`

Focused comparisons were required because the hero typography/CTA alignment and Tracker dashboard typography, rings, bars, segment control, and action tiles are too small to judge reliably from the full-view images alone.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: bundled Playfair Display and Figtree match the handoff's display/body roles, weights, scale, uppercase tracking, italic Tracker title, and number hierarchy. Dynamic workout and quote copy wraps within the intended bounds.
- Spacing and layout rhythm: the full-bleed 560px Home hero, safe-area headers, 24px content margins, 16–18px section rhythm, card radii, compact streak ribbon, combined Today card, Tracker dashboard zones, action tiles, and compact meal row align with the source. Both requested mobile sizes remain scrollable without clipped controls.
- Colors and tokens: background, ink, accent, deep accent, hydration pink, ring track, tints, borders, and flat-card elevation rules visually match the supplied palette.
- Image quality and asset fidelity: production workout/avatar assets are sharp, correctly cropped, and used directly. The different Home subject/title is expected because the handoff explicitly makes `dillish.jpg` reference-only and production workout data authoritative.
- Copy and content: static labels match the handoff. Greeting, workout, streak nudge, quote, dates, goals, totals, week bars, and empty/meal states are intentionally populated from live state rather than reference literals.
- Icons and controls: Ionicons consistently provide the requested line-icon treatment. No placeholder or handcrafted visual assets were introduced.
- Bottom navigation: its production appearance, wording, badges, icons, and behavior were intentionally left unchanged, so differences from the HTML mock are expected and accepted.

## Interaction and accessibility checks

- Verified scrolling and internal Calories/Water/Progress selection.
- Verified notification and avatar navigation, notification close, streak history open/close, workout start, Home meal/water links, saved-workout controls, and bottom tabs.
- Verified one-tap Photo source chooser, Voice panel, focused Text input, empty and populated meal states, meal details, deletion, insight chips, and Browse Recipes.
- Added accessible close labels to Home sheets and button/selected semantics to Tracker segments.
- Verified reduced-motion-aware ring/timing implementations through automated tests.
- Browser console and page errors checked after exercising the populated meal state: 0 errors.

## Comparison history

1. Initial pass — blocked by P2 safe-area spacing drift and a P1 Tracker meal-empty-state composition mismatch. The web render started both headers about 30px above the source, and Tracker used an oversized centered empty card instead of the specified row.
2. Revision — added a web safe-area floor while preserving native insets, and replaced the Tracker empty state with the compact icon/copy/Log row. Post-fix evidence: `comparison-home-full-402x874.png`, `comparison-tracker-full-402x874.png`, and `comparison-tracker-focused-dashboard.png`.
3. Interaction pass — found P2 missing accessible labels on Home sheet close controls and missing role/selected semantics on Tracker segments; both were added and retested.
4. Populated-state console pass — found a P1 invalid nested-button structure in meal rows. Meal-detail and delete controls were separated into sibling targets without changing behavior. The final browser run passed every interaction with zero console errors.
5. Final pass — no actionable P0/P1/P2 mismatch remained at 402×874 or 390×844.

## Implementation checklist

- [x] Source and implementation captured at matched viewport/state.
- [x] Full-view and focused side-by-side comparisons reviewed.
- [x] P0–P2 findings fixed and recaptured.
- [x] Core Home and Tracker interactions exercised.
- [x] Console errors checked.
- [x] 390×844 responsive pass completed.
- [x] Full automated test suite and Expo web export passed.

## Follow-up polish

- P3: very long live streak nudges truncate to one line to protect the day-dot ribbon; this is acceptable and preserves the compact handoff composition.

## Hero copy density follow-up — 2026-07-17

### Evidence

- Source visual truth: `C:\Users\LENOVO\.codex\codex-remote-attachments\019f6ea1-a347-7d23-97c0-2d7c1f7c8aae\9100B4FF-BFDB-48FC-BC56-E66A11235756\1-Photo-1.jpg`
- Browser-rendered implementation: `artifacts/design-qa/hero-compact-390x844.png`
- Viewport/state: 390×844 CSS pixels at 2× density, light theme, isolated signed-in verification member, Day 5 of the 4-Week Weight Loss Starter, Beginner Fat Burn hero.
- Full-view comparison: `artifacts/design-qa/comparison-hero-compact-full.png`
- Focused comparison: `artifacts/design-qa/comparison-hero-compact-focus.png`
- Local preview: `http://localhost:8085`

### Findings

- No actionable P0, P1, or P2 findings remain in the requested hero-copy region.
- Fonts and typography: the existing bundled Playfair Display/Figtree pairing is preserved. The title remains a single readable line at 28/32, the eyebrow remains uppercase with reduced 1.6 tracking, and metadata remains readable at 11.5/16.
- Spacing and layout rhythm: eyebrow-to-title spacing is 4px; the metadata/CTA row begins 8px below the title; row gap is 10px; CTA vertical padding is 10px. The group is visibly tighter than the supplied circled state without crowding or overlap.
- Colors and visual tokens: no color, gradient, shadow, or contrast tokens changed.
- Image quality and asset fidelity: the production hero asset and crop are unchanged and remain sharp at 2× capture density.
- Copy and content: the long program label, workout title, metadata, and CTA all remain live-data-driven and fit on one line in the verified state.
- Chrome console/page errors: 0.

### Comparison history

1. Source finding — P2: the circled hero copy felt vertically loose, especially between the eyebrow, title, metadata, and tall CTA.
2. Revision — reduced eyebrow size/line height/tracking, title size/line height, action-row margin/gap, metadata size, and CTA padding/text size.
3. Post-fix evidence — the matched full and focused comparisons show a compact, aligned three-tier block with no clipping, wrapping, overlap, or tab-bar impact.

### Verification

- Focused Home polish tests: 5 passed, 0 failed.
- Expo web export: passed.
- Full suite: 652 passed, 3 environment-dependent skips, 2 unrelated existing Tracker meal-detail harness failures. Both isolated failures occur before Tracker renders because the test's React Native mock does not provide `Touchable.Mixin` required by `react-native-svg`; this follow-up changes only Home hero styles and its source-level regression test.

final result: passed
