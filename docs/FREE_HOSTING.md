# Free launch: Firebase Hosting + Supabase

The static app is deployed to Firebase Hosting. Supabase provides Postgres, authentication, private cover storage, and a small function for migrating existing passwords. Firebase billing was confirmed disabled during setup. Nothing in this deployment enables Blaze, Firebase Functions, or Firebase App Hosting.

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
```

Review the config diff before pushing. Application tables use RLS with direct browser access revoked. `tg_api` validates inputs and checks ownership/admin roles. The private schema holds helpers and legacy password hashes. Google metadata cannot grant admin privileges.

## Website previews and videos

Uploaded cover images work entirely through the website. Automatic screenshots run on your computer to avoid paying for a browser server:

```bash
npx playwright install chromium
npm run worker:cloud
```

The worker signs in with the owner account, claims queued jobs, captures only permitted public web addresses, normalizes images, and uploads them to private Supabase Storage. On Linux use `npx playwright install --with-deps chromium`. If the computer sleeps or the worker stops, the website stays available and captures wait. A maker can upload or skip a preview.

Pending covers are accessible only to their maker and the owner. Approved covers can be viewed by everyone through signed links valid for five minutes. Rejecting a listing blocks new public links immediately; a previously issued link may remain valid until it expires.

The FFmpeg/video/Instagram workflow remains in the desktop studio:

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
