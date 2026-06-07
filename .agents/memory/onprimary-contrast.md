---
name: White-on-pink contrast convention
description: When to use onPrimaryStrong vs onPrimary vs deepening the fill for text/icons on the brand pink.
---

# Text/icon contrast on the brand pink (#DD8DA0)

White (`colors.onPrimary` #FFFFFF) on the solid rose pink (`colors.primary`/
`colors.accent` = #DD8DA0) only reaches ~2.5:1 and **fails WCAG AA**.

**Rule:**
- For text/icons sitting on a *solid pink* fill (buttons, active tab pills,
  category/cue/now badges, the "AI Detected" badge, paywall "RECOMMENDED",
  plan/exercise status circles), use `colors.onPrimaryStrong` (#4A2E33 deep ink,
  ~4.85:1). Never recolor the brand pink itself.
- For white text that *must stay white* (drama over photos, e.g. home hero
  title/meta, before/after photo labels), **deepen the fill** instead of changing
  the text color. Examples used: hero overlay gradient pushed toward black; the
  before/after "After" badge moved from `accentDeep` (translucent pink) to
  `accentDark` (#9E4E61 solid deep rose, white ~5.66:1).
- A shared text style that lands on BOTH a dark surface and a pink one (e.g.
  `baLabelText` used for "Before" on dark and "After" on pink): keep the text
  white and deepen only the pink variant's background.

**Why:** brand pink is fixed; readability must come from the text token or the
fill, not from altering the pink. This came up across two passes — first solid
pink *buttons*, then the remaining decorative badges/headers/tabs.

**How to apply:** when adding any new element on a pink fill, default its
text/icon color to `colors.onPrimaryStrong`. Leave white only over dark
images/scrims. Genuine action buttons vs decorative chips were treated the same
here — both get the dark ink on pink.
