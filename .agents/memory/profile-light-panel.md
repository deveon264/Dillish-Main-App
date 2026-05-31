---
name: Profile light blush panel
description: Why the Profile header card + stats block is light-themed while the rest of the app is dark
---

The Profile tab's profile card + 4-stat (Age/kg/cm/BMI) row are intentionally
rendered inside a light blush LinearGradient panel (light translucent cards,
charcoal text, mauve labels, rose-tinted BMI, filled rose Premium badge),
even though the rest of the app — including the rest of the Profile screen —
is dark charcoal.

**Why:** The original HTML mockup (`design_mockups/12`) was dark, and the
current app matched it. The user later provided a new light-blush reference
for this specific block and explicitly chose scope = "just the header + stats
block shown in the image" (not the whole screen, not the whole app).

**How to apply:** Do not "fix" this as a dark/light inconsistency by darkening
the panel. The inline name-edit state inside this panel uses custom
light-themed controls (TextInput + gradient Save / outline Cancel) instead of
the shared dark-theme `Input`/`Button` components — keep any future edits to
this block on light surfaces.
