---
name: Device-local persistence (calorie/water/weight logs)
description: Why these logs vanish after force-close/reopen and the two pitfalls that cause it
---

# Device-local persistence in DataContext

Some app data (calorie logs, water, workouts, favorites, notif-read ids) lives
**only on the device** in AsyncStorage, keyed by `florish:u:<uid>:<slice>`,
where `uid` is the server account id. It is NOT synced to Postgres (by design —
see replit.md). Profile/weight ARE reconciled with the server. Persistence of
the device-local slices therefore depends entirely on AsyncStorage + a stable
`uid` from a successful `/api/me` re-verification on launch.

Two non-obvious pitfalls caused "logged meals disappear after force-close":

1. **Fire-and-forget writes.** A mutator that does
   `setX(prev => { setJSON(key, next); return next })` returns *before* the
   AsyncStorage write resolves, so `await addX()` gives a false sense of
   durability — a force-close shortly after logging loses the write.
   **Rule:** device-local mutators must `await setJSON(...)` before resolving
   (and roll back + throw on failure). Mirror the `addPhoto` pattern in
   DataContext.tsx.

2. **Load-effect clobber.** The launch load effect read all slices from disk,
   then `await`ed a `/api/profile` network call, then called the setters. A log
   made during that network window was overwritten by the stale disk snapshot.
   **Rule:** hydrate the device-local-only slices *immediately* after the disk
   read, before any network await. Only profile/weight (which depend on the
   server reconciliation) are set after the await.

**Why it matters:** symptom is "still logged in but all my logs are gone."
If `user` were null the app would redirect to `/welcome` instead, so "data
gone while still on the tab" points at one of these two, not at auth.
