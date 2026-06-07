---
name: Logo lockup tuning
description: Geometry quirks of components/Logo.tsx (welcome "Florish" wordmark + "BY DILLISH" pill), especially web-preview vs Expo Go device differences.
---

# Logo lockup (components/Logo.tsx)

The welcome screen uses `Logo size="lg" tagline="by dillish"` — the only place the
tagline pill renders. The icon (gradient rounded square, `mark` px) sits left; the
wordmark "Florish" and the pill stack to its right. The recurring goal: word top
near the icon top, pill bottom near the icon bottom, with a clear gap between word
and pill, all contained within the icon's height. Icon size must stay as-is.

## Hard-won rules

- **Never set the wordmark `lineHeight` below its `fontSize` on native RN.** It does
  NOT shrink the text — the glyph still draws at full size and overflows its line
  box, so the word pokes out the top and pushes the pill out the bottom. To make
  text occupy less vertical space, reduce `fontSize` instead. Keep
  `lineHeight: fontSize` (1.0em) — that renders compactly without overflow.
  **Why:** a `Math.round(fontSize*0.8)` lineHeight + `space-between` column looked
  perfect on the web preview but overflowed top & bottom on the user's iPhone.

- **The web preview (react-native-web) does NOT match Expo Go for serif line-box
  metrics.** Pixel-tuning offsets against a `/welcome` web screenshot is unreliable
  for the device. Treat the user's device screenshots as ground truth; only make
  monotonic, predictable changes (e.g. shrinking `fontSize` widens the word→pill
  gap) when you can't see native.

- **No `transform` on the wordmark `<Text>`** — transforms re-rasterize text and
  cause blur in Expo Go. Use layout (`marginTop`) for vertical offsets.

## Known-good baseline (renders contained on device)
Row (`alignItems: "flex-start"`) = icon + top-anchored `<Text>` (`marginTop:
textTop`); pill is a sibling `<View>` with `marginLeft: mark+gap`, `marginTop:
pillTop`. Because the icon is taller than the word, row height == `mark`, so the
pill's position is independent of `fontSize`. Shrinking `fontSize` lifts the word's
baseline and opens the word→pill gap WITHOUT moving the pill (stays contained).
lg values that worked: `mark 64`, glyph `icon 34`, `fontSize 40`, `lineHeight 40`,
`taglineSize 11`, `gap 6`, `textTop -8`, `pillTop -21`, pill `paddingVertical 3`.
