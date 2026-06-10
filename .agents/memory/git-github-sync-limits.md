---
name: GitHub sync limits for agents
description: Why the agent can't fix GitHub push/pull/ref issues on the main repl; only the user can (Shell or Git panel).
---

# GitHub sync from the agent: hard limits

**The agent cannot complete a GitHub push/pull, nor fix remote-tracking refs, on
the main repl.** Two independent walls:

1. **No GitHub credentials in the agent environment.** No credential helper, no
   `~/.git-credentials`, no GitHub connector (`listConnections` 401). An authed
   `git push` / authed fetch to `github.com/...` fails with "Password
   authentication is not supported." GitHub OAuth lives ONLY in Replit's Git
   panel, so any push/pull to GitHub must be a user action in that panel.

2. **Destructive git is blocked for the main agent, even inside an assigned
   Project Task.** `git remote prune`, `git fetch --prune`, `git update-ref -d`,
   `git branch -dr` all error: "Destructive git operations are not allowed in
   the main agent." Read-only is fine: `ls-remote`, plain `fetch` (no prune),
   `remote prune --dry-run`, `rev-parse`, `status`, `remote get-url`.

**Why routing to an isolated task agent does NOT help:** the platform merges
working-tree/commits back to the main repl, NOT `.git` refs/config. A task agent
pruning its own `origin/<branch>` or changing its remote URL changes nothing in
the main repl's `.git`.

**Therefore stale remote-tracking refs / remote-URL drift / "publish branch" on
the main repl can ONLY be fixed by the user:**
- Shell on the main repl (no agent guard there): `git fetch --prune origin` (or
  `git remote prune origin`) drops a stale `origin/<branch>`, then Push from the
  Git panel.
- Or Git panel: disconnect/reconnect GitHub (resets refs + credentials), then
  Publish/Push.

**Symptom pattern seen:** the Git panel flips between `UNKNOWN_REF` ("remote ref
of current branch is missing, publish your branch") and `PUSH_REJECTED` ("remote
has commits not in local"). Root cause: a stale `refs/remotes/origin/master`
pointing at an old commit after `origin` was silently repointed to a different /
empty GitHub repo. Pull looks for a branch not on the new remote; Push compares
against the stale ref. Authoritative diagnostics: `git ls-remote origin` and
`git remote get-url origin` (the remote URL itself can change between sessions,
e.g. Shape-by-Sendry -> empty Fitness-App-Dillish).
