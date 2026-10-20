# Running tadgobble

A working product-discovery pilot with an interactive launch page and an editorial Instagram workflow. **tadgobble** is the selected identity: a hungry little blob, a menu of product discoveries, and a stash of saved finds. Social handles have not been claimed or confirmed available. See [brand notes](BRAND.md) and the dated [name checks](brand-checks.json).

The launch experience is at `/`; the full catalog is at `/discover`. Existing Instagram and saved-collection entry URLs redirect to the catalog with their query parameters preserved.

## Interactive launch experience

- A giant typographic poster and permanent purple Gobble, with playful boop and product-feed animations.
- Colorful product drawers with interactive editorial illustrations, real audience filters, product previews, search, and saved finds.
- A four-step submission kitchen with a live listing preview, automatic website screenshots, optional custom covers, 22 categories, 8 audiences, platform and pricing choices, and optional extra context.
- Butter, plum, lavender, tangerine, sky, and lime; self-hosted Bricolage Grotesque and DM Sans. Asset licenses are in `public/fonts`.
- Pause control, reduced-motion support, native scrolling, keyboard focus restoration, and responsive layouts from 320px upward.
- An honest first-submission invitation when the public collection is empty. Discovery controls appear when approved listings are available.

Run `npm run build`, `npm test`, `npm run test:e2e`, `npm run test:launch`, `npm run test:submission`, and `npm run test:covers` for the relevant checks. The browser tests use isolated databases and do not publish externally. The cover suite captures example.com to exercise the real browser service. QA screenshots and reports are written under `test-results`.

## Run it

Requires Node.js 22.13 or later and npm.

```powershell
npm install
npx playwright install chromium
npm run setup
npm run build
npm start
```

Open http://127.0.0.1:3000. The owner email and generated password are in `.env.local`. Open that file locally; do not paste its contents into chat or commit it. The studio is at http://127.0.0.1:3000/studio. The direct pending-review link is http://127.0.0.1:3000/studio?tab=products&status=pending.

`npm run setup` preserves existing configuration. The initial owner account is created on the first API request. Changing the environment password later does **not** reset an existing database account.

Website previews require the Playwright Chromium browser. On Linux hosts, use `npx playwright install --with-deps chromium` when preparing the server. Captures run after the first submission step, with a 25-second budget and one browser at a time. Uploads accept still JPG/PNG/WebP images up to 5 MB; covers are normalized to 1600×1200 WebP. Login pages, bot protection, heavy animations, or unavailable sites can prevent useful captures; makers can upload or skip a cover.

Covers live in `DATA_DIR/covers` and are private until attached to an approved product. Capture traffic checks public IP addresses and pins each resolved destination, including redirects and subresources; direct browser networking is denied. Abandoned covers older than seven days are cleaned up on the next successful cover upload/capture. In Studio → Products → Review, an admin can capture, replace, or remove an existing cover, then choose **Save cover**. Saving a published product updates its public cover immediately.

For continuous rendering and publishing, run a separate process:

```powershell
npm run worker
```

For a single step, use the studio's **Run one workflow step** button. The worker checks every 20 seconds and processes one eligible job per step.

## What works

- Public catalog with category, audience, and search filters; product detail pages and source links.
- Member registration, password login, persisted saves, comments, and account deletion.
- Creator submissions with an operator review queue. Pending submissions are not public.
- Content drafts generated from recorded product facts: script, caption, and shot list.
- Upload of an authorised MP4 demo and rendering of a real 1080×1920 H.264 Reel.
- Human review, approval, scheduling, daily posting cap, and persistent job states.
- Official Instagram publishing adapter, disabled until explicitly configured.
- Anonymous visitor counts, returning visitors, saved products, outbound clicks, and campaign sources.
- Partnership inquiries and sponsored-listing disclosure support. No fabricated revenue or traffic.
- SQLite persistence, salted scrypt passwords, server-side sessions, origin checks, role enforcement, request limits, and an audit trail.

Public discoveries start empty (`SEED_CATALOG=false`). The optional six editorial fixtures are used in isolated browser tests; on a fresh database they can be enabled explicitly with `SEED_CATALOG=true`. They reference real products without implying partnerships, and their artwork is labelled as an editorial illustration. Existing starter listings can be archived with `node --env-file-if-exists=.env.local scripts/empty-starter-catalog.mjs`; real submissions are preserved.

## End-to-end workflow

1. A maker submits a product name, URL, tagline, and category through four guided steps. Audience, platforms, pricing, capabilities, description, documentation, and a demo link can add context. The product website is used as the source when no separate source is supplied.
2. In **Studio → Products**, the operator checks the source and publishes the listing.
3. In **Content**, select the product and prepare its draft. Text is assembled from the submitted facts; it is not a claim that the product has been personally tested.
4. Record or receive a real product demo with permission to publish it. Upload its MP4 and confirm rights.
5. Queue the render. The worker creates a portrait video with the actual demo, product name, tagline, pricing description, and call to action.
6. Review the exported video and caption, then approve and schedule it.
7. Once connected, the worker creates a Meta media container, polls processing status, and publishes it when ready. It stores the confirmed media ID and attempts to retrieve the permalink.
8. The bio link sends viewers to `/?from=instagram&utm_source=instagram&utm_medium=organic_social&utm_campaign=pilot`. The site measures visits and outbound product clicks.

Rendering is silent. The voiceover script is exported for a separate recording. Website cover screenshots are captured automatically. Video demos must be supplied by an authorised operator; the workflow does not record third-party apps, purchase API credits, synthesize voices, infer product claims, or manufacture testimonials.

## Connecting Instagram

The adapter implements **Instagram API with Facebook Login**, using the `graph.facebook.com` host. It is not the separate Instagram Login flow.

You need a professional Instagram account linked to a Facebook Page, a configured Meta app, an appropriate Page access token, and the required permissions. Meta's official collection documents `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`, and `pages_show_list` for the relevant flow. Access for accounts outside app roles can require review.

Configure these only on the server:

```dotenv
APP_URL=https://your-domain.example
PUBLIC_MEDIA_ORIGIN=https://your-domain.example
INSTAGRAM_ACCOUNT_ID=your-instagram-professional-account-id
INSTAGRAM_ACCESS_TOKEN=your-page-access-token
INSTAGRAM_GRAPH_VERSION=the-supported-version-from-your-Meta-dashboard
INSTAGRAM_PUBLISH_ENABLED=true
DAILY_POST_LIMIT=1
```

`INSTAGRAM_GRAPH_VERSION` must have the form `vNN.N`. Select a supported version in the Meta dashboard. Tokens are never returned to the browser. Media must be reachable by Meta over public HTTPS. Only approved or later-stage video files are publicly served; unapproved previews require a studio session.

Configured credentials are not proof of a working connection. This adapter was tested with mocked API outcomes; a real account publishing test remains necessary. No real Instagram post has been made by this project setup.

Reference: [Meta's official Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api). The direct Meta documentation was intermittently inaccessible during implementation, so the official Meta-maintained collection was used for request shapes.

## Reliability and data

- SQLite uses WAL and atomic transactions to reserve work. The supported deployment is one application instance plus a worker sharing the same persistent local filesystem.
- `data/aplatform.sqlite` contains accounts, catalog data, interactions, and jobs. `data/media/` contains uploaded clips, rendered files, and packages. Product images live in data/covers/. Back up the entire data directory.
- A confirmed publish is never retried because a permalink lookup failed.
- A lost response during `media_publish`, or a stale publishing job after a crash, enters `needs_attention`. Check the account and reconcile the result before retrying. It is deliberately excluded from automatic retries.
- Pre-publish failures keep their error; edit or render again as appropriate. A new render clears an old container ID so obsolete content is not reused.
- Daily reservation and publication limits use UTC dates. The UI displays scheduled dates in the browser's timezone.
- Analytics use a hashed random visitor ID. Visits are deduplicated by visitor/day; outbound clicks are deduplicated per product/visitor over five minutes. Admin activity is excluded when recognised. These are directional first-party metrics, not independently verified conversions.
- The worker removes expired sessions, old rate-limit entries, and raw visitor events older than 90 days. Media and job history are retained until an operator implements a retention/backup policy.

## Before public deployment

This is a tested local pilot, not a completed high-scale business. Remaining launch work:

1. Choose and verify a brand/domain, hosting, and operating budget.
2. Run behind HTTPS with a persistent disk and supervised app/worker processes. `npm start` binds to loopback for a local reverse proxy. Do not use ephemeral/serverless storage for this SQLite setup.
3. Set production origins and secrets; test backup and restore. Use maintained Node/FFmpeg versions; `FFMPEG_PATH` can override the bundled binary.
4. Add email verification and account recovery before unrestricted registration; add edge-level abuse controls and operational monitoring. The local pilot intentionally has no email provider or outbound messages.
5. Publish operator-specific privacy/contact/data-deletion information and any terms required for your service and Meta app review. The in-app privacy note explains this build's current data handling but is not a complete business policy.
6. Complete Meta credentials/access review as needed; perform a real publishing test and arrange token renewal/rotation. OAuth onboarding, token refresh, Instagram Insights syncing, and cross-platform publishing are not implemented.
7. Add actual creators and authorised demo assets. Obtain independent feedback and observe returning visitors.
8. Validate a paid offer. Payment checkout, invoices, refunds, subscription billing, attribution of maker signups, and purchase webhooks are not implemented. Partnership inquiries are stored locally, not emailed.
9. Move to a managed database/object storage and stronger operational controls when measured load or deployment requirements justify it.

## Verification

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Unit tests cover approval, scheduling, daily caps, editing invalidation, disconnected publishing, concurrent workers, unknown publish outcomes, container polling, failed rendering, authentication, cross-origin protection, and actual MP4 rendering.

The browser test runs an isolated production server on port 3100 with temporary credentials and a separate test database. It exercises catalog filters, registration, saves, comments, submission, moderation, real clip rendering, approval, scheduling, access isolation, analytics, and mobile overflow. It never publishes externally. Screenshots and failure logs go to the ignored `test-results/` directory.

See [the operating plan](OPERATING_PLAN.md) for the proposed audience, publishing, and revenue experiments.
