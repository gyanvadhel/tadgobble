# Launch verification

## Firebase Hosting and Supabase — 21 October 2026

Deployed the static cloud app to https://tadgobble.web.app using Firebase Hosting only, with billing confirmed disabled. Supabase now holds accounts, listings, saves, comments, cover images, inquiries, and moderation. Argus remains the sole public listing; the existing pending submission and archived starter products were preserved. Local data was backed up before migration.

Both Next builds passed, all 27 unit/workflow tests passed, and production dependency audit found no vulnerabilities. The real-Supabase browser suite verified one-time legacy password conversion, protection against forged admin metadata, denied direct table access, Argus's real image, login/saving, submission/upload, private pending covers, approval/rejection, a real desktop-worker screenshot, owner-only studio access, and layouts at 1440px, 390px, and 320px. Temporary accounts, covers, and listings were removed afterward.

Read-only checks against the deployed HTTPS site verified the landing, discover, product, outbound, studio, and auth callback routes; owner login; pending-review deep link; loaded Argus image; and no mobile overflow or browser exceptions. Desktop landing, submission editor, mobile catalog, and mobile sign-in screenshots were visually reviewed. Artifacts are under `test-results/cloud-launch/` (ignored by Git). The static export was scanned for private configuration values; none were found.

Google sign-in uses PKCE with a dedicated callback and a preserved submission return destination. The auth browser check covers provider-not-configured feedback, the PKCE request, mobile layout, and cancelled consent recovery. It does **not** complete real Google consent. Email confirmation is enabled; Google provider activation and an interactive Google login remain account-side setup steps. No public email/password registration is offered until a separate email service is configured.

Automatic captures require `npm run worker:cloud`; browsing, accounts, uploaded covers, submissions, and review do not require the desktop to stay on. Video rendering and Instagram integration remain local, with external publishing disabled. [Cloud operations and limitations](FREE_HOSTING.md).

## Automatic website previews and custom covers — latest update

Website captures now run automatically after the first submission step, alongside category selection. Makers can upload a still JPG/PNG/WebP cover, retake the website, remove the image, or continue without one. The selected image appears in the live ticket, admin review, landing drawer and preview, catalog row, and product detail. A slower capture cannot overwrite a later upload. Capture failures preserve the form and offer retry/upload/skip. Existing published products have explicit Save cover controls in admin review.

The capture service renders a real 1440×1080 page and stores a normalized 1600×1200 WebP. Every requested document/redirect/subresource uses a public-address check with a pinned DNS result; browser network fallback is denied. Captures have time/request/byte/concurrency limits. Uploads are bounded and decoded as raster images. Unpublished or replaced covers are only available to their owner and the admin; approval exposes the chosen cover. Image ownership is enforced on submission. Abandoned covers have a seven-day cleanup window.

The production build passed. All 20 unit/workflow tests passed, including private-address defenses, upload validation, ownership, image publication, and actual MP4 rendering. All 7 cover browser checks, 6 submission checks, 13 launch checks, and the full end-to-end product workflow passed. Cover checks include a real capture of example.com, manual override, invalid upload recovery, admin retake/save/remove, late capture handling, and mobile layouts through 320px.

- Cover report/screenshots: `test-results/covers-qa-6NhElw/`.
- Guided submission checks: `test-results/submission-qa-OOlDTH/`.
- Launch checks: `test-results/launch-qa-zOOwr2/`.
- Full workflow: `test-results/e2e-HFRMb2/`.
- Actual Argus preview and live screenshots: `test-results/covers-live/`.

Visually reviewed desktop/tablet/phone images, reduced the editor preview width to make its controls easier to reach, and verified an actual capture of askargus.app including its WebGL eye. The local server on port 3000 was restarted. Argus remains the sole published discovery and now uses that reviewed website capture; all six starter products remain archived. Actual landing/catalog/detail pages were checked at 1440px, 390px, and 320px with no overflow or browser errors. Browser installation requirements and blocked-site fallback behavior are documented in README.md.

## Guided submissions and starter catalog cleanup — latest update

Archived the six editorial starter products and changed seeding to opt-in. No submitted products were removed. Public discoveries were empty after cleanup; during final verification Argus was published, and the user explicitly requested keeping it visible. The running site now shows Argus as its sole public discovery. The empty collection invitation was verified against an isolated empty database.

Replaced the long submission form with a four-step launch kitchen, live product ticket, 22 searchable categories, 8 audiences, optional platforms/pricing/context/demo links, listing colors, and a final review screen. Extra details remain optional; product website and tagline provide honest defaults without invented capabilities. New fields persist through submission and appear in admin review. Pending submissions remain private. The direct review URL is `/studio?tab=products&status=pending`; archived listings are accessible through the admin status filter.

Production build passed, all 16 unit/workflow tests passed, the full end-to-end workflow passed (including real MP4 rendering), all 13 launch checks passed, and all 6 new submission checks passed. The submission suite exercises required-field validation, state preservation, optional metadata, minimal submissions, moderation, category/audience filtering after approval, chosen listing color, and all four steps at 768px, 390px, and 320px. No uncaught browser errors occurred. External publishing was disabled in isolated tests.

- Submission screenshots and report: `test-results/submission-qa-7oNipF/`.
- Full workflow: `test-results/e2e-8G6IuW/`.
- Launch checks: `test-results/launch-qa-GTH8KZ/`.
- Actual local site screenshots: `test-results/submission-live/`.

Visually reviewed the form at desktop/tablet/phone sizes, the final preview, and the empty collection. The site on port 3000 was restarted with the finished build. Read-only live verification confirmed six archived editorials, published Argus, functional admin sign-in and pending-review deep link, and the new wizard. No live products were submitted or moderated during verification.

## Permanent purple Gobble — latest correction

The illustrated purple blob was only the initial SVG display while a dynamically loaded WebGL scene replaced it with a square lime character. The user explicitly prefers the purple blob. The landing page now renders that Gobble permanently with no WebGL import, capability probe, or ready-state swap. Its silhouette, purple color, lavender disc, and placement are preserved. Clicking or keyboard-activating Gobble triggers a squash-and-spring boop; “Feed me a find” moves the adjacent ticket into its mouth and opens the real product preview. The ticket itself also opens a preview and restores focus on dismissal. Reduced motion and pause finish or skip those animations.

Build passed and all 13 launch browser checks passed. The suite now checks that the same purple SVG stays visible after hydration and a delayed check, no canvas replacement appears, both boop activation methods work, and ticket preview restores focus. Desktop/tablet/mobile screenshots were reviewed, including 390px and 320px. Final artifacts: `test-results/launch-qa-PkxRbM/` and `test-results/full-redesign/`. Production preview on port 3000 was restarted with the corrected build.

## Complete UI replacement — current version

The prior reference pass was rejected because it retained the old layout. This version replaces the split serif hero, pond, pinned snack-card story, browser-window maker section, and small footer with a full-width typographic poster, colorful product drawers, interactive editorial demos, a bold maker poster, and a large wordmark footer. The catalog and product pages share the new identity. The original tailless blob is retained; no vibe check or palette picker remains.

Production build passed. All 13 rewritten launch browser checks passed, covering real product discovery, all six interactive demos, drawer keyboard behavior, filters/search/empty states, focus restoration, signup-to-submission, campaign URLs, mobile navigation, motion pause, reduced motion, unavailable WebGL, and native product drawers without JavaScript. No uncaught browser errors or failed requests occurred. The existing full workflow also passed: registration, saved products, comments, submissions, moderation, actual MP4 rendering, approval, scheduling, and analytics, using isolated test data with external publishing disabled.

- Launch suite report: `test-results/launch-qa-VF69Cf/report.json`.
- Full workflow: `test-results/e2e-RADdIZ/`.
- Final production screenshots: `test-results/full-redesign/`.
- Production preview: `http://127.0.0.1:3000`.

Visual review covered desktop, tablet, 390px, and 320px layouts. Corrected overly tight type tracking, a clipped mobile headline, a missing mobile word space, a sketch connector crossing its label, and product-detail grid overflow at 320px. After the final CSS fix, rebuilt production and repeated the screenshot inspection with explicit headline and detail overflow checks. Product detail screenshots at 1440px, 390px, and 320px all fit. Self-hosted font preloads now match the two families used by the new landing page.

The local launch measurement was LCP 576ms, CLS 0.000058, about 570KB transferred in local Chromium with software WebGL. These are local diagnostics, not field performance claims or an Awwwards score.

The following sections record superseded iterations.

## Awwwards reference pass — superseded

Reviewed the supplied color collection, selected interaction videos, and related Awwwards entries. Applied the installed Anthropic frontend-design skill. Sources, palette roles, and the pre-implementation design review are in `DESIGN_DIRECTION.md`.

Removed the entire vibe check, header palette shortcut, alternate palettes, and local-storage theme reads. The site now uses pearl, plum, lilac, and lime with tangerine accents. Added product-linked scene tints, pointer-responsive object tilt, brief selection ripples, coordinated preview transitions, a scrolling section color transition, and a damped boop spring with pointer-following eyes on the original tailless blob. Retained native scrolling and the existing feed sequence.

Production build and all 14 launch browser checks passed. The suite additionally verifies that the old saved palette is ignored, selection changes the scene tint, pointer tilt responds, and pause stops the pond animations. The full existing product workflow passed, including submission, moderation, actual video rendering, and scheduling. There were no application exceptions or failed HTTP requests in the launch suite.

- Launch screenshots/report: `test-results/launch-qa-GKDFnv/`.
- Full workflow screenshots: `test-results/e2e-dlZIbZ/`.
- Design inspection: `test-results/pond-refined/`.
- Sizes reviewed: 1440, 768, 390, and 320 pixels, plus reduced-motion, WebGL fallback, and no-JavaScript modes.

Visual review corrected clipped long product names and the blob's position beside finds near a phone's right edge. The local production preview on port 3000 was rebuilt and restarted.

## Blob mascot restored

The user explicitly preferred the original blob over the later tailed character. The soft blob silhouette is restored across the logo, page illustrations, pond, favicon, and social preview. The 3D avatar again uses its chunky rounded body and little arms. The current showcase and palette options are retained. The production build and all 14 launch browser checks passed; the hero and generated social card were visually inspected. Artifacts: `test-results/launch-qa-crSTNx/`. The production preview on port 3000 was restarted with this build.

## Internet pond redesign

The launch showcase now uses a spatial pond and a single large product preview in place of the repeated grid. It supports direct selection, arrow/Home/End keyboard navigation, previous/next, random discovery, audience filters, text search, empty-state recovery, and pagination in sets of six. A phone-only control jumps to and focuses the selected preview. Native product links remain available without JavaScript.

Four locally persisted landing-page palettes update CSS and the 3D hero: Matcha, Cherry Soda, Poolside, and After Hours. Visual inspection covered all four, the dark maker section, and phone headers. A clipped mobile navigation control found in visual review was corrected and added to the layout assertions.

The final production build and all **14 launch browser checks** passed. The full existing platform end-to-end workflow also passed, including actual MP4 rendering, moderation, and scheduling. No application exceptions or failed HTTP requests occurred in the launch suite.

- Final launch report and screenshots: `test-results/launch-qa-gnyPXu/`.
- Existing platform workflow: `test-results/e2e-sA4vpV/`.
- Palette, hero, and phone inspection images: `test-results/pond-design/`.
- Layout checks: 1440, 768, 390, and 320 pixels; reduced motion; unavailable WebGL; JavaScript disabled.

The existing backend and full `/discover` account/catalog flows were retained. The local production preview at port 3000 was rebuilt and restarted.

## Earlier launch verification

The selected **tadgobble** name, round tadpole mascot with animated tail, favicon, and social preview were subsequently rebuilt and visually checked. All 12 launch browser checks passed again; updated screenshots and the report are in `test-results/launch-qa-n2ZUKg/`.

The production build completed successfully. The existing 14 workflow tests passed, including actual MP4 rendering. The original end-to-end browser flow also passed: discovery, filters, registration, saves, comments, creator submission, admin isolation, moderation, rendering, approval, scheduling, analytics, and mobile layout.

The new production browser suite (`npm run test:launch`) passed 12 checks:

- Real catalog and 3D hero render.
- Gobbling reveals distinct catalog products and Escape returns keyboard focus.
- Audience filters and surprise discovery respect the selected audience.
- Pinned animation survives fast forward/reverse scrolling.
- Maker registration continues directly to product submission.
- Existing Instagram entry URLs retain attribution parameters.
- Full-menu links retain the chosen audience.
- Layout and navigation work at 1440, 768, 390, and 320 pixels, including motion pause/resume.
- Reduced motion skips the 3D scene and retains discovery.
- Unavailable WebGL uses a functioning illustrated fallback.
- Server-rendered HTML contains the headline and actual product links without JavaScript.
- The main flow produced no application exceptions or failed HTTP responses.

Visual checks covered the hero, product menu, scroll scene, maker section, product preview, and mobile page. A keyboard focus-restoration bug found during testing was fixed. The desktop pin is limited to viewports at least 900px wide and 800px tall.

Artifacts:

- `test-results/launch-qa-tZNXo6/`: final launch screenshots and `report.json`.
- `test-results/e2e-iu65PR/`: full existing platform workflow screenshots.

One local Chromium run measured LCP at 400ms, CLS at 0.000017, and about 615KB transferred after the hero loaded. These are local observations using software WebGL, **not** Lighthouse scores, remote-network benchmarks, or real-user measurements. The Three.js/R3F combination emits an upstream Clock deprecation warning in development; it does not interrupt rendering. Browser screenshot capture can also emit software-renderer performance warnings.

The site runs locally. External hosting, account registration, social handle confirmation, and Instagram connection were not performed by this design change.
