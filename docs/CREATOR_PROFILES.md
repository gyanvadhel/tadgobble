# Creator profiles and submission care

## Design direction

Use plum #39245a for type/actions, butter #f9f4a7 for creator introductions,
lavender #c5b5f5 for personal accents, paper #fffdf8 for form surfaces, pond
#bfdcf5 for an alternate profile colour, and orange #ff7547 sparingly.
Bricolage Grotesque carries friendly headings; DM Sans handles readable forms.
Keep the original tailless Gobble.

Public profiles are a personal exhibition wall: a generous introduction followed
by full-image work. Settings and review tools use restrained labelled controls.
Left aligned text, strong mobile reading order, no invented engagement numbers.

```
Profile: [photo] Name / @handle     [Share profile]
         Bio / what I make / links
         [published work] [published work]

My work: [Share something]
         [image] Title / review status / feedback / edit

Settings: Profile details | photo | links | colour | visibility
          [Save profile]            account / sign out / delete

Admin: Review queue | Published | Overview | Inbox | Desktop tools
       [image] Creator / title / received date [Review]
       Review: image, attribution, feedback, publish/request changes/reject
```

Review of direction: avoid a generic social dashboard or follower counts. The
work supplies the visual interest. Keep software-only tools in one labelled
desktop section. All input and actions must fit 320 px and work by keyboard.

## Behaviour

- Public profiles expose only deliberately public profile fields and published,
  self-authored work. Email, role, saved items, drafts, and review notes stay private.
- Creator credit for work submitted on behalf of someone else is separate from
  the submitter; it must never appear as the submitter's own portfolio piece.
- Edits return listings to review; show this clearly before editing public work.
- Review outcomes and notes appear in My work; no email service is required.
- Larger supported phone photos are compressed before upload. Retain bounded
  file/pixel limits, owned-image checks, human review and private cover storage.
- Google remains the public signup path. Embedded-browser users get clear
  external-browser instructions and a copyable return link before starting OAuth.
- Keep the same behaviour in SQLite development and Supabase hosting. Use an
  additive migration, preserve existing listings, and retain static Firebase hosting.

## Verification

Check ownership and visibility boundaries, handle collisions, attribution,
avatar access, review/edit transitions and private feedback in both backends.
Exercise upload compression and mobile keyboard/form flows in Playwright.
Build local and static outputs, then deploy the reviewed migration and hosting.

## Release checks, 21 October 2026

- All 32 automated backend tests passed, including both SQLite and PostgreSQL
  profile visibility, ownership, credit, avatar access, and review transitions.
- Local and Firebase static production builds passed.
- Browser checks passed for settings at 320/390 px, a real 9 MB image compressed
  before upload, admin feedback, editing/resubmission, public creator links,
  published-work editing, and full portrait artwork display.
- Existing artwork/app submission and cover replacement/capture regression flows
  passed. No JavaScript page errors were observed.
- The static export passed against real Supabase: login, private upload/submission,
  profile edits, avatar storage, profile routing, and visibility. QA accounts and
  uploads were removed; no QA artwork was published.
- Simulated Instagram-browser guidance, Google PKCE/return intent, provider errors,
  and cancelled-sign-in recovery passed. Real-device Google consent was not exercised.

Visual review found portrait images overflowing their grid frames despite
`object-fit: contain`. Positioning images within fixed frames resolved the crop;
the browser suite now checks the image height against its frame. Desktop and
320 px profile screenshots show the full artwork and readable creator information.

Migration 005 and Firebase Hosting were deployed successfully. Live smoke checks
passed for `/profile/<username>`, `/settings`, `/my-work`, owner sign-in, mobile
studio navigation, and the Google ownership verification file. Existing public
discoveries were unchanged. Evidence is under `test-results/creators-live/`.

## Gallery refinement from the user's VSCO reference

Keep the existing plum, paper, lavender, butter and pond tokens, Bricolage headings,
and DM Sans controls. Let the creator's work supply the gallery's colours.

```
Existing personal introduction
Things I've made.                         Published count
[portrait] [landscape] [square]   [portrait]
[        ] [portrait ] [painting] [        ]
[square  ] [         ] [        ] [landscape]
```

Use natural-height image columns, four on wide screens, three on tablets and two
on phones. Consistent small gutters, no fixed image frames, no repeated category
cards. Reading and keyboard order follow the columns. Single works use a modest
width rather than stretching to fill the screen. Images open their existing detail
pages; titles appear on pointer hover and keyboard focus, with accessible link names
on touch screens. Missing previews retain a labelled Gobble tile.

Review: the reference's useful qualities are natural proportions, visual density,
and uninterrupted artwork. Keep Tadgobble's personal introduction and a small
paper/plum caption on interaction; avoid adding decorative frames, counters, or
automatic entrance animations. The existing private workspace remains unchanged.

Visual verification used 12 local sample artworks with mixed proportions at
1440, 820, 390 and 320 px. No cropping, overlapping images, or horizontal overflow
was observed. Keyboard focus reveals the caption and follows the column order.
One-, two-, zero-work and failed-image states also passed. Sample data was supplied
only to the local browser; it was not added to the live database. Both production
builds and the existing creator end-to-end flow passed after the layout change.
Preview evidence: `test-results/profile-gallery/`.
