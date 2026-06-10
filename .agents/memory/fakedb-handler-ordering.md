---
name: fakeUserDb handler ordering
description: In __tests__/support/fakeUserDb.ts, a broad table-name regex guard silently swallows later handlers for the same table.
---

The in-memory SQL stand-in `__tests__/support/fakeUserDb.ts` dispatches by
running regexes over the SQL text in order; the first matching `if` block wins
and returns. Two different features can issue SQL against the **same table**
(e.g. `community_notifications`: the scheduled cleanup sweep vs. the in-app
inbox). A guard written as just `/community_notifications/i.test(sql)` matches
*every* statement against that table, so any handler placed after it for the
same table is dead code.

**Why:** this actually shipped broken via a merge. The cleanup handler
(`created_at < $1` COUNT/DELETE) was guarded only by the table name and sat
above the inbox handler, so notify INSERTs and read COUNT/UPDATE/list queries
hit the cleanup block and no-op'd. Every notify test failed with "0 rows".

**How to apply:** when two handlers touch the same table, make the earlier
guard discriminate on a clause unique to its query shape (the cleanup guard is
now `&& /created_at\s*<\s*\$1/i.test(sql)`), not just the table name. When
adding a handler for a table that already has one, check whether an existing
broad guard above it will shadow yours. Also note esbuild/tsx strips types
without type-checking, so duplicate object-literal keys or duplicate `let`
declarations only surface as runtime SyntaxErrors, not compile errors.
