---
name: Server profile persistence
description: Profile metrics live on the server tied to the account; how PATCH merges atomically and why local storage is only a cache.
---

Member profile metrics (age/weight/height/units/goals/water+calorie goals/start+goal weight) are persisted **server-side** in `users.profile` (JSONB), tied to the account, so they survive account-id changes or cleared local storage. Local AsyncStorage is now only an offline cache, not the source of truth.

The canonical, server-safe shape lives in `lib/profile.ts` (no react-native imports): the `Profile` type, `DEFAULT_PROFILE`, `sanitizeProfilePatch` (validates a partial, dropping invalid keys), and `sanitizeProfile` (= base + patch → full profile). `contexts/DataContext.tsx` re-exports `Profile`/`DEFAULT_PROFILE` from there for back-compat — do NOT redeclare them in DataContext (an old duplicate `const DEFAULT_PROFILE` once caused a Metro "Duplicate declaration" error; tsc was clean, it was stale cache — clear `node_modules/.cache` + restart if it reappears).

**PATCH must stay atomic.** `/api/profile` PATCH uses a single `UPDATE ... SET profile = COALESCE(profile,'{}'::jsonb) || $1::jsonb` statement (via `patchUserProfile`), NOT an app-level read-modify-write. 
**Why:** two read-then-write PATCHes on different fields raced and lost updates. The `jsonb || jsonb` shallow merge serializes at the row and preserves both fields.
**How to apply:** never reintroduce a `getUserProfile` → mutate → `setUserProfile` sequence for profile writes. Sanitize the patch to valid keys only (so invalid input is dropped, not written as a default), then merge. Read-side `getUserProfile` re-runs `sanitizeProfile` so a stored partial/legacy blob always surfaces as a full sane profile.

Client reconciliation: on load, after the local cache, DataContext GETs `/api/profile`; if the server has a profile it wins, else it one-time PATCHes the local profile up when it's non-default. `updateProfile` is optimistic local + fire-and-forget write-through PATCH (response intentionally not applied, to avoid clobbering a newer in-flight edit). Auth is account-scoped via the session bearer token (`session.sub`), exposed through AuthContext.
