# tadgobble: the Highlighter look

Project 1 of 2. Project 2 covers the getting-seen features (1st-post badges with real data, first-comment nudge, notifications, the 1–2 day summary, Gobble's picks, maker-replied tags, Rising). This doc covers only the new look. It changes how the site looks, not how it works.

## Why

tadgobble is being repositioned as India's home for the upcoming generation of makers (art, design, photos, apps). The owner's words: a 19-year-old posting their first thing gets buried "in a whole sea of ppl filled with more talented ppl". The answer is a place where new makers come first and get likes and comments from everyone.

The owner treats this brand identity as a one-way door, so the look has to be settled before the features are built on top of it. They asked for a change to "the whole look and feel", with colours that are "more contrasty with a dark tint in it". It must not look like Behance (sleek, dark, premium was rejected). It must still feel like today's tadgobble, which they like.

## Goals

- A clearly new, higher-contrast look that a returning visitor notices immediately.
- It still reads as tadgobble: same mascot, fonts, humour and snack machine.
- New makers feel welcome. The home page speaks to first-timers.
- India-first, but subtle.

## Non-goals

- Any new behaviour, database tables or API changes. Those are project 2.
- A new name, logo or mascot.
- Changing the categories in `lib/product-options.mjs`.
- Domain setup (tadgobble.in is a separate task).

## Anti-goals (failure even if it "works")

- Looks like Behance, Dribbble or a generic dark SaaS site.
- Loud on every screen. The owner asked to "keep it subtle".
- Indian clichés: tricolour, rangoli or truck-art patterns, heavy Hindi slang.
- Leaderboards, follower counts or anything that ranks makers against each other.
- Unreadable contrast anywhere (body text must meet WCAG AA).

## Decided

**Palette direction: A2 "Highlighter"** (chosen by the owner from mockups). Values from the mockup, to be tuned by the builder within the same feel:

| Role | Value | Notes |
|---|---|---|
| Page body | `#160b26` | near-black with a purple tint |
| Raised surface (cards, panels, inputs) | `#22133a` | |
| Text on dark | `#f6f1ff` | |
| Highlight yellow | `#ffe600` | electric yellow |
| Violet | `#7b4dff` | stronger than today's lilac |
| Gobble lilac | `#c5b5f5` | Gobble keeps his colour |
| Orange | `#ff7547` | kept, used sparingly |

**How the colours are used** (owner agreed to these calls):
- Dark across the whole site: home, Discover, product pages, profiles, studio, posting, settings, welcome, legal.
- Yellow is reserved for a few moments: the home hero block (yellow top over the dark body, as in the mockup), the primary "Post your thing" button, and "1st post" / "new" badges. Most screens are dark with yellow as the highlight, not yellow everywhere.
- Work tiles get hard light outlines (about 2px) on dark.
- Violet is for secondary emphasis: active tabs, text highlights, links.

**Kept as-is:**
- Fonts: Bricolage Grotesque (display) and DM Sans (body).
- Gobble (`components/gobble.jsx`) and his lilac colour.
- The Gobble-o-matic snack machine (`components/snack-machine.jsx`), restyled for dark. The gumballs stay coloured by category.
- Humour, but quieter: about one joke per screen.

**Home page:**
- The hero leads with first-timers. Mockup headline: "Fresh from first-timers." with the second line highlighted in violet.
- Tabs: Fresh today / Rising / Gobble's picks. In this project only the tab styling exists. *Builder's call:* how to handle tabs whose data arrives in project 2 (e.g. Fresh today shows newest posts, and the others are hidden until project 2).
- The "be their first comment" nudge is a dashed-border box. In this project it is a visual component only; it is not wired to data until project 2.

**India-first, subtly:**
- Copy refers to India's makers where natural (meta description, hero sub-line, welcome screen). An occasional Hinglish word in small copy is fine.
- Cards are laid out as "Name · City". There is no city field in the database yet, so in this project the card shows the name only, with the layout ready for the city. Adding the field is project 2. *(My call.)*

## Constraints

- Next.js 16: read `node_modules/next/dist/docs/` before Next-specific code.
- Motion rules: reduced motion means static, about 0.5s or less, no cursor effects on touch.
- Colours are mostly hard-coded today (about 80 uses of `#39245a` across `app/*.css`, with `globals.css` at 3,400 lines and `launch.css` at 39 KB). The builder should move every colour onto CSS variables (from `lib/design-tokens.mjs` → `sitePalette` / `paletteStyle`), then switch the values. Don't hand-edit hex codes file by file.
- Dark only. No light/dark toggle. *(My call; it's one identity.)*
- Never use real user data in mockups, screenshots or marketing.
- The owner runs production deploys (`npm run deploy:hosting`).

## Also update

- `app/icon.svg` / `app/icon.jpg` and `public/social-card.png` to match the new colours.
- `<meta name="theme-color">` set to the body colour.
- `lib/brand.mjs` description: mention India's makers. Remove anything that implies non-existent categories.
- README: fix "paintings, zines, fonts, tiny apps" (zines and fonts aren't categories).

## Settled after the builder check (my calls)

- **Badges and nudge:** "new" shows for real, worked out from `created_at` (posted in the last 7 days). "1st post" and the first-comment nudge stay hidden until project 2, so nothing on the page claims something untrue.
- **Copy:** only the new hero, welcome screen, meta description and the primary submit button ("Post your thing") are rewritten. The rest of the existing copy stays; a wider copy pass is out of scope.
- **Shared images:** Instagram story cards (`components/story-card.js`) and the render/video scripts in `lib/` move to the new palette too, so the old look doesn't stay live off-site.
- **Avatar colour "Gobble purple" (`#39245a`):** existing choices are kept, and dark avatars get a light outline on dark backgrounds so they stay visible. No user's choice is changed.
- **Home page structure (owner decided):** top to bottom: the "Fresh from first-timers." hero with the tabs and a grid of the newest work right under it, then the snack machine (restyled), then the "MADE A THING?" poster (restyled). The "GOOD FINDS." poster and the Gobble "Feed me a find" stage, the "OPEN ANOTHER TAB" ribbon and the ProductShowcase colour-band drawers are removed from the home page. Update `docs/BRAND.md` where it describes them. Gobble still appears on home (builder's call where, e.g. in the hero).

## Left to the builder

- Exact tints and shades, hover/focus states and border opacities, within the A2 feel and AA contrast.
- How product tints (`productTints`) and cover art adapt to a dark page.
- The order in which pages are converted, as long as no half-converted page ships.
- Exact hero sub-copy, in tadgobble's voice.

## Done when

- Every route renders in the new palette with no leftover cream or yellow pages.
- Text contrast passes AA throughout.
- The snack machine, Gobble and all animations still work, including reduced motion.
- The owner has reviewed it locally and approved it before deploy.
