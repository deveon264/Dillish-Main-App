---
name: Streak/week math duplication
description: Where the weekly-streak and week-day computation lives and the constraint to keep copies in sync.
---

The "weekly streak" count and the Mon→Sun day markers (checkmark / today / dash) are computed from `completions` in two separate screens with identical logic:
- the home dashboard
- the workout player Progress tab

The shared shape: build a `Set` of `todayKey(new Date(c.ts))`; week starts Monday via `(getDay()+6)%7` offset; streak falls back to yesterday if today isn't completed, then counts consecutive days backward.

**Why:** there is no shared helper, so a change to one screen's streak rules silently diverges from the other.
**How to apply:** when changing streak or week-start behavior, update both screens together, or extract a shared helper in `lib/` and point both at it.
