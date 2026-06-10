---
name: Preload a bundled image for instant first paint
description: How to warm a require()'d image into cache during the splash gate so a screen paints it on first frame, and why RNImage.resolveAssetSource fails on web.
---

# Preloading a bundled image so a screen never flashes its background

**Symptom this solves:** a screen renders its background color first, then the
hero `require(...)` image pops in a frame later (cream flash on web; late decode
on native). Root cause is timing, not file size: RN `<Image source={require}>`
resolves to an async fetch/decode after mount, and nothing warms it during the
existing splash gate.

## The fix (two parts)
1. **Warm the asset during startup**, alongside whatever the splash gate already
   awaits (e.g. fonts), with its own `.catch` so a failure never blocks `ready`:
   ```ts
   import { Asset } from "expo-asset";
   import { Image as ExpoImage } from "expo-image";
   const src = require("@/assets/.../hero.webp");
   const task = Asset.fromModule(src).downloadAsync()
     .then(a => { const uri = a.localUri ?? a.uri; return uri ? ExpoImage.prefetch(uri, { cachePolicy: "memory-disk" }) : undefined; })
     .catch(() => {});
   Promise.all([...fontTasks, task]).finally(() => setReady(true));
   ```
2. **Render with expo-image** (not RN Image) so a cache miss degrades gracefully:
   `contentFit="cover"`, `cachePolicy="memory-disk"`, `priority="high"`,
   `transition={200}`, and a tiny embedded LQIP `placeholder={{ uri: dataUri }}`
   so the gap shows a blurred brand-toned version, never the bare background.

**Why expo-asset, not `RNImage.resolveAssetSource`:** on react-native-web the
latter throws `RNImage.default.resolveAssetSource is not a function`.
`Asset.fromModule().downloadAsync()` resolves the bundled URI on **both** web and
native and warms the same Metro asset URL that expo-image reads, so the prefetch
hits the same cache entry. On native the bundled file loads on first frame anyway,
so the prefetch is harmless-redundant there.

**LQIP placeholder:** generate with `magick hero.webp -resize 32x -quality 55
-strip /tmp/lqip.jpg` then `base64 -w0`; ~0.7KB, embed as a `data:image/jpeg`
const. Pass as `placeholder={{ uri }}` (an object), NOT a bare string -- expo-image
treats a bare string placeholder as a blurhash/thumbhash and it will fail.

**Tradeoff:** gating whole-app `ready` on the preload also delays users who land
elsewhere (e.g. logged-in -> home). Acceptable for a tiny same-origin asset,
especially with the web fallback timeout already capping the gate.
