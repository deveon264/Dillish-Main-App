---
name: Object-storage media needs a per-type cleanup sweep
description: Any new user-uploaded media type stored in Replit Object Storage leaks orphans unless it gets its own reconciliation/age sweep in the cleanup cron.
---

# Object-storage media cleanup is per-type, not automatic

Every kind of user-uploaded media in this app is stored as an object in Replit
Object Storage under its own prefix (`exercise-video*`, `meal-photos/<uuid>`,
`community-photos/<key>`, avatars, ...). The DB only holds the key/path. Storage
is NOT garbage-collected on its own.

**Rule:** when you add a new uploaded media type, you must also add a cleanup
sweep for it, or its objects accumulate forever. Two reconciliation styles exist
(see `scripts/cleanup-cron.mjs` + the matching `*-cleanup+api.ts` routes):
- **reference-counted** against a DB column (exercise media reconciles storage
  against the `exercises` table) — use when a table references the key.
- **age-windowed** delete (meal photos delete `meal-photos/*` older than 90 days)
  — use when there is no DB row to count against (e.g. device-local logs).

**Why:** an object created but never attached (user cancels compose, or the
create call fails after upload) is orphaned silently. There is no foreign key or
TTL on the bucket; only the cron sweep reclaims it.

**How to apply:** community-photos now HAS a sweep (`community-photo-cleanup`
route + third call in `cleanup-cron.mjs`), reference-counted against
`community_posts.photo_object_path` with a 1-hour grace window. The remaining
known gap is `profile-avatars/<uuid>` (replaced avatars are deleted inline, but
a crash between upload and the `users.avatar_object_path` update orphans the old
object). Keep the one-line `scanned=… deleted=…` log summary so a coach can
confirm any new sweep ran.
