# Scroll intro: a live, scroll-driven first-visit story

Date: 2026-11-05

## Intent

A first-time visitor to tadgobble.in should think "WHOA, what's this?" and keep scrolling. Today the home page is a good poster hero followed by product drawers, but nothing explains the whole site and nothing feels alive. This adds a short, scroll-driven story, led by Gobble, that tells a stranger everything there is to know: what tadgobble is, how to find things, how to save and comment, how to post your own work, and that every post is reviewed.

The owner explicitly does **not** want a video added on top of the site. The intro must be made of the site's own pieces (its fonts, colours, Gobble, real product data) so it reads as part of the site, subtle but fluid, and reacts to the visitor.

## Goals

- A pinned, scroll-scrubbed story of five scenes placed directly after the existing hero. Scrolling forward plays it, scrolling back rewinds it.
- Fluid motion: scenes melt into each other with a gooey, liquid transition; Gobble stretches, squishes and morphs between scenes; headline text rises in letter by letter.
- Interaction with the visitor: a soft liquid blob follows the cursor on devices with a fine pointer and stretches toward clickable things; key buttons pull slightly toward the cursor; scrolling is smoothed.
- Teaches the whole site in about 10 to 15 seconds of scrolling, in the site's voice (playful, a little Hinglish).
- Ends by handing off to the real "Fresh picks" product drawers, so the story flows into actual content.
- Works on phones (touch, no cursor effects) and desktop, and in both builds: the Next server build and the Firebase static export.

## Non-goals

- No video file, no audio in this version (sound can be a later, opt-in addition).
- No WebGL or 3D scene. Stay with SVG, CSS transforms and GSAP.
- The existing hero ("FIRST THINGS.", Feed me a find, snack machine) is not redesigned or moved.
- No changes to Discover, product, profile or studio pages.
- No new backend, database or API.

## Anti-goals (a failure even if it technically works)

- It looks like a pasted-on video or a generic template animation instead of tadgobble.
- It traps the visitor: no way to skip, scroll hijacking that fights the browser, or a page that is unusable with motion off.
- It makes the page slow or janky, or hurts the first paint of the hero.
- It breaks reduced-motion users: anyone with reduced motion on must get a calm, static, fully readable version of the same content.
- It hides the content from search engines or screen readers.

## What the visitor sees

The hero loads exactly as today. Directly below it a section called the story begins. On scroll it pins to the viewport and plays five scenes. Draft copy (builder may tighten wording; keep the voice):

1. **A better rabbit hole.** tadgobble is a home for art, design and useful apps, and the people who make them.
2. **Feed Gobble. Get a find.** One tap, one surprise: real work by real first-timers. (Shows Gobble eating a ticket and a real product from the live catalogue popping out.)
3. **Peek. Save. Say something nice.** Open a preview, keep it in your stash, leave a kind comment. (Shows a product card, a bookmark filling in, and a comment bubble.)
4. **Made a thing? Let it loose.** Post with just an image and a title, a short video, or a link to your app. No portfolio. We review every post before it goes public. (Shows the ticket for a post filling in, ending on an "in review" receipt.)
5. **Pehli baar? Perfect.** Fresh picks below. (Scroll prompt that releases the pin into the existing product section.)

A "Skip the tour" control is always visible while the story is pinned. It scrolls past the story to Fresh picks. It is a real link/button, keyboard reachable.

## Interaction and motion rules

- **Gooey transitions:** a shared SVG goo filter (blur plus colour matrix) applied to a layer of colour blobs. Between scenes the background colour and shape melt from one palette colour to the next (cream, lavender, acid green, accent orange, pond blue from the existing palette).
- **Gobble:** the existing `Gobble` SVG, extended with a few expressions (happy, hungry, surprised, wink), morphing and squashing between scenes. Gobble must remain the original four-lobed, tailless blob.
- **Cursor blob:** fine-pointer devices only. A soft blob eases behind the cursor and grows over links and buttons. Hidden on touch.
- **Magnetic buttons:** the main call-to-action buttons drift a few pixels toward the cursor on fine-pointer devices.
- **Smooth scroll:** a light smooth-scroll layer on the home page only. It must pause while the product preview dialog is open and be removed when motion is paused or reduced.
- **Text:** headline lines split into characters/words and rise in as each scene enters.
- Only transform and opacity (plus the goo filter) are animated.

## Motion off, no JavaScript, reduced motion

- If the visitor has reduced motion on, or taps the existing "Pause motion" control, the story is **not pinned**. The five scenes render as a calm vertical list of cards with the same copy and illustrations in their final state.
- Before JavaScript runs, and for crawlers, the same static list is what is in the HTML. The animated version enhances it.
- The existing "Pause motion / Play motion" toggle controls the new effects too.

## Constraints

- Next.js 16 (App Router) and React 19, JavaScript. The repo's `AGENTS.md` says this Next has breaking changes: read the relevant guide under `node_modules/next/dist/docs/` before writing code.
- The home page is shared by two builds: `app/page.jsx` (server) and `hosting/components.jsx` (`CloudLanding`, static export). Everything new lives in client components rendered by `components/launch.jsx` and must not import server-only code.
- GSAP 3.15 is installed and includes SplitText, Flip, MorphSVG, MotionPath, Observer and ScrollTrigger. Use those. One new dependency is expected: `lenis` (smooth scroll). No other new runtime dependency without a good reason.
- Site look: cream background, palette tokens in `lib/design-tokens.mjs`, Bricolage Grotesque display and DM Sans body (self-hosted), Gobble purple. Keep the existing "Highlighter" tokens and cream look.
- New styles go in a new `app/intro-story.css`, imported by the new component, in the same style as `launch.css`.
- Accessibility: all copy in the DOM in reading order; visible focus; skip control; no content only conveyed by animation.
- Performance targets (builder to confirm or tighten): no layout-shifting animation; hero first paint unaffected; added client JS kept small (target under about 60 KB gzipped, including `lenis`); 60 fps scrolling on a mid-range phone.
- The static export must still build (`npm run build:hosting`) and existing tests must still pass (`npm test`, `npm run test:launch`).

## Decided by the owner

- Option A: a live, in-page intro built from real site pieces, not a video.
- Fluid animation and interaction with the visitor are the point. "Whoa, let me scroll more."
- Placement: the current hero stays; the story starts below it (confirmed via "go" on the stated defaults).
- It must be skippable and respect reduced motion.
- Figma and Canva are connected if wanted; no brand art was supplied, so Gobble's extra expressions are drawn as SVG from the existing blob.

## Left to the builder

- Exact scroll length of the pinned story (suggest roughly 400 to 500 viewport heights on desktop, shorter on phones) and exact easing.
- How each scene's illustration is composed, as long as it uses the real site's look and, where relevant, real product data passed in via the existing `products` prop.
- How the goo blobs and colour sequence are drawn.
- The exact wording of the copy, within the voice.
- Whether the story pins in one wrapper or uses a separate section per scene.
- Test design: a Playwright script that scrolls through the story at phone and desktop sizes and screenshots each scene is expected; follow the pattern of the existing `scripts/*-e2e.mjs` files and `package.json` scripts.

## Builder-check answers (calls made by the designer, not the owner)

1. **Scene 2 with no product data.** The no-JS/crawler version uses a generic illustration (Gobble plus an empty "your thing?" ticket, matching the hero's empty state). Real product names appear only when `products` is non-empty at render. Nothing invented is ever hard-coded into the HTML. The static export starts with an empty list, so it shows the generic version until products arrive, then swaps in a real one.
2. **Order and skip targets.** Hero, then story, then the existing ribbon, then Fresh picks, then For makers. The ribbon stays where it is. "Skip the tour", the hero's "Fresh stuff below" and the skip-to-content link all keep targeting `#fresh-picks`, so they jump past the story on purpose.
3. **Motion state.** The story receives `motion` and `reduceMotion` as props from `Launch` and has no state of its own. The static-to-pinned swap happens on hydration, below the fold, so it should not be visible; the builder should confirm with a screenshot and reserve height if it is. A small pause/play control also sits in the story's corner. Pausing mid-story reverts the animation and keeps the scroll position; no scroll jump needs to be hidden.
4. **Interactivity.** Scene illustrations are decorative (`aria-hidden`) and self-contained. They do not open the preview dialog and do not share the hero's feed state. Each scene's meaning is in its real text. Smooth scroll is paused whenever the preview dialog is open.
5. **Phones.** Pin on phones too, using `svh` units and ignoring address-bar resize, with cursor effects off and lighter goo. Devices that look low-powered (coarse pointer with 4 or fewer logical cores, or low reported memory) get the static list instead of the pin.
6. **Copy accuracy.** Checked against the code: posting requires a photo or video, accepts a website link for apps, and ends at an "In the review queue" receipt; saving and comments exist. The draft copy is accurate. Keep it accurate if reworded (for example, never promise traffic or sales).
7. **Gobble expressions.** Add an optional `expression` prop to `components/gobble.jsx` that defaults to today's look, so the hero and every other use are unchanged. The brand scripts only read the blob outline from `lib/mascot.mjs`, which must not change.

## Success

- A stranger opening the home page can, by scrolling about one screen's worth of effort per scene, learn what tadgobble is and every main thing they can do, without reading a paragraph.
- It feels like tadgobble, not an overlay.
- Skip works, reduced-motion works, the static export builds, existing tests pass, and screenshots at phone and desktop widths look right.
