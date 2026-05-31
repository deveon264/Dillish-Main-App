---
name: Exercise video streaming & admin uploads
description: Decisions/constraints for the Postgres-backed exercise video feature (Expo Router API routes).
---

# Exercise video uploads & streaming

Videos are stored as Postgres `bytea` (no object-storage skill exists in this env) and served via Expo Router API routes.

## HTTP Range streaming (iOS/Safari requirement)
- iOS/Safari will NOT play a `<video>` source unless the server honors `Range` and replies `206` with `Content-Range`/`Accept-Ranges`. Always implement Range.
- Postgres `substring(video_data FROM $1 FOR $2)` is **1-indexed** — pass `start + 1` for the byte offset.
- Range handler must: support suffix ranges (`bytes=-N` → last N bytes), return `416` + `Content-Range: bytes */<total>` for unsatisfiable/malformed/out-of-bounds ranges, and reject multi-range (`,`) with 416.
- **How to apply:** any byte-serving endpoint backed by bytea needs the full Range matrix; verify with curl `Range:` headers (normal, suffix, unsatisfiable, malformed, multi-range) before declaring done.

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
