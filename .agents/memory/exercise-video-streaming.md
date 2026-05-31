---
name: Exercise video streaming & admin uploads
description: Decisions/constraints for the exercise video feature (object-storage bytes + Postgres metadata, Expo Router API routes).
---

# Exercise video uploads & streaming

Video **bytes live in Replit Object Storage**; Postgres `exercises` stores only the object path + metadata (title, description, cues, category, level, duration, video_mime, video_size). This is a hard architectural requirement — never put video bytes in Postgres. Poster images follow the same pattern (separate `exercise-posters/` folder + `poster_object_path`/`poster_mime` columns, served by `/api/exercise-poster` with the same 302→signed-GET redirect).

## Posters (generated or coach-chosen)
- Poster generation happens **client-side** in the upload screen, never on the server: native uses `expo-video-thumbnails` (lazy `await import` so web never loads it); web draws a video frame to a `<canvas>` and exports a JPEG data URL (`lib/posterFromVideo.ts`). Both return a `{uri, mimeType}` that's appended to the upload FormData as `poster`.
- **Why client-side:** keeps ffmpeg/native decoders out of the Metro server bundle (same spirit as keeping `@google-cloud/storage` out). A failed/missing poster must never block the video upload — server treats poster as fully optional.
- expo-video player has **no built-in poster prop**: the player screen overlays the poster `<Image>` absolutely over `VideoView` and hides it on the `statusChange`→`readyToPlay` event (`useEventListener` from `expo`).
- `poster_object_path`/`poster_mime` are added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `ensureSchema` (CREATE TABLE IF NOT EXISTS won't backfill existing tables).

## Object storage via sidecar (NOT the @google-cloud/storage SDK)
- **The `@google-cloud/storage` SDK does NOT bundle in Metro's Expo Router server runtime** — it fails at bundle time with `Cannot read properties of undefined (reading 'v1')`. Do not import it in `+api.ts` (or anything they import).
- Instead talk to the Replit object-storage sidecar at `http://127.0.0.1:1106/object-storage/signed-object-url` with plain `fetch`: POST `{bucket_name, object_name, method, expires_at}` → `{signed_url}`. Upload = signed `PUT`, stream = signed `GET`, delete = signed `DELETE`. See `lib/objectStorageServer.ts`.
- Object path format: `${PRIVATE_OBJECT_DIR}/exercise-videos/<uuid>`; parse `/bucket/object...` by splitting on `/`.
- **Why:** keeps the heavy SDK out of the Metro bundle entirely; signed URLs do all the work.

## HTTP Range streaming (iOS/Safari requirement)
- iOS/Safari will NOT play a `<video>` source unless the server honors `Range` and replies `206`. With object storage this is **free**: the video endpoint just 302-redirects to the signed GCS GET URL, and GCS handles `Range`/`206` natively. Verified curl `Range: bytes=0-99` → `206` + `Content-Range`.
- **How to apply:** don't re-implement Range when redirecting to GCS — let storage serve the bytes.

## Admin auth: server-verified HMAC token (NOT the old spoofable header)
- Coach uploads/deletes are gated by a **server-signed admin token**, not the client `x-user-email` header. The header is gone from these routes.
- Flow: coach proves possession of `ADMIN_PASSCODE` (server-only secret) at `POST /api/admin-session` → server mints an HMAC-SHA256 token (signing key derived from the pre-existing `SESSION_SECRET`, NOT from the passcode) with `{role,email,exp}`, 12h TTL. Upload/delete routes call `requireAdmin(request)` which verifies the `Authorization: Bearer` token's signature + expiry. See `lib/adminAuth.ts`, `app/api/admin-session+api.ts`.
- Client stores the token in SecureStore/AsyncStorage via `lib/adminSession.ts`; `AuthContext` exposes `adminToken`/`adminUnlocked`/`unlockAdmin`/`lockAdmin`. UI shows `<AdminUnlock/>` (passcode entry) until unlocked.
- **Crypto:** use `globalThis.crypto.subtle` (WebCrypto) in API routes — verified to work in the Metro/Node server runtime. Do NOT `import "crypto"` (bundling risk, same family as the @google-cloud/storage problem).
- **Mock-auth caveat:** the human coach is still identified only by knowing the passcode (there's no server-side user/password store). That's the realistic ceiling given client-side mock login; the spoofable-header hole itself is closed.

## TS lib typing gotcha in Expo Router API routes
- The server runtime is undici/Node, but bundled RN/DOM types make `request.formData().get()` and `new Response(Buffer, ...)` fail typecheck. Cast: `const form: any = await request.formData()` and `new Response(buf as any, ...)`. Runtime works fine.

## SDK/library quirks
- expo-image-picker v17: `mediaTypes: ["videos"]` (array form).
- expo-video v3: `useVideoPlayer(uri, cb)` + `<VideoView player nativeControls allowsFullscreen />`.
- Don't import `lib/storage` (AsyncStorage) into server API routes — it pulls a native module into the server bundle. Inline small helpers (e.g. id generation) instead.
