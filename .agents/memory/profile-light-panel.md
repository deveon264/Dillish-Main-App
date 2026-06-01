---
name: Light theme & image-scrim inversion rule
description: The app is a single LIGHT "Studio Rose" theme; image/video overlays keep dark charcoal scrims + white text while solid surfaces are light cards + dark ink text. Multi-hue accent semantics (rose/honey/blush/sage/plum).
---

The whole app uses a single LIGHT, warm palette ("Studio Rose": warm off-white
`#F7F0EA` backgrounds, deep-plum `#4A2E33` heading ink, warm-taupe `#8A6F66` detail
text, dusty-rose accents) defined in `constants/colors.ts` (the SINGLE source of
truth — brand tints derive from private `accentRgb`/`successRgb`/`honeyRgb`/`blushRgb`/
`creamRgb` constants, so a recolor is mostly a one-file rewrite). There is NO dark-mode
toggle — light is the only theme. (History: pink "strawberry-cherry" → green "Lime &
Ice" → "Vanilla & Botanical" → this warm feminine "Studio Rose" inspired by a sunlit
yoga studio: dusty-rose activewear, honey-wood floor, cream walls.)

**Multi-hue accent discipline (this theme is NOT monochrome):**
- Dusty rose `colors.primary` #C57B86 = primary actions, rings/bars, active tabs,
  selected states, links (NO blue — `colors.link` is rose). `accentSoft` #DCA3AB is
  the lighter rose; `accentDark` #8E4A55 is secondary/outline button text.
- Warm honey wood `colors.highlight` #C2925E = celebratory highlights ONLY: streaks,
  calories burned, achievements/badges, "Over" stop of BMI scale.
- Soft pink blush `colors.blush` #F3C7C2 = feminine warmth, SPARINGLY: empty-state
  icons, Premium badge, "Under" softness on BMI scale. NOT for functional selected
  states (those stay rose).
- Soft sage `colors.success` #7FA37C = small success pop (e.g. progress trend pill).
- Deep plum `colors.foreground` = headings/important text; taupe `colors.mutedForeground`
  /`muted` = detail text. Macros: protein rose / carbs honey / fats coral. `danger`
  is warm coral #D9614F.

**Scrim-inversion rule (the important one):** Content layered over photos or videos
(workout player + rest screens in `app/workout/[id].tsx`, hero images, before/after
photos, video overlays) keeps a DARK scrim — `rgba(16,17,17,α)` (midnight charcoal) —
with WHITE text/icons (`colors.onPrimary` or `"#FFFFFF"`). Only SOLID surfaces flip to
light card + dark ink text. A single screen can mix dark-over-image and light solid regions.

**Why:** A naive recolor that swapped every `colors.foreground` to dark ink made
over-image text/icons invisible (dark-on-dark). Over-image text must stay light.

**How to apply:** Before recoloring any element, ask "does this sit on an image /
video / dark scrim, or on a solid light surface?" Light surface → dark text; over
image → white text + keep the dark scrim. The Profile header (`headerPanel` in
`app/(tabs)/profile.tsx`) is a plain white card (`colors.card`), NOT a dark glass pill.

**Media-surface fills:** A media/player container that renders white controls (workout
`player` ImageBackground, exercise `videoWrap`) must keep a NEUTRAL DARK fill (`#000`)
even when no poster/video image is present — the flip-to-light rule does NOT apply to
image/video surfaces, or the white controls vanish on the light background.
