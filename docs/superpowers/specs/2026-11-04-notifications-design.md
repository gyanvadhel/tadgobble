# Notifications design

## Why

tadgobble is a home for first-time makers. The best thing that can happen to a first-timer is finding out that someone saved or commented on what they posted. Right now nobody finds out unless they go looking. The admin (Gyan) also has to open Studio to see whether anything new was submitted.

Notifications close both gaps. Makers hear about reactions on the site and, for the moments that matter, by email. The admin gets an email for every new submission.

**Success:** a maker who posts their first thing gets told when someone saves it, and comes back. The admin reviews a submission the same day it arrives without having to check Studio.

## Goals

1. An in-site notification list for signed-in makers: a bell in the header with an unread count.
2. Email to makers for the moments that matter:
   - the first save their work ever gets;
   - every new comment on their work;
   - a weekly roundup.
3. An email to the admin for every new submission.
4. Makers can turn emails off: a one-click link in every email, plus a setting.

## Non-goals

- Phone or browser push notifications.
- Real-time updates (live sockets). The bell refreshes on page load and when the tab regains focus.
- Email when someone signs up. New sign-ups appear only in the admin's weekly numbers, if anywhere.
- Notifications about follows, mentions or anything else that doesn't exist in the product today.

## Anti-goals (a failure even if it works)

- **Spammy.** A maker should never get one email per save. If an email feels noisy, cut it.
- **Telling you about yourself.** No notification of any kind for your own action: saving your own work, commenting on it, or replying to yourself.
- **Leaking private things.** No email addresses in notifications, nothing about unpublished work to anyone but its owner and the admin, and no notification revealing who saved something if the site doesn't already show that publicly. Saves are private on the site today, so save notifications are anonymous: "Someone saved *X*", or "3 people saved *X*".
- **Landing in spam.** Emails must pass SPF and DKIM for tadgobble.in, carry an unsubscribe link and `List-Unsubscribe` headers, and come from a stable sender.
- **Breaking existing flows.** A failure to notify or email must never make a save, comment or submission fail.

## What triggers what

The site calls likes **saves** (`tg_saves`); this design uses that word.

| Event | In-site (bell) | Email | Who |
|---|---|---|---|
| Someone saves your published work | yes; several saves on one work, unread, merge into one item ("3 people saved *X*") | only the first save your work has ever received, across all your work | maker (product owner) |
| Someone comments on your work | yes | yes, each one | maker |
| Someone replies to your comment | yes | no, it's in the roundup | comment author *(my call: replies are where conversations happen; emailing each one would get noisy)* |
| Your submission is approved, sent back for changes, or rejected | yes | yes, with the review note for changes or rejections | maker *(my call: this is the "submitted" moment from the maker's side, and the review flow already stores the note)* |
| Weekly roundup | no | once a week, only if something happened that week: saves, comments, replies | maker |
| Someone submits new work or an edit to published work | no | yes, each one, to hello@tadgobble.in | admin |

**Replies (my call):**
- Threads are one level deep, and the client always sends the thread's top comment as `parentId`.
- A reply notifies the author of that top comment in the bell.
- If the reply is on someone else's work, it also notifies the work's owner in the bell.
- The "email for each comment" rule covers top-level comments only. Replies reach email only through the weekly roundup.
- Nobody is notified twice for one reply.
- The comment UI doesn't change.

**Edits and resubmissions (my call):**
- Anything that enters the review queue emails the admin: a new submission, a resubmission after "needs changes", or an edit to published work.
- The outcome of reviewing an edit (approve, send back, reject) notifies the maker exactly like a first submission's outcome.
- Edit outcomes don't change `tg_products.status` (they use `pending_edit`, migration 202610210010). So hook the review route, or the `pending_edit`/`review_note` changes, rather than relying only on a status trigger.

A save that is undone and redone by the same person must not notify twice. Saves are de-duplicated per (person, work).

Work posted "on behalf of" another creator (`submission_details.onBehalf`) notifies the account that posted it, which is `owner_id`.

## The bell (in-site)

- Shown in the site headers a signed-in maker sees: the Discover/product header (`site-header` in `components/platform.jsx`), the launch header, creator pages and settings. It's not shown when signed out.
- An unread count badge, capped at "9+".
- Clicking opens a short panel with the newest 30 items. Each item has:
  - a line ("Someone saved *Monsoon Sketch*", "Ravi commented on *Monsoon Sketch*: 'love the colours…'");
  - a time ("2h");
  - a link to the work.
- Opening the panel marks everything as read. There's no per-item read state beyond that.
- An empty state uses Gobble's voice, for example "Nothing yet. Post something and Gobble will tell you when people notice." The exact copy is up to the builder, in the brand voice from `docs/BRAND.md`.
- Motion follows the site rules: honour `prefers-reduced-motion`, keep animations at about 0.5s or less, and no cursor-only effects on touch.
- The hosted site is a static export (`hosting/`) that calls Supabase from the browser through `tg_api`, so the bell reads through `tg_api` too.

## Email

- **Sender:** Resend, from `Gobble at tadgobble <notifications@tadgobble.in>` *(my call)*, with reply-to `hello@tadgobble.in` so replies land in the Zoho inbox.
  - The domain is already added in Resend by the user.
  - The Resend API key lives only in Supabase secrets (`RESEND_API_KEY`), never in code or the repo.
- **Recipients:** makers get mail at their Supabase auth email, and only if it is confirmed. The admin address is `hello@tadgobble.in`, stored as a Supabase secret or setting rather than hard-coded *(my call)*.
- **Look:** simple and on-brand. Cream background, the Gobble mark, one clear button to the work, a plain-text alternative, and a footer with the unsubscribe link and a link to settings. Copy is short, friendly and lightly Hinglish where it fits, matching the site.
- **Turning emails off:**
  - Every maker email has a one-click unsubscribe link (signed, no sign-in needed) and `List-Unsubscribe` / `List-Unsubscribe-Post` headers.
  - Settings gets an "Email me about my work" switch, on by default.
  - Turning it off stops all maker emails: first save, comments, review results and the roundup. The bell keeps working.
- **Admin emails** ignore the maker switch.
- **Weekly roundup:** sent once a week, *my call: Sunday morning India time*. It includes that week's save count, comment count and reply count per work, and links to each. It's skipped if the count is zero.

## Constraints

- **Backend:** Supabase Postgres plus Edge Functions. All app writes go through `public.tg_api` (`security definer`). New behaviour follows the repo's migration pattern, where a new migration renames the previous `tg_api` and wraps it. Browser roles get no direct table access.
- **Deploys:** the user runs `supabase db push` and function deploys. The builder writes migrations and functions but never pushes or deploys.
- **Secrets:** go in Supabase secrets only. The builder never reads `.env` files.
- **No real user data:** none in tests, fixtures, mockups or screenshots.
- **Resilience:** a save, comment or submission must succeed even if notification creation or email sending fails. Email sending must not run inside the user's request. It happens afterwards, and retries on failure.
- **Volume:** Resend free tier allows 3,000 emails a month and 100 a day, which is plenty at current size. The design shouldn't send more than one email per event.
- **Tests:** `npm test` must stay green. New backend behaviour gets tests in `tests/cloud.test.mjs` (PGlite).
- **Local SQLite edition (my call):** notifications are built for the Supabase/hosted build only. In the local edition (`lib/api.mjs`, used when `NEXT_PUBLIC_DEPLOYMENT_TARGET !== 'firebase'`), the bell and the email switch are hidden. Nothing is added to `lib/api.mjs` or `lib/db.mjs`.
- **Privacy policy:** `components/legal.jsx` must be updated to say that tadgobble sends notification emails through Resend and that you can turn them off.

## Suggested shape (builder may change)

- **Notifications table:** recipient, kind, product, actor (nullable for anonymous saves), a small preview text, a count for merged saves, `created_at`, `read_at`.
  - Rows are created by triggers on `tg_saves`, `tg_comments` and `tg_products` status changes, or inside the `tg_api` routes. Either way, creation must not be able to fail the user's action.
- **Email outbox table:** rows queued alongside the notification, drained by an Edge Function that calls Resend. The function is invoked on a schedule (pg_cron + pg_net, every few minutes) and also runs the weekly roundup.
  - The outbox gives retries and keeps sending out of the user's request.
  - If pg_cron / pg_net aren't enabled, the plan must say exactly what the user needs to turn on in the Supabase dashboard.
- **New `tg_api` routes:** `notifications` (list plus unread count), `notifications/read` (mark all read), and the email preference read and write.
- **Unsubscribe:** an Edge Function with `verify_jwt = false` that checks a signed token and flips the preference.

## What the user must do (the plan should list these as hand-off steps)

1. Confirm `tadgobble.in` shows as **Verified** in Resend.
2. Create a Resend API key with "sending access" for that domain, then set it with `supabase secrets set RESEND_API_KEY=…`.
3. Turn on any Supabase extensions the plan needs.
4. Run `supabase db push` and deploy the new functions.
5. Deploy hosting (`npm run deploy:hosting`).

## Left to the builder

- Exact table and column names, and whether to use triggers or route code.
- Email HTML structure and the exact wording, in the brand voice.
- The bell's visual design within the existing cream look and design tokens.
- The schedule frequency for draining the outbox.
- Pruning old notifications, for example after 90 days.
