# tadgobble — brand identity

The name describes a character and a behavior. A hungry little blob has an enormous appetite for good internet finds. Product cards are snacks; discovery is taking a bite. The user explicitly prefers the purple, lobed Gobble with no tail. The landing page now uses that same SVG character permanently; it must not be replaced with a square 3D avatar after loading. The logo, page illustrations, favicon, and social preview share its rounded silhouette. Keep this character when extending the brand.

The user selected **tadgobble** on 20 October 2026, with a humorous, internet-native personality and a name that drives the UI itself. The desired social handles use the same pure-letter spelling. Their availability remains unconfirmed.

## The world

- **The menu:** the real product catalog.
- **The product drawers:** full-width colored bands open into generous product scenes and interactive editorial illustrations. This replaces the rejected pond and card grid. The standalone catalog uses colorful rows with search, save, and account tools.
- **Feed me a find:** a product ticket travels into the purple Gobble's mouth, then a preview opens with that product's actual information.
- **Your stash:** existing persistent saved products.
- **The kitchen:** the operator's existing content studio.
- **You cooked:** maker submissions, with the existing source review and moderation workflow.
- **Good finds:** the oversized opening poster. Scroll motion follows the headline, typographic ribbon, and maker asterisk without a pinned loading gate.

“Gobbling” is a discovery animation. It does not silently save, endorse, buy, or visit a product. The preview lets the visitor choose what to do next.

## Voice

Specific, playful, self-aware. Write as the friend who sends a useful link with one good joke. Keep labels for consequential actions clear.

Examples used in this build:

- “Your next ‘wait, this exists?’”
- “tiny guy. concerning appetite.”
- “Useful apps. Oddly brilliant tools. A new obsession, probably.”
- “your side project deserves more than a bookmarked link and a ‘looks cool bro’ from your friend.”
- “Made a thing? Let it loose.”

Avoid fabricated proof, promised traffic, invented partnerships, or making every sentence a meme. Submitted product descriptions remain their factual descriptions.

## Visual system

Butter `#f9f4a7`, plum `#39245a`, tangerine `#ff7547`, lavender `#c5b5f5`, sky `#bfdcf5`, and Gobble lime `#d5f568`. Bricolage Grotesque poster headlines and DM Sans interface text. Large color fields organize the page. Materials are tactile and softly lit; interactive illustrations are explicitly editorial demonstrations, not embedded third-party apps.

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
