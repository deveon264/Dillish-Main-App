---
name: Profile avatar storage
description: How member profile photos are stored (object storage, not inline on the account) and rendered.
---

# Profile photos (avatars) live in object storage

Avatars follow the **same pattern as exercise posters**: the image bytes go to
Replit Object Storage (`profile-avatars/<uuid>` under `PRIVATE_OBJECT_DIR`) and
the `users` row keeps only `avatar_object_path` + `avatar_mime`. The legacy
`avatar` TEXT column may still hold old `data:` URIs from before this change and
is rendered as-is for backward compatibility.

**Why:** a base64 data URI on the account row bloated every profile read/update
(hundreds of KB re-sent on each `/api/me`). Bytes-in-storage keeps the account
payload tiny.

## Endpoints / flow
- `GET /api/avatar?id=<userId>&v=<version>` → 302 to a signed GCS GET URL (or 404
  if no stored photo). Unauthenticated by design, mirroring the poster endpoint
  (photo keyed by an unguessable account id).
- `POST /api/avatar` (session-gated): raw image body streamed straight to storage
  with an 8MB cap enforced from Content-Length + a TransformStream byte-counter;
  swaps `avatar_object_path`/`avatar_mime`, clears legacy inline `avatar`, deletes
  the replaced object. Returns the updated `toPublicUser`.
- `DELETE /api/avatar` (session-gated): clears columns + deletes the object.
- `/api/me` PATCH **no longer accepts `avatar`** — photos go only through the
  dedicated endpoint, so name/email/onboarding updates never carry image bytes.

## Testing seam
- `app/api/avatar+api.ts` exposes testable core handlers `avatarGet/avatarPost/
  avatarDelete(request, storage?)` with an injectable `AvatarStorage` seam (the
  object-storage ops that hit the sidecar). The Expo Router `GET/POST/DELETE`
  exports are thin wrappers using the real storage. Tests pass a fake storage +
  the in-memory `fakeUserDb` (real auth + real userStore), mirroring how
  `exercise-cleanup` injects its IO. **Why:** the size-limit logic lives in the
  handler, so faking only storage lets the streaming byte-counter run for real.

## Client rendering & cache-busting
- `toPublicUser` exposes `avatarVersion` (the object path's trailing uuid) instead
  of the raw bucket path. A new upload = new uuid = new version → the render URL
  changes, so a replaced photo is never served from image cache.
- Resolve the renderable URI with `avatarUri(user)` in `lib/avatar.ts`: object
  photos → the avatar endpoint URL; legacy `data:` URIs → returned directly; none
  → null (UI shows initials). Only `app/(tabs)/profile.tsx` renders the real image
  (other tabs show initials only).
- Upload helpers `uploadAvatar`/`removeAvatar` in `lib/avatar.ts` are wired through
  `AuthContext` (`uploadAvatar`/`removeAvatar`), which `setUser`s the returned
  image-free public user. Native streams the file from disk via
  `createUploadTask` (BINARY_CONTENT); web sends a blob. No base64 anymore.
