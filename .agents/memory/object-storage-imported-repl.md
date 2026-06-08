---
name: Object storage after repl import
description: Why storage (avatars, videos, meal photos) 401s after importing a repl, and the exact two-part fix, plus other account-tied secrets that don't carry over.
---

# Account-tied secrets that don't survive a repl import

Beyond object storage, an imported/copied repl loses several account-scoped
secrets that must be re-provisioned in the NEW account:
- `ADMIN_PASSCODE` (coach passcode; signup/login of the admin email 500s with
  "ADMIN_PASSCODE is not set" until set). User picks the value; request via
  `requestEnvVar` in Build mode.
- `PEXELS_API_KEY` (meal-log stock photos). Portable: paste the same key from
  the source account.
- `AI_INTEGRATIONS_OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_BASE_URL` (Replit
  AI gateway). These are Replit-managed, do NOT copy from the old account;
  reconnect the OpenAI integration to provision fresh ones.

**Replit AI phone-verification trap:** reconnecting the AI integration gates on
a one-time Replit phone verification tied to the *current account*. A number
already verified on the source account is rejected ("invalid or might be in
use"); it does not transfer. The user must verify with a different number or go
through Replit support. No code/env workaround exists; the AI gateway creds will
not provision until it passes.

Quick verify after setting the two portable secrets (Build mode, localhost:5000,
not $REPLIT_DEV_DOMAIN which 000s here): `POST /api/food-photo {"name":"..."}`
returns a real `photoUrl`; `POST /api/signup` with the admin email + a wrong
passcode returns 403 "Coach passcode required" (proves passcode loaded, no user
created).

# Object storage breaks after importing a repl

After a repl is imported/copied from another account, object storage fails for
every storage-backed feature (avatar upload, exercise videos/posters, meal
photos). Symptom: client shows "Failed to upload photo"; server log shows
`Failed to sign object URL (401)`; the sidecar at `http://127.0.0.1:1106`
returns `401 "no allowed resources"` on `/token` and
`/object-storage/signed-object-url`.

**Why:** the import carries over the SOURCE account's bucket id in config, but
this repl is not authorized for that foreign bucket. Two separate places hold a
bucket id and they get out of sync:
- `.replit [objectStorage] defaultBucketID`
- the `[userenv.shared]` env vars `PRIVATE_OBJECT_DIR` and
  `PUBLIC_OBJECT_SEARCH_PATHS`

**The trap:** the app code does NOT read `defaultBucketID`. It derives the
bucket name from `PRIVATE_OBJECT_DIR` (see `lib/objectStorageServer.ts`
`getPrivateDir()` -> `parseObjectPath`). So creating a new bucket via the
Object Storage tool fixes `defaultBucketID` only, while the env vars still point
at the dead foreign bucket, and signing keeps 401ing.

**How to apply (two parts, both required):**
1. User must create a new bucket via the workspace Object Storage tool. The
   agent cannot do this: `.replit` is not directly editable, and there is no
   object-storage provisioning callback in the code_execution sandbox.
   `addIntegration`/`proposeIntegration` short-circuit with "already installed"
   while a stale bucket id is present, so they do NOT provision.
2. Agent then repoints the env vars to the NEW bucket id and restarts the app:
   `setEnvVars({ values: { PRIVATE_OBJECT_DIR: "/<newbucket>/.private",
   PUBLIC_OBJECT_SEARCH_PATHS: "/<newbucket>/public" }, environment: "shared" })`
   then restart the "Start application" workflow.

**Verify (Build mode, curl POST allowed):** `POST 127.0.0.1:1106/token` returns
a token (not 401), and a signed PUT URL for `/<newbucket>/.private/...` round
-trips (PUT 200, DELETE 204). The new bucket starts empty; objects in the old
foreign bucket are not recoverable.
