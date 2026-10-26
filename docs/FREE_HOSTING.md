# Free launch: Firebase Hosting + Supabase

The static app is deployed to Firebase Hosting. Supabase provides Postgres, authentication, private media storage, and small functions for validating video uploads and migrating existing passwords. Firebase billing was confirmed disabled during setup. Nothing in this deployment enables Blaze, Firebase Functions, or Firebase App Hosting.

| Page | Address |
| --- | --- |
| Landing | https://tadgobble.web.app |
| Discoveries | https://tadgobble.web.app/discover |
| Submit | https://tadgobble.web.app/discover?submit=1 |
| Admin review | https://tadgobble.web.app/studio?tab=products&status=pending |
| Private support inbox | https://tadgobble.web.app/studio?tab=inbox |
| Privacy policy | https://tadgobble.web.app/privacy |
| Terms of service | https://tadgobble.web.app/terms |

Admin pages require an account with the server-controlled admin role. Use the existing owner credentials in your local `.env.local`. Signing up with Google creates a member, not an admin.

## Google sign-in

New members use **Continue with Google**. Existing members and the owner can still use their email/password. Supabase email confirmation remains enabled. Google verifies the Google identity; tadgobble does not request or store the Google password. We request only the standard identity/profile/email scopes.

One-time account setup:

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/clients?project=tadgobble) for the `tadgobble` project. Set up Branding and an External audience if needed.
2. Create an OAuth client of type **Web application**. Add `https://tadgobble.web.app` as an authorized JavaScript origin.
3. Add this exact authorized redirect URI: `https://ixyfcswubxncobcnjget.supabase.co/auth/v1/callback`.
4. In [Supabase Auth providers](https://supabase.com/dashboard/project/ixyfcswubxncobcnjget/auth/providers), enable Google and save the Client ID and Client Secret. Leave email checks and nonce checks enabled. Never put the secret in Git or a `NEXT_PUBLIC_*` variable.
5. Set the Google audience to **In production** to allow public sign-in. A testing audience restricts who can join. Optional branding verification is managed by Google.

For the Branding page's **App domain** fields, use:

- Application home page: `https://tadgobble.web.app`
- Application privacy policy link: `https://tadgobble.web.app/privacy`
- Application terms of service link: `https://tadgobble.web.app/terms`

These pages are public and linked from the homepage. Their contact forms store private requests in **Studio → Inbox**. Review that inbox regularly; it does not send email notifications automatically. The old `?tab=partnerships` link still opens the inbox.

Google's Authorized domains field uses domain names, without schemes or paths. For the configured homepage and callback, the top private domains are `tadgobble.web.app` and `ixyfcswubxncobcnjget.supabase.co` (`web.app` and `supabase.co` are public suffixes). Brand verification can require additional ownership verification; saving these fields alone does not establish Google approval. See [Google's domain rules](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification#authorized-domains).

The browser uses PKCE and returns to `/auth/callback`, which is included in Supabase's redirect allowlist. Provider credentials are configured in the dashboard and intentionally omitted from `supabase/config.toml`; config pushes leave them unchanged. Before the provider is enabled, the button displays an explanatory error instead of redirecting to a broken page.

Supabase's default SMTP service cannot deliver signup messages to the general public. Email/password registration is therefore absent from the cloud UI. Email recovery is not offered yet; configure a custom SMTP service and a recovery screen before adding it. The original local app retains its local signup behavior.

Official references: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Build and deploy

Requires Node 22.13+, npm, and authenticated Firebase/Supabase CLI sessions. Run from the repository root. On this Windows workspace, prefix commands with `rtk proxy`.

```bash
npm ci
npx firebase-tools login
npx supabase login
npx supabase link --project-ref ixyfcswubxncobcnjget
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. They are public client configuration. Keep admin credentials and any service-role/secret key private.

```bash
npm run build:hosting
npm run preview:hosting
# Preview: http://127.0.0.1:4173

npm run deploy:hosting
```

`hosting/` reuses the app's components and exports plain HTML, CSS, and JS. `firebase.json` deploys only `hosting/out`. `/product/<slug>` and `/go/<slug>` use Hosting rewrites and fetch published data in the browser. Product pages currently share general social metadata; product-specific social cards/SEO are a future enhancement.

For future database changes:

```bash
npx supabase db push --linked
npx supabase config diff --project-ref ixyfcswubxncobcnjget
npx supabase config push --project-ref ixyfcswubxncobcnjget
npx supabase functions deploy legacy-login --project-ref ixyfcswubxncobcnjget --use-api
npx supabase functions deploy video-upload --project-ref ixyfcswubxncobcnjget --use-api
```

Review the config diff before pushing. Application tables use RLS with direct browser access revoked. `tg_api` validates inputs and checks ownership/admin roles. The private schema holds helpers and legacy password hashes. Google metadata cannot grant admin privileges.

## Website previews and videos

Art and design submissions use a photo and a title; a portfolio or website is
optional. The form defaults to **Art & design**, with **App or tool** as a second
choice. Categories, descriptions, image descriptions, and creative links live in
an optional section. All work uses the same private upload and human review flow.
Uploaded images keep their full proportions and are compressed to WebP within
1600 × 1600 pixels without upscaling. No new paid service is required. The first
version supports one photo or video per work. For JPG, PNG, or WebP images, originals up to 25 MB are
resized on the device before upload; the server still caps the resulting file at 5 MB.

Video posts support clips up to **30 seconds** with a **5 MiB stored video limit**.
MP4, MOV, and WebM originals up to 100 MiB can be prepared in supported browsers;
the browser compresses when necessary and generates a WebP cover frame. If the
browser cannot encode a particular clip, the form asks for an H.264 MP4 under
5 MiB. Sound is preserved. There is no server transcoding service or paid encoder.
The policy is shared in `supabase/functions/_shared/video.mjs`; reducing the limit
later affects new uploads, not playback of existing approved clips.

Migration `202610210006_video_posts.sql` creates the private `videos` bucket and
ownership rules. The `video-upload` Edge Function independently validates actual
file duration, format, dimensions, and size before storage. Direct browser writes
to the video bucket are disabled. Deploy the migration and function before the UI.
`verify_jwt=false` in the function configuration delegates authentication to the
user-scoped database upload gate; the function still requires a valid member JWT.

Galleries load only posters and duration badges. Work details and admin review
obtain a five-minute signed video URL only after Play is pressed. Native controls
allow sound, seeking, and fullscreen. Pending videos remain private to their owner
and admins; publishing makes playback available to visitors. Revocation blocks
new links immediately, while previously signed links can last until expiry.

Run `npm run test:videos` after `npm run build` for isolated local browser checks.
`npm run test:cloud:videos` checks the static preview and real cloud upload, then
removes its private test user, submission, and media. It never publishes a test clip.

## Creator accounts and review

- `/settings` edits the creator's name, username, photo, bio, links, profile colour,
  and public visibility. Google remains the signup method.
- `/welcome` provides a skippable two-step introduction after a new member signs
  in. It preserves the requested return page. Existing accounts are marked complete
  by migration `202610210008_blob_onboarding.sql` and can revisit it from Settings.
  Users can choose the original Gobble or a Blobatar friend, colour and expression
  instead of uploading a photo. Blobs render locally and do not consume Storage.
  Intent and interests are private account preferences, not public profile fields.
  They are editable in Settings; they do not yet change the discovery ranking.
- Account deletion is available only in the collapsed **Delete account** section
  at the bottom of Settings, with the existing confirmation and admin restriction.
- `/profile/<username>` is a shareable public page containing approved, self-authored
  work. Email, saved items, pending work, and review notes remain private.
- `/my-work` shows submission status and private admin feedback. Editing an approved
  piece returns it to review and temporarily removes it from public pages.
- `/studio` opens the review queue on the hosted site. Reviewers can publish, request
  changes, or reject with feedback. Published work and desktop-only tools have their
  own labelled navigation items.
- Work shared with permission on someone else's behalf carries separate creator
  credit and does not appear in the submitter's own profile gallery.

These routes are part of the static Firebase export and use the existing Supabase
backend. Profile and cover permissions are covered by migration
`202610210005_creator_profiles.sql`. Hiding a profile stops new public avatar links;
previously signed links can remain valid until their five-minute expiry.

Run `node --env-file-if-exists=.env.local scripts/cloud-artwork-e2e.mjs` to check
the static preview against the real cloud backend. It creates and removes a
temporary account, upload, and pending submission; it never publishes its artwork.

Uploaded cover images work entirely through the website. Automatic screenshots run on your computer to avoid paying for a browser server:

```bash
npx playwright install chromium
npm run worker:cloud
```

The worker signs in with the owner account, claims queued jobs, captures only permitted public web addresses, normalizes images, and uploads them to private Supabase Storage. On Linux use `npx playwright install --with-deps chromium`. If the computer sleeps or the worker stops, the website stays available and captures wait. A maker can upload or skip a preview.

Pending covers are accessible only to their maker and the owner. Approved covers can be viewed by everyone through signed links valid for five minutes. Rejecting a listing blocks new public links immediately; a previously issued link may remain valid until it expires.

The promotional-video editing and Instagram workflow remains in the desktop studio:

```bash
npm run sync:cloud
npm run dev
# Open http://127.0.0.1:3000/studio
```

Sync imports cloud listings and covers into the local database. It clears affected queued/approved local video approvals so changed product facts cannot reuse an old approval. This is a cloud-to-desktop import, not two-way synchronization. Review public listings in the cloud studio. Instagram publishing is disabled until separately configured and tested.

## Migrated data and backups

The one-time migration preserved Argus as published, the existing pending submission, archived starter products, users, saves, comments, and attached covers. It made a local SQLite backup under `data/backups/`. The legacy-login function verifies an existing local scrypt password once, updates the Supabase password, then removes the legacy hash. New accounts never enter this migration path.

`scripts/migrate-cloud.mjs` is an operator tool, not a normal startup step. It obtains the Supabase admin key from the authenticated CLI in memory; it never includes that key in the frontend. Do not rerun migration against a different project without reviewing it.

Local `data/` is excluded from Git. Back it up separately. Supabase is now the source for public submissions; establish regular database and Storage exports before relying on it for irreplaceable data.

## Checks and free-plan limits

```bash
npm test
npm run build
npm run build:hosting
# Keep preview:hosting and worker:cloud running for this real-service check:
npm run test:cloud:e2e
npm run test:cloud:auth
```

The cloud browser suite creates temporary QA accounts/listings, verifies access controls, passwords, saves, uploads, screenshots, moderation, and responsive layouts, then removes its fixtures. It briefly publishes its own test listing while checking approval; run it deliberately. It does not sign in to a real person's Google account. Google must be checked interactively after its provider is configured.

Free plans have quotas and may pause or restrict service when limits are reached; this is not unlimited hosting. Monitor Firebase Hosting storage/transfer and Supabase database, Storage, auth and function usage. Supabase Free projects can pause after inactivity. Screenshots require the desktop worker; new submissions and uploaded images do not.

Plan references: [Firebase Hosting usage](https://firebase.google.com/docs/hosting/usage-quotas-pricing), [Supabase pricing](https://supabase.com/pricing).
