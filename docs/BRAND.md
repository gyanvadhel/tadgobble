# tadgobble — brand identity

The name describes a character and a behavior. A hungry little blob has an enormous appetite for good internet finds. Product cards are snacks; discovery is taking a bite. The user explicitly prefers the purple, lobed Gobble with no tail. The landing page now uses that same SVG character permanently; it must not be replaced with a square 3D avatar after loading. The logo, page illustrations, favicon, and social preview share its rounded silhouette. Keep this character when extending the brand.

The user selected **tadgobble** on 20 October 2026, with a humorous, internet-native personality and a name that drives the UI itself. The desired social handles use the same pure-letter spelling. Their availability remains unconfirmed.

## The world

tadgobble is India's home for new makers: art, design, photos and useful apps. A first-timer posting their first thing should not get buried under more experienced people, so new work comes first and everyone is nudged to say something nice.

- **The home page, top to bottom:**

  1. **Header**, with a yellow "Post your thing" button.
  2. **Hero:** a yellow block reading "Fresh from first-timers.", with Gobble beside it.
  3. **Fresh today:** a grid of the newest work, up to 12 cards, with a "new" badge on anything posted in the last few days and a link to see everything.
  4. **The snack machine**, restyled for the dark page.
  5. **The "Made a thing?" poster**, with a "Post your thing" button.
  6. **Footer.**
- **Discover:** the full catalog, with search, categories, sorting, saves and the makers strip.
- **Your stash:** saved work.
- **The kitchen:** the operator's content studio.
- **You cooked:** maker submissions, with the existing source review and moderation workflow.

The previous look (butter-yellow "Good finds" poster, "Feed me a find" stage, typographic ribbon and colour-band product drawers) was removed from the home page in November 2026.

Booping Gobble is play. It never saves, endorses, buys, or visits anything on the visitor's behalf.

## Voice

Specific, playful, self-aware. Write as the friend who sends a useful link with one good joke. Keep labels for consequential actions clear.

Examples used in this build:

- “Your next ‘wait, this exists?’”
- “tiny guy. concerning appetite.”
- “Useful apps. Oddly brilliant tools. A new obsession, probably.”
- “your side project deserves more than a bookmarked link and a ‘looks cool bro’ from your friend.”
- “Made a thing? Let it loose.”

Avoid fabricated proof, promised traffic, invented partnerships, or making every sentence a meme. Submitted product descriptions remain their factual descriptions.

## Visual system: the Highlighter look

A dark violet page with one loud highlighter yellow. Bricolage Grotesque for display headlines and DM Sans for interface text. Gobble stays lilac `#c5b5f5`.

| Token | Value | Use |
|---|---|---|
| `bg` | `#160b26` | page background |
| `surface` | `#22133a` | cards, panels, inputs |
| `text` | `#f6f1ff` | main text (17.1:1 on bg) |
| `muted` | `#b8a9d6` | secondary text (8.7:1 on bg) |
| `line` | `#3a2a55` | borders |
| `yellow` | `#ffe600` | the highlight |
| `onYellow` | `#160b26` | text on yellow (14.9:1) |
| `violet` | `#7b4dff` | fills only: active tab, `mark` (white on it 4.8:1) |
| `violetText` | `#a98bff` | violet links and text (7.1:1) |
| `lilac` | `#c5b5f5` | Gobble |
| `orange` | `#ff7547` | sparingly |

The values live in `lib/design-tokens.mjs` and reach every page as CSS variables on `:root`. `npm test` fails if a stylesheet uses a raw colour outside `:root`, unless the line is marked `/* art */` (cover tints, illustrations).

- **Yellow appears in four places only:** the home hero block, the primary "Post your thing" button, "new" badges, and focus rings.
- **Dark only.** There is no light theme and no toggle.
- **India-first, kept subtle.** Copy mentions India's makers where it is natural (meta description, hero sub-line, welcome screen). No tricolour, rangoli or truck-art patterns, no heavy slang.

The public palette picker and saved colorway preference were removed at the user's request. One site palette now feeds the landing page, favicon, and social preview from `lib/design-tokens.mjs`. Product-scene tints change with selection; they do not change the site's identity. See [the research and design rationale](DESIGN_DIRECTION.md) for the Awwwards references and interaction principles.

Fonts are self-hosted, with SIL Open Font License files in `public/fonts`. The mascot, graphics, procedural 3D objects, and social card were created in code for this project. Lucide supplies interface icons. No downloaded 3D models or generated raster illustrations are required.

Animation references: [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) and [React Three Fiber performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance).

## Name checks — 20 October 2026

Exact-name web searches for **tadgobble** returned no indexed results. This is not proof of availability. The selected domain's registry check is recorded, with its timestamp and source, in `brand-checks.json`.

Exact username availability for [Instagram](https://www.instagram.com/tadgobble/), [TikTok](https://www.tiktok.com/@tadgobble), [YouTube](https://www.youtube.com/@tadgobble), and [X](https://x.com/tadgobble) is **unknown**. These links are check targets, not accounts belonging to this project. No account, handle, or domain has been reserved.

The brand name has been chosen; reserving the exact `tadgobble` handles is a separate remaining launch task. This research is not trademark clearance. The dated machine-readable results are in `brand-checks.json`.

## Changing the name

Update `lib/brand.mjs`, the private npm package name, and these notes. Run `node scripts/brand-assets.mjs` to regenerate the social card, then rebuild. UI names, metadata, newly prepared video scripts, new video frames, and outbound attribution read the brand configuration. Existing saved drafts and exported media keep their original content until explicitly edited or rerendered.

The existing workspace folder and SQLite filename intentionally stay as they were so local persistence is retained.
