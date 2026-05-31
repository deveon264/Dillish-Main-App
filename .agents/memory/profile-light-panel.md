---
name: Profile header panel theming
description: The Profile header (avatar/name/badges + 4-stat row) is dark "glass", matching the rest of the app
---

The Profile tab's header block — profile card (avatar, name, email, Premium +
streak badges) and the 4-stat row (Age/kg/cm/BMI) — is rendered inside a single
dark translucent "glass pill" (`styles.headerPanel`: `colors.card` bg +
`colors.cardBorder`), consistent with the dark charcoal theme used across the
rest of the app. The inner profile `Card` is transparent (no bg/border) so the
pill is the only surface; the BMI stat keeps a rose accent tint.

**Why:** It was briefly a light blush LinearGradient panel matching a one-off
reference image, but the user reverted it back to the original dark color and
asked only for the glass-pill container. Do not reintroduce the light/blush
panel.

**How to apply:** Keep this block on dark tokens (`colors.foreground`,
`colors.mutedForeground`, `colors.track`, `colors.cardElevated`). The inline
name-edit controls (TextInput + gradient Save / outline Cancel) are also dark —
keep future edits to this block dark, not light.
