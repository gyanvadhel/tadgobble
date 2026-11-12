# Follow a Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in person follow a maker, so the maker hears about it and followers hear when that maker posts something new.

**Architecture:** One new Supabase migration adds a `tg_follows` table and wraps `public.tg_api` again, following the existing wrapper pattern (`tg_api_before_notifications`, `tg_api_before_instant`). It adds a `follow` route, puts follower counts on the profile route, and adds bell items of two new kinds, `follow` and `new_work`. The local SQLite server gets the same route and profile fields so the demo and e2e tests work, but no bell, as today. The UI is a Follow button on profile pages.

**Tech Stack:** Next.js 16 App Router (client components), Supabase Postgres (plpgsql `tg_api`), local SQLite (`lib/db.mjs`, `lib/api.mjs`), node:test plus PGlite for SQL tests.

**Spec:** None written. The source is the conversation of 2026-11-12: "Follow a maker: a button on profiles and posts; when someone you follow posts, it shows in your bell." The rulings below are my calls.

## Decisions (my calls, change any)

- **Where the button goes:** v1 puts it on the profile page only. The product-page button is a later follow-up, because the product page is in the 1,100+ line `platform.jsx`.
- **Telling followers:** they get a bell item only, no email per post. Emailing followers is better as part of the weekly "new this week" email (idea #2), so posting never spams anyone.
- **Telling the maker:** they get a bell item ("Asha started following you") the first time each person follows them. Unfollowing and following again stays quiet, the same way `save_seen` works.
- **Who can be followed:** visible profiles only (`tg_profiles.visible`). You can't follow yourself, and works posted on someone else's behalf (`onBehalf`) don't notify followers.
- **What's public:** the follower count is public. Who follows whom is not exposed by any route.
- **Rate limit:** 60 follow toggles per person per hour, through `tg_private.rate`.

## Global Constraints

- Never run `supabase db push` or function deploys. The user does that.
- The migration file is named `supabase/migrations/202611120015_follows.sql`. It must apply cleanly after `202611060014_instant_posting.sql`.
- Hooks must never fail the action that caused them. Wrap them in `begin … exception when others then null; end;` as the notifications migration does.
- New tables have RLS enabled, all access revoked from `public, anon, authenticated`, and access granted to `service_role` only.
- No real user data in tests. Use the fixed UUIDs already in `tests/cloud.test.mjs`.
- Commits have no attribution lines. Push to origin main after each commit.

## Review Focus

1. **Following a hidden profile, or one that doesn't exist:** it must error ("This profile is unavailable."), not create a row.
2. **A signed-out follow call:** it must error ("Sign in to continue.").
3. **Following, unfollowing and following again:** the maker gets exactly one `follow` bell item.
4. **A `new_work` item whose work was later taken down:** it must not appear in the follower's bell. The bell query should only show `new_work` for published works.
5. **The bell's existing inner join on products:** `follow` items have no product, so the notifications route must use a left join, or follow items silently disappear.

---

### Task 1: Database follows, route, profile counts and bell items (Supabase)

**Files:**
- Create: `supabase/migrations/202611120015_follows.sql`
- Test: `tests/cloud.test.mjs` (append cases)

**Interfaces:**
- Produces:
  - route `follow`, payload `{ username: string }`. It toggles, then returns `{ following: boolean, followers: number }`.
  - route `profiles/<username>`: the existing result plus `followers: number` and `following: boolean` (false when signed out).
  - route `notifications`: items may now have `kind: 'follow'` (product null; actor `{ name, username }`) or `kind: 'new_work'` (product `{ slug, name }`; actor `{ name, username }`).

- [ ] **Step 1: Write the failing PGlite tests** in `tests/cloud.test.mjs`, using the file's existing helpers for calling `tg_api` as a given user:
  - `follow toggles and reports the follower count`: `other` follows `maker`'s username, which returns `{following:true, followers:1}`. Calling it again returns `{following:false, followers:0}`.
  - `profile shows followers and whether you follow`: after `other` follows, `profiles/<maker username>` as `other` has `followers === 1` and `following === true`, and signed out it has `following === false`.
  - `cannot follow yourself, a hidden profile, or while signed out`: each raises, and `tg_follows` stays empty.
  - `the maker hears about a follower once`: follow, unfollow, follow again. `maker`'s `notifications` has exactly one item with `kind === 'follow'` and `actor.name` set.
  - `followers hear when the maker posts`: `other` follows `maker`, then `maker` calls `submit`. `other`'s notifications contain `kind === 'new_work'` with the new product's slug. After an admin takes it down, the item is gone from the list.
- [ ] **Step 2: Run** `node --test tests/cloud.test.mjs`. Expected: the new tests FAIL (unknown route or missing fields). The existing tests still pass.
- [ ] **Step 3: Write the migration:**
  - `public.tg_follows(follower_id uuid references tg_profiles on delete cascade, maker_id uuid references tg_profiles on delete cascade, created_at timestamptz default now(), primary key(follower_id, maker_id), check (follower_id <> maker_id))`, with an index on `maker_id`.
  - `tg_private.follow_seen(follower_id, maker_id)` with the same shape, without `created_at`.
  - Drop and re-add the `tg_notifications.kind` check, allowing `'save','comment','reply','review','follow','new_work'`.
  - Rename `tg_api` to `tg_api_before_follows`, then create the new `tg_api`:
    - Handle `follow` itself: sign-in check, rate limit, look up the visible profile by `lower(username)`, refuse yourself, toggle, and on first follow insert into `follow_seen` and call `tg_private.notify(maker,'follow',null,null,uid,'')`.
    - Handle `notifications` itself, as the old query but with a left join on products, actor `{name, username}` for every kind except `save`, and excluding `new_work` rows whose product isn't `published`.
    - For everything else, call the previous function. Then, after `profiles/%`, add `followers` and `following`. After `submit`, when the new product is published and not `onBehalf`, insert one `new_work` notification per follower, with `actor_id` set to the maker.
  - Repeat the revoke and grant lines from the end of the instant-posting migration.
- [ ] **Step 4: Run** `node --test tests/cloud.test.mjs`. Expected: everything passes.
- [ ] **Step 5: Commit** with the message "Follow a maker: follows table, follow route, follower counts, follow and new-work bell items", then push.

### Task 2: Bell text and links

**Files:**
- Modify: `lib/notifications.mjs` (`notificationText`), `components/notification-bell.jsx` (the link for each item)
- Test: `tests/notifications-ui.test.mjs`

**Interfaces:**
- Consumes: the item shapes from Task 1.

- [ ] **Step 1: Add failing tests:**
  - `notificationText({kind:'follow', actor:{name:'Asha'}})` returns `'Asha started following you'`.
  - `notificationText({kind:'new_work', actor:{name:'Asha'}, product:{name:'Moon Garden'}})` returns `'Asha posted something new: Moon Garden'`.
  - Without an actor, both fall back to `'Someone'`.
- [ ] **Step 2: Run** `node --test tests/notifications-ui.test.mjs`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the two new `case`s. In the bell, a `follow` item links to `/profile/<actor.username>` (with no link if the username is null), and `new_work` uses the existing product link.
- [ ] **Step 4: Run** the same test file. Expected: PASS. Then run `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** with the message "Bell: follow and new-work items", then push.

### Task 3: Local demo server parity

**Files:**
- Modify: `lib/db.mjs` (schema), `lib/api.mjs` (`follow` route, `profiles/` response, account delete cleanup)
- Test: `tests/creators.test.mjs`

**Interfaces:**
- Produces: the same `follow` route and profile fields as Task 1, with no notifications locally.

- [ ] **Step 1: Add failing tests:** follow toggles and returns counts, the profile shows `followers` and `following`, you can't follow yourself, and deleting an account removes its follows.
- [ ] **Step 2: Run** `node --test tests/creators.test.mjs`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement:**
  - Add `CREATE TABLE IF NOT EXISTS follows (follower_id TEXT NOT NULL REFERENCES users(id), maker_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, PRIMARY KEY (follower_id, maker_id))`.
  - Add the `follow` route, rate-limited like the other routes.
  - Add the fields to the `profiles/` response.
  - Make `account/delete` delete the user's follows in both directions.
- [ ] **Step 4: Run** the test file, then `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** with the message "Local server: follow route and follower counts", then push.

### Task 4: Follow button on profiles

**Files:**
- Create: `components/follow-button.jsx`
- Modify: `components/creator-pages.jsx` (the `creator-intro-actions` block near line 291), plus a stylesheet: `app/creators.css`
- Test: `scripts/launch-e2e.mjs` or the creators e2e, whichever already opens a profile

**Interfaces:**
- Consumes: the `follow` route and the profile's `followers` and `following`.
- Produces: `FollowButton({ username, initialFollowing, initialFollowers, signedIn })`.

- [ ] **Step 1: Add a failing e2e step:**
  - Signed in as a seeded member, open another maker's profile, click **Follow**. The button reads **Following** and the count goes up by one.
  - Reload, and it's still **Following**.
  - Click again, and it's back to **Follow**.
  - On your own profile, there's no Follow button.
- [ ] **Step 2: Run that e2e script.** Expected: FAIL (no button).
- [ ] **Step 3: Implement the button:**
  - It's an optimistic toggle with `aria-pressed`. On error it rolls back and shows the message.
  - When signed out, clicking does what the save button does when signed out. Find that in `platform.jsx` and reuse it.
  - The count shows as "12 followers" next to the button.
  - Hide the button on your own profile.
  - Style it like the existing `creator-intro-actions` links, using the site palette.
- [ ] **Step 4: Run** the e2e script and `npm test`. Expected: both pass. Then take screenshots on desktop and phone, checking that the profile intro looks right in both.
- [ ] **Step 5: Commit** with the message "Follow button on maker profiles", then push.

## Afterwards (user)

- Run `supabase db push` to apply `202611120015_follows.sql`.
- Run `npm run deploy:hosting`.
- Follow-ups not in this plan:
  - a Follow button on product pages
  - followers included in the weekly email
  - "New" tags on Discover
