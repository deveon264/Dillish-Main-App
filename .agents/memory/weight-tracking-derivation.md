---
name: Weight tracking derivation
description: How current/start weight are computed for the Progress + Profile tabs, and why logs are decoupled from profile.
---

# Weight tracking is log-driven, not profile-mutating

`addWeight`/`removeWeight` only insert/filter `weightLogs` (kept sorted desc by `ts`); they do **not** write `profile.weight`/`profile.startWeight`.

Display values are derived from the logs wherever shown:
- `current` = latest log by `ts`, fallback `profile.weight`
- `start` = earliest log by `ts` when logs exist, else `profile.startWeight` (then `current`)

**Why:** earlier attempts that mutated `profile` from log add/remove produced three bugs — backdated entries became "current", removal left stale profile values, and deleting all logs couldn't cleanly revert to the onboarding baseline. Decoupling removes all three at the root and lets `profile.*` stay the onboarding/manual baseline.

**How to apply:** Any screen that displays weight (currently `app/(tabs)/progress.tsx` and `app/(tabs)/profile.tsx`) must use the same logs-first derivation so they stay in sync. Don't reintroduce profile mutation in the weight log handlers. If a future feature (e.g. BMI) needs latest weight, derive it from `weightLogs` too.

Date entry: `parseDateInput` strictly validates (numeric-only tokens, year >= 1900, calendar round-trip to reject rollovers like 31/02). `logWeight` rejects invalid weight/date with an inline error instead of silently substituting `Date.now()`.
