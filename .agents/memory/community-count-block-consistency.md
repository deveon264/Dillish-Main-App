---
name: Community feed count / block consistency
description: The viewer-block filter must be applied identically across the feed counts, the comment list, and toggleLike's count, or header totals drift or flicker.
---

# Community engagement counts must share one block filter

The member feed/detail header shows `like_count` and `comment_count`. Three
places compute viewer-facing engagement and **must all apply two filters in
lockstep**: the per-viewer `community_blocks` (viewer-blocked author) filter AND
the global `community_admin_blocks` filter (members an admin blocked, hidden from
everyone). Or they disagree:

1. `POST_SELECT` in `lib/communityStore.ts` (the feed `listPosts` + `getPost`):
   both count subqueries exclude likes/comments whose author the viewer (`$1`)
   has blocked OR who is admin-blocked.
2. `listComments` (the comment list): hides comments from both blocked and
   admin-blocked members.
3. `toggleLike`'s returned `COUNT` (filtered by `$2 = userId`): also excludes
   admin-blocked likers.

The admin-block (`NOT EXISTS community_admin_blocks ab WHERE ab.user_id = ...`)
parallels the viewer-block clause but takes no viewer param: it is global. Posts,
comments, and likes from an admin-blocked member are all hidden from everyone.

**Why:** the comment list always hid blocked members, but the counts did not, so
a viewer who had blocked someone saw a header count higher than the comments they
could actually see. Separately, the client reconciles `likeCount` *directly* from
`toggleLike`'s response (app/(tabs)/community.tsx, app/community/[id].tsx), so if
the feed `like_count` is filtered but `toggleLike`'s count is not (or vice-versa),
tapping like makes the number jump to a different total. Filtering the like count
*requires* filtering toggleLike too; they are a pair.

**How to apply:** if you touch any one of these count queries, update all of them
in lockstep. The `community_blocks` PK is `(blocker_id, blocked_id)`, so the
`NOT EXISTS` probe is an index lookup (cheap).

**Intentionally NOT filtered:** the admin report queue (`listReports`) keeps raw
counts. Its `viewerId` only drives `liked_by_me`; an admin must see true
engagement, not their own personal-block-filtered view.

**Known adjacent gap (separate decision):** `listNotifications` does not exclude
actors the recipient has blocked, so a blocked member's like/comment can still
generate an inbox notification. Out of scope for the count fix.

**Test mirror:** `__tests__/support/fakeUserDb.ts` has a `POST_SELECT` feed
handler that must sit *before* the broad `community_likes` / `community_comments`
/ `community_admin_blocks` table-name guards (POST_SELECT names all three), keyed
on `FROM community_posts p` + `liked_by_me`. Viewer blocks are seeded via
`seedCommunityBlock`.
