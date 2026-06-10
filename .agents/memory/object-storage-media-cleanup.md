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

**Also applies to DB-resident data, not just storage objects.** Some Postgres
tables accumulate forever too and need their own sweep in the same cron. The
inbox `community_notifications` table had a 90-day *read* cap (older rows hidden)
but no delete, so it grew unbounded; it now has an age-only DB sweep
(`notification-cleanup` route, deletes rows with `created_at` past the same
90-day window). Pattern for a "soft cap on reads" table: if reads already hide
rows past an age, deleting past that same age changes nothing visible.

**How to apply:** community-photos and profile-avatars both now HAVE sweeps
(`community-photo-cleanup` / `profile-avatar-cleanup` routes, reference-counted
against `community_posts.photo_object_path` / `users.avatar_object_path` with a
1-hour grace window). `cleanup-cron.mjs` triggers all storage sweeps plus the
notification DB sweep in one run. Keep the one-line `scanned=… deleted=…` log
summary so an admin can confirm any new sweep ran.
