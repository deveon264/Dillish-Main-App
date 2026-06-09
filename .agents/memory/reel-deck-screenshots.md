---
name: Reel/deck app screenshots
description: How to (re)generate the welcome/home app screenshots used by walkthrough reels and pitch decks
---

The walkthrough reels (`pitch/walkthrough-src/`) and pitch decks show app screenshots
inside phone frames: per-ambassador `welcome.png` + `home.png`, plus shared scenes. The
templates use `object-fit: cover`, so exact pixel size does not matter, only a ~0.48
portrait ratio (real-device 1179xNNNN and puppeteer 860x1864 both work).

Rather than waiting on user device screenshots, you can auto-generate clean ones from the
live dev app by mirroring `pitch/tooling/capture.cjs` (puppeteer + system chromium). Two
non-obvious gotchas that cost real time:

- **Auth/onboarding gate:** the home screen only renders for a logged-in, onboarded
  account. Create a throwaway account via the signup API, mark onboarding complete, inject
  the session token + seeded device-local data into localStorage, THEN navigate. A fresh
  account has no avatar (shows the name initial); the demo persona/workout are deterministic.
- **No color-emoji font in headless chromium:** the home greeting flower renders as a tofu
  box. Inject the Noto Color Emoji web font and apply it ONLY to the emoji leaf nodes, or
  you clobber the Cormorant serif headings.

**Why it matters:** the reel template hardcodes the "Shape by {{NAME}}" wordmark, so the
welcome screenshot's in-app wordmark must match whatever `components/Logo.tsx` currently
renders, or the phone screen and the surrounding reel chrome disagree.
