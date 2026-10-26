# tadgobble

**Good finds. Questionable screen time.**

A home for art, design, useful apps, and the people who make them. Share something you made, no portfolio required, or wander the rabbit hole and save what you love.

Meet Gobble: the purple blob with excellent taste and absolutely no tab discipline.

**See it live at [tadgobble.web.app](https://tadgobble.web.app).**

![tadgobble's butter-yellow landing page, purple Gobble, and oversized Good Finds headline](docs/images/tadgobble.png)

## What's inside

- **Discover.** A showcase of paintings, zines, fonts, tiny apps, and clever tools, with a featured piece, a strip of makers, search, categories, and sorting.
- **Share your work.** Post art or design with just an image and a title, a short video, or an app with its website link. Everything is reviewed before it goes public.
- **Creator profiles.** Each maker gets a gallery wall of their work, a short bio, links, and a blob avatar of their own, built during a playful onboarding.
- **My work.** See how each submission is doing, edit it, or delete it (with a few seconds to undo).
- **Talk about it.** Save favourites, comment, and reply in threads.
- **Share it on.** Phones can post any work straight to an Instagram story as a ready-made card.
- **Accounts.** Sign in with Google or email, including password reset.
- **Review studio.** An admin space for approving submissions, managing covers, and keeping pending work private.
- **Motion with manners.** GSAP touches throughout: a letter-drop headline, cards that glide when you filter, galleries that rise in as you scroll, pictures that fly onto their page, confetti when you save, and a Gobble whose eyes follow your cursor. All of it switches off for reduced-motion settings.

## Built with

| Layer | Tools |
| --- | --- |
| Application | Next.js 16, React 19, JavaScript |
| Interface | Custom CSS, GSAP, Lucide, original SVG Gobble, Blobatar avatars |
| Typography | Self-hosted Bricolage Grotesque and DM Sans |
| Data and accounts | Supabase Postgres, Auth (Google and email), private Storage, Edge Functions |
| Hosting | Firebase Hosting static export |
| Media | Playwright Chromium for website covers, Sharp for images, FFmpeg for video |
| Verification | Node's test runner and Playwright browser suites |

A local edition of the same app runs on SQLite with server-side sessions, which keeps development and testing self-contained.

## Project map

```text
app/          Routes, page layouts, and styles
hosting/      Static cloud build sharing the same UI components
components/   Discovery, profiles, submissions, studio, Gobble, and motion
lib/          Data, accounts, covers, video, moderation, and content workflow
public/       Fonts, brand artwork, and licences
scripts/      Setup, worker, and browser verification suites
tests/        Workflow, access-control, cover, creator, and cloud tests
supabase/     Database migrations, auth settings, and edge functions
docs/         Design notes, operations, and verification history
design/       Source files for launch and social artwork
```

## Design notes

- [Brand notes](docs/BRAND.md): Gobble, the voice, and the visual identity.
- [Design direction](docs/DESIGN_DIRECTION.md): references and layout decisions.
- [Creator profiles](docs/CREATOR_PROFILES.md): the personal exhibition wall.
- [Sharing art](docs/ART_SHOWCASE.md) and [video posts](docs/VIDEO_POSTS.md): photo-first posting.
- [Blob onboarding](docs/BLOB_ONBOARDING.md): building your little Gobble.
- [Submission design](docs/SUBMISSION_DESIGN.md): the launch kitchen and covers.
- [Hosting](docs/FREE_HOSTING.md) and [operations](docs/OPERATIONS.md): how the live site runs.
- [Verification history](docs/LAUNCH_QA.md): completed checks and visual reviews.

Third-party licences are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and font licences are in `public/fonts/`.
