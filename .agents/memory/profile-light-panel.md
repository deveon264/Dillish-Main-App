---
name: Light theme & image-scrim inversion rule
description: The app is a LIGHT "Lime & Ice" theme; image/video overlays keep dark charcoal scrims + white text while solid surfaces are light cards + dark ink text
---

The whole app uses a single LIGHT, airy palette ("Lime & Ice": icy-white/`#F2F3EF`
backgrounds, soft-charcoal `#2D312E` ink text, sage/olive/moss greens as the accent
family) defined in `constants/colors.ts` (the source of truth). There is NO
dark-mode toggle — light is the only theme. (The app was previously a pink
"strawberry-cherry" light theme; it was recolored to greens.)

**Accent discipline:** The accent family is greens — moss `colors.primary` #525B4A,
sage `colors.accentSoft` #AFBCA1. Lime `colors.success` #6F9E2E is the energetic
pop, reserved for small moments (success states, "goal reached" chart bar). There
is NO blue in this theme — `colors.link` is moss (#525B4A), not royal blue. The
macro triad (`colors.protein` #525B4A / `colors.carbs` #7F8C6E / `colors.fats`
#A9C06B) stays in the green family.

**Scrim-inversion rule (the important one):** Content layered over photos or
videos (workout player + rest screens in `app/workout/[id].tsx`, hero images,
before/after photos, video overlays) keeps a DARK scrim — `rgba(16,17,17,α)`
(midnight charcoal) — with WHITE text/icons (`colors.onPrimary` or `"#FFFFFF"`).
Only SOLID surfaces flip to light card + dark ink text. So a single screen can mix
dark-over-image regions and light solid regions.

**Why:** A naive recolor that swapped every `colors.foreground` to dark ink made
over-image text/icons invisible (dark-on-dark). Over-image text must stay light.

**How to apply:** Before recoloring any element, ask "does this sit on an image
/ video / dark scrim, or on a solid light surface?" Light surface → dark text;
over image → white text + keep the dark scrim. The Profile header (`headerPanel`
in `app/(tabs)/profile.tsx`) is a plain white card (`colors.card`), NOT a dark
glass pill.

**Media-surface fills:** A media/player container that renders white controls
(workout `player` ImageBackground, exercise `videoWrap`) must keep a NEUTRAL DARK
fill (`#000`) even when no poster/video image is present — the flip-to-light rule
does NOT apply to image/video surfaces, or the white controls vanish on the light
background.
