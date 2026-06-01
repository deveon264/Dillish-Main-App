---
name: Light theme & image-scrim inversion rule
description: The app is a LIGHT "strawberry-cherry" theme; image/video overlays keep dark scrims + white text while solid surfaces are light cards + dark ink text
---

The whole app uses a single LIGHT, airy palette (cream/white backgrounds, dark
ink text, pink/cherry accents) defined in `constants/colors.ts` (the source of
truth). There is NO dark-mode toggle — light is the only theme.

**Accent discipline:** Royal Blue (`colors.link` #233A8B) and Leaf Green
(`colors.success` #6BAF45) are reserved for small pops only — links, success
states, the BMI scale, a "goal reached" chart bar. They must NOT become
recurring UI/data colors. The macro triad (`colors.protein/carbs/fats`) is kept
in the warm family (strawberry/cherry/mauve) on purpose, not blue/green.

**Scrim-inversion rule (the important one):** Content layered over photos or
videos (workout player + rest screens in `app/workout/[id].tsx`, hero images,
before/after photos, video overlays) keeps a DARK scrim — `rgba(58,22,32,α)` —
with WHITE text/icons (`colors.onPrimary` or `"#FFFFFF"`). Only SOLID surfaces
flip to light card + dark ink text. So a single screen can mix dark-over-image
regions and light solid regions.

**Why:** A naive recolor that swapped every `colors.foreground` to dark ink made
over-image text/icons invisible (dark-on-dark). Over-image text must stay light.

**How to apply:** Before recoloring any element, ask "does this sit on an image
/ video / dark scrim, or on a solid light surface?" Light surface → dark text;
over image → white text + keep the dark scrim. The Profile header (`headerPanel`
in `app/(tabs)/profile.tsx`) is now a plain white card (`colors.card`), NOT the
old dark glass pill.

**Media-surface fills:** A media/player container that renders white controls
(workout `player` ImageBackground, exercise `videoWrap`) must keep a NEUTRAL DARK
fill (`#000`) even when no poster/video image is present — the flip-to-light rule
does NOT apply to image/video surfaces, or the white controls vanish on cream.
The recolor mistakenly set workout `player` to `colors.background` (cream); fixed
back to `#000`.
