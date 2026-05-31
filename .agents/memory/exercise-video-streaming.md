---
name: Exercise video streaming & admin uploads
description: Decisions/constraints for the exercise video feature (object-storage bytes + Postgres metadata, Expo Router API routes).
---

# Exercise video uploads & streaming

Video **bytes live in Replit Object Storage**; Postgres `exercises` stores only the object path + metadata (title, description, cues, category, level, duration, video_mime, video_size). This is a hard architectural requirement — never put video bytes in Postgres.

## Object storage via sidecar (NOT the @google-cloud/storage SDK)
- **The `@google-cloud/storage` SDK does NOT bundle in Metro's Expo Router server runtime** — it fails at bundle time with `Cannot read properties of undefined (reading 'v1')`. Do not import it in `+api.ts` (or anything they import).
- Instead talk to the Replit object-storage sidecar at `http://127.0.0.1:1106/object-storage/signed-object-url` with plain `fetch`: POST `{bucket_name, object_name, method, expires_at}` → `{signed_url}`. Upload = signed `PUT`, stream = signed `GET`, delete = signed `DELETE`. See `lib/objectStorageServer.ts`.
- Object path format: `${PRIVATE_OBJECT_DIR}/exercise-videos/<uuid>`; parse `/bucket/object...` by splitting on `/`.
- **Why:** keeps the heavy SDK out of the Metro bundle entirely; signed URLs do all the work.

## HTTP Range streaming (iOS/Safari requirement)
- iOS/Safari will NOT play a `<video>` source unless the server honors `Range` and replies `206`. With object storage this is **free**: the video endpoint just 302-redirects to the signed GCS GET URL, and GCS handles `Range`/`206` natively. Verified curl `Range: bytes=0-99` → `206` + `Content-Range`.
- **How to apply:** don't re-implement Range when redirecting to GCS — let storage serve the bytes.

## Admin auth constraint (known limitation, not a bug to "fix" in scope)
- This app uses **mock auth with no real server sessions**. The server can only gate admin-only routes by comparing a client-supplied `x-user-email` header against the admin email constant.
- **Why:** there is no JWT/cookie/session infrastructure to derive identity server-side. The header is spoofable; UI gating is cosmetic.
- **How to apply:** treating this as "broken access control" is correct in the abstract, but a real fix requires replacing the whole auth foundation — out of scope for an additive upload feature. Propose it as a follow-up rather than bolting on partial auth.

## TS lib typing gotcha in Expo Router API routes
- The server runtime is undici/Node, but bundled RN/DOM types make `request.formData().get()` and `new Response(Buffer, ...)` fail typecheck. Cast: `const form: any = await request.formData()` and `new Response(buf as any, ...)`. Runtime works fine.

## SDK/library quirks
- expo-image-picker v17: `mediaTypes: ["videos"]` (array form).
- expo-video v3: `useVideoPlayer(uri, cb)` + `<VideoView player nativeControls allowsFullscreen />`.
- Don't import `lib/storage` (AsyncStorage) into server API routes — it pulls a native module into the server bundle. Inline small helpers (e.g. id generation) instead.
