# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Makers hear about saves, comments, replies and review results, in a header bell and, for the moments that matter, by email. The admin gets an email for everything that enters the review queue.

**Architecture:**
- A new migration wraps `public.tg_api`, the repo's pattern. After the previous `tg_api` succeeds, it writes bell rows to `tg_notifications` and email jobs to `tg_email_outbox`, inside a `begin … exception when others` block so notifying can never fail the user's action.
- An Edge Function `notify-send`, run by a Supabase Cron job every 5 minutes:
  - claims outbox rows through service-role-only RPCs;
  - queues the weekly roundup when it's due;
  - sends through Resend.
- Pure helpers live in `supabase/functions/_shared/notify.mjs` and are tested from Node: rendering, unsubscribe token signing, and the drain loop with injected dependencies.
- A second function, `unsubscribe`, flips the preference from a signed link.
- In the UI, a `NotificationBell` component is added to the headers, and a switch goes in Settings. Both render only when `cloudMode` is true.

**Tech Stack:** Supabase Postgres (plpgsql), Supabase Edge Functions (Deno, `npm:` imports), Resend REST API (`POST https://api.resend.com/emails`), Next.js 16 / React 19, `node:test` + PGlite.

**Spec:** `docs/superpowers/specs/2026-11-04-notifications-design.md`

## Global Constraints

- **Wording:** the site's word for likes is **save**. Save notifications are anonymous: "Someone saved *X*" / "N people saved *X*". `actor_id` is never exposed for saves.
- **No self-notifications:** nothing for your own save, comment, or reply on your own thread or work.
- **Failure isolation:** notification and outbox writes must never make `save`, `comment`, `submit`, `works/update` or `studio/product` fail. Sending happens only in `notify-send`, never inside a user request.
- **Email preference:** maker emails go only to a confirmed auth email (`auth.users.email_confirmed_at is not null`) and only when `tg_profiles.email_updates` is true (default true).
  - Admin emails ignore `email_updates` and go to the `ADMIN_EMAIL` secret, default `hello@tadgobble.in`.
- **Sender:** `Gobble at tadgobble <notifications@tadgobble.in>`, reply-to `hello@tadgobble.in`. Every maker email carries an unsubscribe link plus `List-Unsubscribe: <url>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers.
- **Secrets:** `RESEND_API_KEY`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET` and `ADMIN_EMAIL` exist only as Supabase secrets. Never read `.env` files.
- **Hosted build only:** in local SQLite mode (`cloudMode === false` from `lib/client-api.mjs`), the bell and the switch render nothing. Don't touch `lib/api.mjs` or `lib/db.mjs`.
- **Migrations:** must run in PGlite (`tests/cloud.test.mjs` loads every migration). No `create extension` and no `cron.schedule` in migrations. The cron job is a dashboard hand-off step.
- **Never run** `supabase db push`, function deploys or `npm run deploy:hosting`. The user does these.
- **Motion:** honour `prefers-reduced-motion`, keep animations at about 0.5s or less, and no hover-only behaviour on touch.
- **No real user data** in tests, fixtures or screenshots.
- **Git:** commit messages carry no Claude attribution, and every commit is pushed to `origin main` right away.

## Review Focus

1. **A save that's undone and redone, or two people saving the same work.** Re-saving must not add a second notification. Two different people saving must merge into one unread item with count 2. *(Tests in Task 1.)*
2. **A comment that's deleted.** Its bell item disappears, and its unsent email is not sent. *(`comment_id … on delete cascade` plus an outbox `comment_id` check, Task 1 and Task 3.)*
3. **A maker who turned emails off, or never confirmed their email.** They get no email; the outbox row is marked `skipped`, not retried forever. *(Task 3.)*
4. **Resend down or returning 4xx/5xx.** The row stays unsent with `attempts+1` and `last_error`. After 5 attempts it stops being claimed. *(Task 4 drain test.)*
5. **Forged access.** Anonymous or other users can't read someone's notifications, can't call the outbox/roundup/unsubscribe RPCs, and can't read the new tables directly. *(Tests in Task 1 and Task 3.)*

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/202611040013_notifications.sql` | Tables, profile columns, the `tg_api` wrapper with notification hooks, the new routes, and the service-role RPCs |
| `supabase/functions/_shared/notify.mjs` | `renderEmail`, `signUnsubscribe`, `verifyUnsubscribe` and `drainOutbox`: pure and testable from Node |
| `supabase/functions/notify-send/index.ts` | Cron entrypoint: checks `x-cron-secret`, queues the roundup, drains through Resend |
| `supabase/functions/unsubscribe/index.ts` | GET/POST one-click unsubscribe |
| `supabase/config.toml` | `verify_jwt = false` for both new functions |
| `lib/notifications.mjs` | `notificationText(item)` and `timeAgo(iso, now)` |
| `components/notification-bell.jsx` | Bell, badge and panel |
| `app/notifications.css` | Bell styles, imported where the other CSS files are imported |
| `components/platform.jsx`, `components/launch.jsx`, `components/creator-pages.jsx` | Mount the bell, and the Settings switch |
| `components/legal.jsx` | Privacy line about notification emails |
| `docs/NOTIFICATIONS.md` | Hand-off: Resend key, secrets, cron job, deploy |
| `tests/cloud.test.mjs`, `tests/notify.test.mjs`, `tests/notifications-ui.test.mjs` | Tests |

---

### Task 1: Bell data (tables, save/comment/reply hooks, list and read routes)

**Files:**
- Create: `supabase/migrations/202611040013_notifications.sql`
- Modify: `tests/cloud.test.mjs`
  - Add `email_confirmed_at timestamptz` to the fake `auth.users` in `before()`, and set it to `now()` for all three seeded users.
  - Add the tests below.

**Interfaces:**
- **Produces, tables:**
  - `public.tg_notifications(id uuid pk, recipient_id uuid not null → tg_profiles on delete cascade, kind text check in ('save','comment','reply','review'), product_id text → tg_products on delete cascade, comment_id uuid null → tg_comments on delete cascade, actor_id uuid null → tg_profiles on delete set null, preview text not null default '', count int not null default 1, created_at timestamptz default now(), read_at timestamptz)`
    - Index on `(recipient_id, created_at desc)`.
  - `tg_private.save_seen(user_id uuid, product_id text, primary key(user_id, product_id))`, with both FKs cascading.
  - RLS is enabled on both public tables, with no grants to `anon`/`authenticated`, the same as the other tables (see `202610210003_explicit_grants.sql`).
- **Produces, routes:**
  - `notifications` returns `{ items: [{ id, kind, count, preview, created_at, read: boolean, product: { slug, name }, actor: { name } | null }], unread: number }`.
    - Newest 30 items. `actor` is always `null` for `kind='save'`.
    - `review` items also carry `outcome: 'approved' | 'changes' | 'rejected'`, which Task 2 stores in `preview` as JSON. Keep `preview` as text and let Task 2 decide.
  - `notifications/read` sets `read_at=now()` on all the caller's unread items and returns `{ ok: true }`.
  - Both routes raise `Sign in to continue.` when signed out.
- **Produces, function:** `tg_private.notify(recipient uuid, kind text, product text, comment uuid, actor uuid, preview text) returns uuid`.
  - Returns the notification id, or null when skipped.
  - Skips when `recipient` is null or `recipient = actor`.
  - Task 2 reuses it.

- [ ] **Step 1: Write the failing tests** in `tests/cloud.test.mjs`.

  Publish a product owned by `other` using the existing helpers in that file. Approve it via `studio/product` `{action:'verify'}` as `owner`, then:

```js
test('saves notify the owner anonymously, merge while unread, and never repeat', async () => {
  await api(maker, 'save', { productId: id });            // first save
  await api(maker, 'save', { productId: id });            // unsave
  await api(maker, 'save', { productId: id });            // re-save: no new notification
  await api(owner, 'save', { productId: id });            // second person
  await api(other, 'save', { productId: id });            // own work: nothing
  const { items, unread } = await api(other, 'notifications');
  const saves = items.filter((n) => n.kind === 'save');
  assert.equal(saves.length, 1);
  assert.equal(saves[0].count, 2);
  assert.equal(saves[0].actor, null);
  assert.equal(unread, 1);
  await api(other, 'notifications/read');
  assert.equal((await api(other, 'notifications')).unread, 0);
});

test('comments notify the owner; replies notify the thread starter and owner once each', async () => {
  await api(maker, 'comment', { productId: id, body: 'Lovely colours' });
  let mine = (await api(other, 'notifications')).items.filter((n) => n.kind === 'comment');
  assert.equal(mine.length, 1);
  assert.match(mine[0].preview, /Lovely colours/);
  assert.equal(mine[0].actor.name, 'Maker');
  const top = /* id of maker's comment, read from api(null, 'products/<slug>').comments */;
  await api(owner, 'comment', { productId: id, parentId: top, body: 'Agreed!' });
  assert.equal((await api(maker, 'notifications')).items.filter((n) => n.kind === 'reply').length, 1);
  assert.equal((await api(other, 'notifications')).items.filter((n) => n.kind === 'reply').length, 1);
  await api(maker, 'comment', { productId: id, parentId: top, body: 'Thanks' }); // maker replying in own thread
  assert.equal((await api(maker, 'notifications')).items.filter((n) => n.kind === 'reply').length, 1);
  await api(maker, 'comment/delete', { id: top });
  // deleting the top comment cascades its notification away
  assert.equal((await api(other, 'notifications')).items.filter((n) => n.kind === 'comment').length, 0);
});

test('notifications are private', async () => {
  await assert.rejects(api(null, 'notifications'), /Sign in/);
  // raw table closed:
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [maker]);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from public.tg_notifications'));
  await db.exec('reset role');
});
```

  A rule for the delete case: when the top comment has replies, `comment/delete` keeps it as a removed placeholder, so the row isn't deleted and the cascade doesn't fire. The wrapper must therefore also delete notifications whose `comment_id` is now `removed`. Test it with a top comment that has a reply.

- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `node --test tests/cloud.test.mjs`
  - Expected: the new tests FAIL with `Unknown route` or similar, or the relation doesn't exist. The existing tests still pass.

- [ ] **Step 3: Implement the migration.**
  - Rename the current `tg_api` to `tg_api_before_notifications`, revoke it from public/anon/authenticated, and create the new wrapper (copy the shape of `202610240011_comment_replies.sql`).
  - The wrapper handles `notifications` and `notifications/read` itself.
  - For every other route it calls the previous function first, then runs hooks inside `begin … exception when others then null; end`:
    - **`save`** when the result is `saved=true`:
      - Insert into `save_seen` with `on conflict do nothing`. Notify only when a row was inserted.
      - If the owner has an unread `save` item for this product, increment `count` and bump `created_at`. Otherwise insert one with `actor_id` null.
    - **`comment` without `parentId`:** `notify(owner, 'comment', product, newComment, uid, left(body, 140))`.
    - **`comment` with `parentId`:**
      - Resolve the top comment the same way the replies migration does.
      - `notify(topAuthor, 'reply', …)`.
      - If the owner differs from both `uid` and `topAuthor`, also `notify(owner, 'reply', …)`.
    - **`comment/delete`:** delete notifications whose comment is now `removed`.
  - Find the new comment's id as the caller's newest comment on that product.
  - Grant execute on the new `tg_api` to anon and authenticated, the same as before.

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `node --test tests/cloud.test.mjs`
  - Expected: all PASS.

- [ ] **Step 5: Commit and push.**

```bash
git add supabase/migrations/202611040013_notifications.sql tests/cloud.test.mjs
git commit -m "Tell makers when their work is saved, commented on or replied to"
git push origin main
```

---

### Task 2: Review results, admin queue emails, email preference

**Files:**
- Modify: `supabase/migrations/202611040013_notifications.sql`. It isn't pushed yet, so editing it is fine.
- Modify: `tests/cloud.test.mjs`

**Interfaces:**
- **Consumes:** `tg_private.notify(...)` from Task 1.
- **Produces, table:** `public.tg_email_outbox`, with RLS on and no grants:
  - `id uuid pk`
  - `kind text check in ('first_save','comment','review','admin_queue','roundup')`
  - `recipient_id uuid null → tg_profiles on delete cascade` (null means the admin)
  - `product_id text null → tg_products on delete cascade`
  - `comment_id uuid null → tg_comments on delete cascade`
  - `data jsonb not null default '{}'`
  - `created_at`, `sent_at timestamptz`, `status text default 'queued' check in ('queued','sent','skipped','failed')`
  - `attempts int default 0`, `last_error text`
- **Produces, columns on `tg_profiles`:** `email_updates boolean not null default true` and `first_save_emailed boolean not null default false`.
- **Produces, routes:**
  - `email-prefs` returns `{ emailUpdates: boolean }`.
  - `email-prefs/save` takes `{ emailUpdates: boolean }` and returns `{ emailUpdates }`.
  - Both raise `Sign in to continue.` when signed out.
- **Produces, outbox rows:**

| Moment | Outbox row |
|---|---|
| First save the owner has ever received, on any work | `first_save` for the owner, `data {}`; sets `first_save_emailed=true`. Only once per owner, ever. |
| Top-level comment (not reply) by someone else | `comment` for the owner, with `comment_id` and `data { actor: name, preview }` |
| `studio/product` with `verify`/`changes`/`reject`, for a first submission or a pending edit | Bell `review` item for the owner, plus a `review` outbox row with `data { outcome: 'approved'\|'changes'\|'rejected', note, edit: boolean }` |
| `submit` succeeds (new, or a resubmission of `needs_changes`) | `admin_queue`, `recipient_id` null, `data { what: 'new'\|'resubmission', name, maker }` |
| `works/update` returns `live:true` | `admin_queue`, `data { what: 'edit', name, maker }` |

  For a review item, `preview` holds the outcome word (`approved`, `changes` or `rejected`) and `notifications` exposes it as `outcome`. Update the Task 1 list route accordingly.

  Products where `owner_id` is null get no maker rows.

- [ ] **Step 1: Write the failing tests.** Read the outbox as superuser with plain `db.query` and no role switch:

```js
test('first save emails the owner exactly once across all their work', async () => {
  // two published products owned by `other`; saves from maker on both, from owner on one
  const rows = (await db.query("select * from tg_email_outbox where kind='first_save' and recipient_id=$1", [other])).rows;
  assert.equal(rows.length, 1);
});
test('top-level comments queue an email, replies do not', async () => { /* comment + reply, expect 1 'comment' row */ });
test('review outcomes reach the maker for submissions and edits', async () => {
  // submit as other → admin_queue row (what:'new'); studio/product changes w/ feedback → bell review outcome 'changes' + outbox review note
  // resubmit → admin_queue (what:'resubmission'); verify → outcome 'approved'
  // works/update on published → admin_queue (what:'edit'); studio/product reject → outcome 'rejected', data.edit === true
});
test('email preference is private and defaults on', async () => {
  assert.deepEqual(await api(other, 'email-prefs'), { emailUpdates: true });
  assert.deepEqual(await api(other, 'email-prefs/save', { emailUpdates: false }), { emailUpdates: false });
  await assert.rejects(api(null, 'email-prefs'), /Sign in/);
});
test('a broken notify hook never fails the user action', async () => {
  // as superuser: alter table tg_email_outbox add constraint t_break check (false) not valid;
  // then a top-level comment still returns { ok: true }; drop the constraint afterwards
});
```

- [ ] **Step 2: Run and confirm they fail.**
  - Run: `node --test tests/cloud.test.mjs`
  - Expected: the new tests FAIL. The Task 1 tests still pass.

- [ ] **Step 3: Implement the changes in the migration.**
  - Add the hooks to the wrapper's hook block.
  - For `studio/product`: read the product row and its `pending_edit` before calling the previous function, so an edit review is recognisable, and only act when `payload->>'action' in ('verify','changes','reject')`. Map `verify` to `approved` and `reject` to `rejected`, and take `note` from the product's `review_note` after the call.
  - For `submit`, a resubmission is when the payload has an existing id whose status was `needs_changes` before the call.

- [ ] **Step 4: Run and confirm they pass.**
  - Run: `node --test tests/cloud.test.mjs`
  - Expected: all PASS.

- [ ] **Step 5: Commit and push.**
  - Commit message: `Queue emails for review results, first saves, comments and the review queue`.

---

### Task 3: Service-role RPCs for sending, the roundup and unsubscribing

**Files:**
- Modify: `supabase/migrations/202611040013_notifications.sql`
- Modify: `tests/cloud.test.mjs`

**Interfaces:**
- **Produces.** All are `security definer`, `set search_path=''`, revoked from public/anon/authenticated and granted to `service_role` only:
  - `public.tg_outbox_claim(max_rows int default 20) returns jsonb`
    - Returns an array of `{ id, kind, to, name, product: { slug, name } | null, data }`.
    - Selects `status='queued' and attempts<5`, oldest first, with `for update skip locked`, and increments `attempts`.
    - For a maker row whose recipient has `email_updates=false`, no confirmed email, or whose `comment_id` comment is now removed or gone: set `status='skipped'` and leave it out of the result.
    - `to` is null for admin rows; the function fills in `ADMIN_EMAIL`.
  - `public.tg_outbox_done(row_id uuid, error text default null) returns void`
    - With null error: `status='sent', sent_at=now()`.
    - Otherwise it sets `last_error`. When `attempts>=5` it also sets `status='failed'`.
  - `public.tg_roundup_queue(at timestamptz default now()) returns int`
    - Queues one `roundup` row per maker who has `email_updates` on and any `save`/`comment`/`reply` notifications in `[at - 7 days, at)`.
    - `data { saves, comments, replies, works: [{ slug, name, saves, comments, replies }] }`.
    - Runs only when `at` in `Asia/Kolkata` is a Sunday at or after 09:00, and the ISO week key (`to_char(at at time zone 'Asia/Kolkata','IYYY-IW')`) differs from `tg_settings` key `roundup_week`. It then stores the key.
    - Returns the number of rows queued, or 0 when not due.
  - `public.tg_unsubscribe(user_id uuid) returns void` sets `email_updates=false`.
- **Test helper:** add `async function service(sql, params)`, which runs `set role service_role`, runs the query, then `reset role`.

- [ ] **Step 1: Write the failing tests.**

```js
test('outbox claim skips opted-out, unconfirmed and removed-comment rows', async () => { /* … expect status 'skipped' */ });
test('outbox claim and done retry up to five times then fail', async () => {
  // claim → done(id,'boom') ×5 → status 'failed', not claimed again
});
test('roundup queues once per IST week on Sunday morning only', async () => {
  // '2026-11-08 03:30:00+00' is Sun 09:00 IST → >0 rows; same call again → 0; '2026-11-07 10:00:00+00' (Saturday) → 0
});
test('service RPCs are closed to browser roles', async () => {
  for (const user of [null, maker])
    await assert.rejects(/* set role anon/authenticated */ db.query('select public.tg_outbox_claim(5)'));
});
```

- [ ] **Step 2: Run and confirm they fail.**
  - Run: `node --test tests/cloud.test.mjs`
  - Expected: FAIL, because the functions don't exist.

- [ ] **Step 3: Implement the four functions in the migration.**

- [ ] **Step 4: Run and confirm they pass.**
  - Run: `node --test tests/cloud.test.mjs`
  - Expected: all PASS.

- [ ] **Step 5: Commit and push.**
  - Commit message: `Add the outbox, roundup and unsubscribe database calls`.

---

### Task 4: Shared email helpers (render, sign, drain)

**Files:**
- Create: `supabase/functions/_shared/notify.mjs`, plain JS with Web Crypto only, so Deno and Node both run it.
- Create: `tests/notify.test.mjs`

**Interfaces:**
- **Produces:**
  - `renderEmail(row, { site: 'https://tadgobble.in', unsubscribeUrl: string|null }) → { subject, html, text }`
    - `row` is one element of `tg_outbox_claim`'s result.
    - `unsubscribeUrl` is null for admin rows.
  - `signUnsubscribe(userId: string, secret: string) → Promise<string>` returns the token `"<userId>.<base64url HMAC-SHA256(userId)>"`.
  - `verifyUnsubscribe(token: string, secret: string) → Promise<string|null>` returns the userId, or null for a bad or tampered token, compared in constant time.
  - `drainOutbox({ claim: () => Promise<row[]>, done: (id, error|null) => Promise<void>, send: (msg) => Promise<void>, render, unsubscribeUrlFor: (userId) => Promise<string>, adminEmail: string }) → Promise<{ sent: number, failed: number }>`
    - `msg` is `{ to, subject, html, text, headers }`.
    - Each row's failure is isolated.
    - Admin rows have no `List-Unsubscribe` headers.
- **Subjects (exact copy):**
  - `first_save`: `Someone saved your work 💜`
  - `comment`: `{actor} commented on {product}`
  - `review`, approved: `{product} is live on tadgobble`
  - `review`, changes: `A small change before {product} goes live`
  - `review`, rejected: `About {product}`
  - `roundup`: `Your week on tadgobble`
  - `admin_queue`: `New in the review queue: {name}`
  - When `data.edit` is true, the review subjects become: approved → `Your edit to {product} is live`, changes → `A small change to your edit of {product}`, rejected → `About your edit to {product}`.
- **Bodies:**
  - Cream `#fdf6e9` background, ink text, one button linking to `{site}/product/{slug}` (admin: `{site}/studio`).
  - Footer: `You're getting this because you post on tadgobble. Turn these off: {unsubscribeUrl} · Settings: {site}/settings`.
  - Escape all user text (actor names, previews, notes, product names) as HTML in `html`.
  - Bodies may use one light Hinglish touch, for example `Pehli baar? Perfect.` in `first_save`.

- [ ] **Step 1: Write the failing tests** in `tests/notify.test.mjs`:
  - `renderEmail escapes user text` (actor `<b>x</b>` never appears raw in the html);
  - one subject test per kind/outcome, with exact strings including the edit variants;
  - `admin email has no unsubscribe footer`;
  - `signed token round-trips and tampering fails`;
  - `drainOutbox isolates a failing send and marks it`: three rows where `send` throws on the second. Expect `done` calls `(id1,null)`, `(id2,<message>)`, `(id3,null)` and `{sent:2, failed:1}`;
  - `maker mail carries List-Unsubscribe headers, admin mail does not`.

- [ ] **Step 2: Run and confirm they fail.**
  - Run: `node --test tests/notify.test.mjs`
  - Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `supabase/functions/_shared/notify.mjs`.**

- [ ] **Step 4: Run and confirm they pass.**
  - Run: `node --test tests/notify.test.mjs`
  - Expected: PASS.

- [ ] **Step 5: Commit and push.**
  - Commit message: `Write the notification emails and the signed unsubscribe links`.

---

### Task 5: Edge functions and config

**Files:**
- Create: `supabase/functions/notify-send/index.ts`
- Create: `supabase/functions/unsubscribe/index.ts`
- Modify: `supabase/config.toml`
  - Add `[functions.notify-send]` with `verify_jwt = false`.
  - Add `[functions.unsubscribe]` with `verify_jwt = false`.

**Interfaces:**
- **Consumes:** Task 4's exports, imported as `../_shared/notify.mjs`; Task 3's RPCs.
- **`notify-send`:**
  - Accepts only `POST` with header `x-cron-secret` equal to `Deno.env.get('CRON_SECRET')`. Otherwise it returns 401.
  - Creates a service-role client, as in `legacy-login/index.ts`.
  - Calls `rpc('tg_roundup_queue')`, then runs `drainOutbox` with:
    - `claim` → `rpc('tg_outbox_claim', { max_rows: 20 })`;
    - `done` → `rpc('tg_outbox_done', { row_id, error })`;
    - `send` → `fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:'Bearer '+RESEND_API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ from, to:[to], reply_to:'hello@tadgobble.in', subject, html, text, headers }) })`, throwing on a non-2xx response with the response text;
    - `unsubscribeUrlFor` → `${SUPABASE_URL}/functions/v1/unsubscribe?t=${await signUnsubscribe(id, UNSUBSCRIBE_SECRET)}`.
  - Returns `{ queued, sent, failed }`.
- **`unsubscribe`:**
  - `POST` (one-click from mail clients) verifies `t`, calls `rpc('tg_unsubscribe', { user_id })` and returns 200.
  - `GET` does the same, then returns a tiny cream HTML page: `Done. Gobble will stop emailing you. You can turn emails back on in Settings.` with a link to `https://tadgobble.in/settings`.
  - A bad token returns 400 with a plain message.

- [ ] **Step 1: Write both functions and the config entries.** Deno code has no Node test harness here. The logic under test lives in Task 4, so these files stay thin.

- [ ] **Step 2: Verify.**
  - Run: `npm test`, then `git diff --stat`
  - Expected: all tests PASS, and only the three files listed above changed.
  - If `deno` is on the PATH, also run `deno check supabase/functions/notify-send/index.ts supabase/functions/unsubscribe/index.ts`, expecting no errors. If it isn't installed, say so in the ledger.

- [ ] **Step 3: Commit and push.**
  - Commit message: `Add the email sender and unsubscribe functions`.

---

### Task 6: The bell

**Files:**
- Create: `lib/notifications.mjs`
- Create: `components/notification-bell.jsx`
- Create: `app/notifications.css`
- Create: `tests/notifications-ui.test.mjs`
- Modify:
  - `components/platform.jsx`: inside `site-header`, next to the avatar when `user`.
  - `components/launch.jsx`: `launch-header` when signed in.
  - `components/creator-pages.jsx`: `creator-header` when signed in.
  - Wherever the other `app/*.css` files are imported (`app/layout.jsx`).

**Interfaces:**
- **Produces:**
  - `notificationText(item) → string`, with exact copy:
    - save, count 1: `Someone saved {product}`
    - save, count n: `{n} people saved {product}`
    - comment: `{actor} commented on {product}: "{preview}"`
    - reply: `{actor} replied to your comment on {product}`
    - review approved: `{product} is live!`
    - review changes: `{product} needs a small change`
    - review rejected: `{product} wasn't accepted`
  - `timeAgo(iso, now = Date.now()) → string`: `now`, `5m`, `3h`, `2d`, then `12 Oct` style.
  - `<NotificationBell />`, which takes no props:
    - Renders `null` unless `cloudMode`.
    - Loads `api('notifications')` on mount and on `visibilitychange` back to visible.
    - Shows a badge when `unread > 0`, capped at `9+`.
    - Clicking toggles a panel (use the existing `components/dropdown.jsx` if it fits) listing items as links to `/product/{slug}`, and calls `api('notifications/read')` when the panel opens.
    - Empty state: `Nothing yet. Post something and Gobble will tell you when people notice.`
    - Accessibility: a button with `aria-label` `Notifications` or `Notifications, N unread`, and the panel as `role="dialog"` or a list. Escape closes it.
    - Any badge or panel animation is 0.5s or less and turned off under `prefers-reduced-motion`.

- [ ] **Step 1: Write the failing tests** in `tests/notifications-ui.test.mjs`: one assertion per `notificationText` copy line above, plus `timeAgo` for 30s, 5m, 3h, 2d and 10 days.

- [ ] **Step 2: Run and confirm they fail.**
  - Run: `node --test tests/notifications-ui.test.mjs`
  - Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `lib/notifications.mjs`, the component, the CSS and the three mounts.** Use the existing cream design tokens; see `lib/design-tokens.mjs` and `app/globals.css`.

- [ ] **Step 4: Verify.**
  - Run: `npm test`, then `npm run build:hosting`
  - Expected: tests PASS and the hosting build succeeds.
  - Also check the local mode by eye: start `node node_modules/next/dist/bin/next dev --port 3100` and confirm no bell appears, because local mode isn't cloud. Then stop the server.

- [ ] **Step 5: Commit and push.**
  - Commit message: `Add the notification bell`.

---

### Task 7: Settings switch, privacy line, hand-off doc

**Files:**
- Modify: `components/creator-pages.jsx`. In `mode === 'settings'`, cloudMode only, add a switch labelled `Email me about my work`, with the hint `First saves, comments, review results and a weekly roundup.`
  - It reads `api('email-prefs')` and writes `api('email-prefs/save', { emailUpdates })`.
- Modify: `components/legal.jsx`. Add a privacy section `Emails we send` covering:
  - notification emails (first save, comments, review results, weekly roundup);
  - that they're sent through Resend, which receives your email address and the message for delivery;
  - that you can turn them off in Settings or with the link in any email.
- Create: `docs/NOTIFICATIONS.md`, the user's hand-off steps, verbatim and in order:
  1. Confirm `tadgobble.in` is **Verified** in Resend.
  2. Create an API key in Resend with "Sending access" for tadgobble.in.
  3. Run `supabase secrets set RESEND_API_KEY=… CRON_SECRET=<long random> UNSUBSCRIBE_SECRET=<long random> ADMIN_EMAIL=hello@tadgobble.in`.
  4. Run `supabase db push`.
  5. Run `supabase functions deploy notify-send unsubscribe`.
  6. In the Supabase Dashboard, go to Integrations, enable **Cron** and create a job:
     - name `notify-send`, every 5 minutes (`*/5 * * * *`);
     - type "Supabase Edge Function", POST to `notify-send`;
     - add the header `x-cron-secret: <CRON_SECRET>`.
     - Enabling Cron also asks to enable `pg_net`; accept it.
  7. Run `npm run deploy:hosting`.
  8. Test it: comment on your own test product from a second account, wait up to 5 minutes, and check the inbox.
- Test: none new. The copy is static, and the routes are covered in Task 2.

- [ ] **Step 1: Make the three changes.**

- [ ] **Step 2: Verify.**
  - Run: `npm test`, then `npm run build:hosting`
  - Expected: PASS, and the build succeeds.

- [ ] **Step 3: Commit and push.**
  - Commit message: `Add the email switch, the privacy note and the notification setup guide`.
