---
name: App walkthrough animation
description: Design decisions for pitch/walkthrough.html (the looping 16:9 feature animation)
---

# pitch/walkthrough.html — app walkthrough animation

A self-contained, auto-playing, looping 16:9 HTML animation that walks through the
app's features, reusing the pitch deck brand system. Served by the same port-3001
static server as the pitch deck (`http://localhost:3001/walkthrough.html`).

## Water scene uses a CSS orb, not a screenshot — on purpose
There is **no water-tracking app screenshot** in `pitch/assets/` (only welcome,
home, calories, progress, workouts, profile). The water scene (scene 5)
intentionally uses a branded animated CSS "glasses" orb instead of a phone frame.
**Why:** capturing the water screen from the running web app would clash visually
with the high-res device screenshots, and the home dashboard already surfaces the
water stat. Do not "fix" this as a missing screenshot. To make it a real screen,
a matching high-res device capture of the water screen must be added first.

## Single rAF clock drives both scene + timeline
Scene selection and the bottom progress bar share ONE `requestAnimationFrame`
clock (elapsed % TOTAL, with a cumulative `STARTS` offset table). **Why:** the
earlier version chained `setTimeout` for scenes while the bar used an independent
CSS `infinite` animation; those two clocks drift apart over long loops / screen
recordings. Keep them on one clock if you edit `DUR`.

## Persistent corner lockup flips sides per scene
The `.anchor` lockup is placed on whichever side is clear: `ANCHOR_SIDE` maps
phone-on-left scenes to the right and phone-on-right/centered scenes to the left
(`.pos-left` / `.pos-right`). A fixed corner collides with the phone mockups.
