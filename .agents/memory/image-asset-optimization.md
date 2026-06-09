---
name: Image asset optimization (webp)
description: How to shrink the large bundled studio photos and which encoder is actually available in this repl.
---

# Optimizing bundled photos

The exercise/hero studio photos ship as bundled assets and were originally huge
PNGs (~1.0-1.35MB each, ~45MB for the 38 exercise images) shown at full res even
for tiny thumbnails, causing slow pop-in.

**Encoder availability in this repl:** `cwebp`, `sharp`, `pngquant`, `oxipng` are
NOT installed. ImageMagick (`magick`/`convert`) and `ffmpeg` ARE, and ImageMagick
has the WebP delegate (libwebp). Use:
`magick in.png -quality 92 -define webp:method=6 out.webp`

**Quality:** these are smooth dark studio gradients, which band when over-compressed.
q92 (~25-50KB each) shows no visible banding; q80 (~15KB) risked banding on the
darkest gradients. Prefer ~q90+ for gradient-heavy dark photos.

**Why webp is safe here:** Metro's default `assetExts` includes webp, `expo-image`
decodes webp on iOS/Android, and react-native-web renders it via plain `<img>`
(modern browsers all support webp). So `require("...webp")` works everywhere.

**Gotchas when changing asset extensions:**
- Update every `require()` path (exercise images live only in `constants/workouts.ts`;
  heroes in `app/welcome.tsx` + `app/(tabs)/index.tsx`).
- `__tests__/find-exercise-image.test.ts` stubs Node require extensions for the
  asset types and asserts filenames; add the new ext to its stub loop and update
  the asserted filenames or the whole suite crashes parsing the bytes as JS.

**Fast loading on the player:** use `expo-image` (not RN `Image`/`ImageBackground`)
with `cachePolicy="memory-disk"` + a short `transition`, and warm a workout's
photos on mount with `ExpoImage.prefetch(uris, "memory-disk")` where uris come from
`Asset.fromModule(mod).uri` (expo-asset). expo-image has no `ImageBackground`: use a
`<View>` with an absolute-fill `<Image>` first child behind the gradient/overlay.
