---
name: Exercise video streaming & admin uploads
description: Decisions/constraints for the exercise video feature (object-storage bytes + Postgres metadata, Expo Router API routes).
---

# Exercise video uploads & streaming

Video **bytes live in Replit Object Storage**; Postgres `exercises` stores only the object path + metadata (title, description, cues, category, level, duration, video_mime, video_size). This is a hard architectural requirement — never put video bytes in Postgres. Poster images follow the same pattern (separate `exercise-posters/` folder + `poster_object_path`/`poster_mime` columns, served by `/api/exercise-poster` with the same 302→signed-GET redirect).

## Posters (generated or coach-chosen)
- Poster generation happens **client-side**, never on the server: native uses `expo-video-thumbnails` (lazy `await import` so web never loads it); web draws a video frame to a `<canvas>` and exports a JPEG data URL (`lib/posterFromVideo.ts`). Both return a `{uri, mimeType}`.
- Posters are uploaded as a **separate raw-body streaming request** to `POST /api/exercise-poster?id=<id>` (NOT multipart, NOT part of the exercises POST body — that body is reserved for the streamed video). This same endpoint both attaches a poster during upload AND replaces it later (it swaps `poster_object_path`/`poster_mime` and deletes the old object), so "edit poster after publish" reuses it — don't add a duplicate PATCH handler. Client helper: `updateExercisePoster()` in `lib/exercises.ts` via the shared `postBinary` helper. Editing entry point: per-card button in `app/exercises.tsx` → `app/admin/edit-poster.tsx`.
- **Web "regenerate from existing video" caveat:** capturing a frame from the already-stored video uses `generatePosterFromVideo(videoUrl(id))`; on web the canvas taints because the GCS signed URL has no CORS headers, so it returns null and the UI falls back to "choose a custom image". Native is fine.
- **Why client-side:** keeps ffmpeg/native decoders out of the Metro server bundle (same spirit as keeping `@google-cloud/storage` out). A failed/missing poster must never block the video upload — server treats poster as fully optional.
- expo-video player has **no built-in poster prop**: the player screen overlays the poster `<Image>` absolutely over `VideoView` and hides it on the `statusChange`→`readyToPlay` event (`useEventListener` from `expo`).
- `poster_object_path`/`poster_mime` are added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `ensureSchema` (CREATE TABLE IF NOT EXISTS won't backfill existing tables).

## Listing objects (orphan cleanup) — sidecar /token + GCS JSON API
- To **list** objects (e.g. reconcile storage against the DB for orphan cleanup) you cannot use signed URLs (they're per-object) and cannot use `@google-cloud/storage` (doesn't bundle in Metro). Instead: `POST http://127.0.0.1:1106/token` (empty `{}` body) returns a ready-to-use Google `ya29.` access token, then call the GCS JSON API directly: `GET https://storage.googleapis.com/storage/v1/b/<bucket>/o?prefix=<objectName>&pageToken=...`. Follow `nextPageToken`. Each item's `name` is bucket-relative; prepend `/<bucket>/` to match the full path stored in the DB. See `listObjects()` in `lib/objectStorageServer.ts`.
- Orphan cleanup endpoint: `POST /api/exercise-cleanup` (admin-gated, `?dryRun=1` to preview). Deletes exercise-video objects not referenced by any `exercises.video_object_path` AND older than a 1h grace window (so in-flight uploads — object written before its DB row — are never deleted). Idempotent.

## Object storage via sidecar (NOT the @google-cloud/storage SDK)
- **The `@google-cloud/storage` SDK does NOT bundle in Metro's Expo Router server runtime** — it fails at bundle time with `Cannot read properties of undefined (reading 'v1')`. Do not import it in `+api.ts` (or anything they import).
- Instead talk to the Replit object-storage sidecar at `http://127.0.0.1:1106/object-storage/signed-object-url` with plain `fetch`: POST `{bucket_name, object_name, method, expires_at}` → `{signed_url}`. Upload = signed `PUT`, stream = signed `GET`, delete = signed `DELETE`. See `lib/objectStorageServer.ts`.
- Object path format: `${PRIVATE_OBJECT_DIR}/exercise-videos/<uuid>`; parse `/bucket/object...` by splitting on `/`.
- **Why:** keeps the heavy SDK out of the Metro bundle entirely; signed URLs do all the work.

## Streamed uploads (don't buffer whole videos in server memory)
- The signed `PUT` URL accepts a **streamed body** (undici `fetch` with `body: ReadableStream`, `duplex: "half"`) as long as you forward an explicit `Content-Length` header. Verified end-to-end (PUT 200, GET back byte-for-byte). With Content-Length the upload is a normal, non-chunked request.
- The upload wire format is **raw video bytes as the request body + text metadata in query params** (NOT multipart). This is what lets the server enforce the 80MB cap from the request's `Content-Length` *before* touching the body, and pipe `request.body` straight to storage. A `TransformStream` byte-counter aborts mid-stream as defense-in-depth. `video_size` is taken from Content-Length.
- **Why multipart was dropped:** `request.formData()` buffers the entire payload into memory before any size check could run. Multipart also has no per-part length, so you can't give the GCS PUT a Content-Length.
- Client native path uses `expo-file-system` **legacy** `uploadAsync(url, uri, { uploadType: FileSystemUploadType.BINARY_CONTENT })` — streams the file from disk, never through JS memory. Import from `expo-file-system/legacy` (the new File API in v19 doesn't expose uploadAsync at the top level). **Pin expo-file-system to the SDK-54 version (`19.0.x`)** — `installLanguagePackages` grabbed a wrong `56.x` that Expo flagged as incompatible.

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
