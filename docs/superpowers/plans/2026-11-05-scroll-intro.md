# Scroll Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pinned, scroll-driven five-scene story under the home-page hero that teaches a first-time visitor everything about tadgobble, with liquid transitions, a cursor blob, magnetic buttons and smooth scroll.

**Architecture:** One new client component, `IntroStory`, rendered by `Launch` between the hero and the ribbon. It always renders the five scenes as a static, readable list; when motion is on and the device qualifies, a GSAP `ScrollTrigger` timeline pins that same markup and scrubs through the scenes. Pure decisions (scene copy, whether to pin, which scene is active) live in a tested `.mjs` module. Smooth scroll and cursor effects are small separate hooks.

**Tech Stack:** Next.js 16 (App Router), React 19, GSAP 3.15 (ScrollTrigger, SplitText, Flip, MorphSVG), `lenis`, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-scroll-intro-design.md`

## Global Constraints

- Read the relevant guide under `node_modules/next/dist/docs/` before writing Next-specific code (`AGENTS.md`: this Next has breaking changes).
- The hero ("FIRST THINGS.", Feed me a find, snack machine) is not redesigned or moved. Discover, product, profile and studio pages are untouched.
- No video file, no audio, no WebGL/3D, no new backend or API.
- Only `transform`, `opacity` and the SVG goo filter are animated. Added client JS target: under about 60 KB gzipped including `lenis`.
- Only new runtime dependency: `lenis`. Everything else uses the installed GSAP 3.15.
- Gobble stays the original four-lobed, tailless blob: `blobPath` in `lib/mascot.mjs` must not change. `Gobble` with no new props must render exactly as today.
- Palette comes from `lib/design-tokens.mjs` (cream, ink, acid, purple, accent, pond). Fonts: Bricolage Grotesque display, DM Sans body. New styles go in `app/intro-story.css`.
- Anchor order stays: hero, story, `.discovery-ribbon`, `#fresh-picks`, `#for-makers`. "Skip the tour", the hero's "Fresh stuff below", and the skip-to-content link all target `#fresh-picks`.
- Reduced motion, the existing "Pause motion" toggle, and low-powered devices (coarse pointer with 4 or fewer logical cores, or `deviceMemory` of 2 or less) get the static list, never the pin.
- Copy is accurate to the product: posting needs a photo or video and takes a website link for apps; every post is reviewed before it goes public; no promise of traffic or sales.
- The code must run in both `app/page.jsx` (server build) and `hosting/components.jsx` (static export, starts with `products = []`). No server-only imports in new files.
- Commit after each task and `git push origin main`. Commit messages carry no Co-Authored-By lines.

## Review Focus

1. Empty catalogue (`products = []`, and the static export's first paint): scene 2 shows the generic Gobble + "your thing?" ticket, never invented product names, and the page does not throw.
2. Reduced motion or "Pause motion" on: no pin, no spacer, all five scenes readable in order, nothing left half-animated; pausing mid-story leaves no stray inline styles.
3. Product preview dialog open: smooth scroll is stopped and body scroll is locked; closing restores both and the story position.
4. Resize or rotate while pinned, and products loading late in the static export: the scroll triggers refresh and the page never gets stuck or leaves a blank gap.
5. Keyboard and deep links: Tab order is unbroken, "Skip the tour" is reachable and works, loading `/#for-makers` or reloading mid-story lands in the right place.

---

### Task 1: Story data and decisions (pure logic) plus `lenis`

**Files:**
- Create: `lib/intro-story.mjs`
- Test: `tests/intro-story.test.mjs`
- Modify: `package.json` (add `lenis`)

**Interfaces:**
- Produces:
  - `scenes: Array<{ id: string, title: string, body: string, mood: 'calm'|'hungry'|'happy'|'surprised'|'wink', color: string }>`, exactly 5 items, ids `rabbit-hole`, `feed`, `stash`, `post`, `first-time`, titles from the spec's draft copy.
  - `pinMode(env: { reduceMotion: boolean, motion: boolean, coarsePointer: boolean, cores?: number, memory?: number }): 'pinned' | 'static'`
  - `sceneIndexAt(progress: number, count?: number): number` (progress 0..1, clamped, default count 5).

- [ ] **Step 1: Write failing tests** in `tests/intro-story.test.mjs`: `scenes has the five spec titles in order` (titles: "A better rabbit hole.", "Feed Gobble. Get a find.", "Peek. Save. Say something nice.", "Made a thing? Let it loose.", "Pehli baar? Perfect."); `no scene promises traffic or sales` (no /traffic|sales|guarantee/i in any title/body); `pinMode is static for reduced motion`, `static when motion is paused`, `static for coarse pointer with 4 cores`, `static when memory is 2`, `pinned for fine pointer with motion on`, `pinned for coarse pointer with 8 cores`; `sceneIndexAt clamps` (-1 → 0, 0 → 0, 0.999 → 4, 1 → 4, 2 → 4) and `sceneIndexAt splits evenly` (0.2 → 1, 0.4 → 2, 0.6 → 3, 0.8 → 4).
- [ ] **Step 2: Run** `node --test tests/intro-story.test.mjs`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `lib/intro-story.mjs` with the signatures above; `color` values come from `sitePalette` keys in `lib/design-tokens.mjs`. Install the dependency: `npm install lenis`.
- [ ] **Step 4: Run** the same command. Expected: all PASS.
- [ ] **Step 5: Commit and push** (`Add the intro story scenes and pin rules`).

### Task 2: Gobble expressions

**Files:**
- Modify: `lib/mascot.mjs` (add data only), `components/gobble.jsx`
- Test: `tests/intro-story.test.mjs` (add cases)

**Interfaces:**
- Consumes: `blobPath` from `lib/mascot.mjs` (unchanged).
- Produces: `expressions: Record<'calm'|'hungry'|'happy'|'surprised'|'wink', { mouth: { d?: string, ellipse?: { cx: number, cy: number, rx: number, ry: number } }, eyeScaleY: number }>`; `Gobble` gains optional prop `expression` (one of the keys). With no `expression`, output is identical to today, including the existing `hungry` boolean.

- [ ] **Step 1: Write failing tests**: `blobPath is unchanged` (assert equals the current literal string in `lib/mascot.mjs`); `expressions has the five moods`; `calm matches today's smile path` (calm mouth `d` equals `M37 63Q50 75 65 61`); `hungry matches today's open mouth` (ellipse cx 50, cy 65, rx 12, ry 10).
- [ ] **Step 2: Run** `node --test tests/intro-story.test.mjs`. Expected: new cases FAIL.
- [ ] **Step 3: Implement** the `expressions` map in `lib/mascot.mjs` and the `expression` prop in `components/gobble.jsx`; precedence: `expression` over `hungry` over default. Eyes keep their classes (`gobble-eye`, `gobble-pupil`) so the cursor-follow code still works.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit and push** (`Give Gobble a few moods`).

### Task 3: Static story markup, mounted in Launch

**Files:**
- Create: `components/intro-story.jsx`, `app/intro-story.css`
- Modify: `components/launch.jsx` (render `<IntroStory products={products} motion={motion} reduceMotion={reduceMotion} />` right after the hero `</section>`, before `.discovery-ribbon`)

**Interfaces:**
- Consumes: `scenes`, `pinMode` (Task 1); `Gobble` with `expression` (Task 2).
- Produces: default export `IntroStory({ products, motion, reduceMotion })` rendering `<section class="intro-story" id="how-it-works" aria-labelledby="intro-story-title">` containing a visually-hidden `<h2 id="intro-story-title">How tadgobble works</h2>` and five `<article class="story-scene" data-scene="{id}">` each with `h3` title, `p` body, a decorative `aria-hidden` illustration. Scene 2's illustration uses `products[0]?.name` when present, else the generic "your thing?" ticket. A "Skip the tour" link (`href="#fresh-picks"`, class `story-skip`) is in the DOM. Static layout: a calm vertical list of cards.

- [ ] **Step 1: Write the failing check** as a new Playwright script `scripts/intro-e2e.mjs` modelled on `scripts/launch-e2e.mjs` (seeded server on its own port), with a first check `no-JS HTML contains all five scene titles in order and the skip link` (fetch `/` with `javaScriptEnabled: false` context, assert the five titles' order and `a.story-skip[href="#fresh-picks"]`), and `empty catalogue renders the generic ticket` (start a second server without `SEED_CATALOG`). Add `"test:intro": "node scripts/intro-e2e.mjs"` to `package.json`.
- [ ] **Step 2: Run** `npm run build && npm run test:intro`. Expected: FAIL, scene titles not found.
- [ ] **Step 3: Implement** the component and CSS using Task 1 data; match the cream look and `launch.css` conventions.
- [ ] **Step 4: Run** `npm run build && npm run test:intro`. Expected: PASS.
- [ ] **Step 5: Commit and push** (`Add the five-scene intro story as readable content`).

### Task 4: Pinned scroll timeline and liquid transitions

**Files:**
- Modify: `components/intro-story.jsx`, `app/intro-story.css`

**Interfaces:**
- Consumes: `pinMode`, `sceneIndexAt`, `scenes[].color`; `motion`/`reduceMotion` props.
- Produces: when `pinMode(...) === 'pinned'`, the section is pinned by `ScrollTrigger` for about 450 viewport heights on desktop and about 350 on phones (`svh` units, `ignoreMobileResize` on), with a scrubbed GSAP timeline: a shared SVG goo filter (`<filter id="story-goo">`, blur plus colour matrix) on a layer of colour blobs that melt through the five `scene.color` values; each scene's title splits with `SplitText` and rises in; scene visibility toggles via a `data-active` attribute driven by `sceneIndexAt`. Everything is created inside one `gsap.context(...)` and reverted on cleanup. A small pause/play control and the "Skip the tour" link are visible while pinned.

- [ ] **Step 1: Add failing checks** to `scripts/intro-e2e.mjs` at 1440x900 with motion on: `story pins while scrolling` (the `.intro-story` pin-spacer exists and `.story-scene[data-active="true"]` changes from scene 1 to scene 5 as `scrollY` moves through the story), `scrolling back rewinds` (returns to scene 1 active), `skip lands on fresh picks` (click `.story-skip`, then `#fresh-picks` is in the viewport), `reduced motion has no pin` (new context with `reducedMotion: 'reduce'`: no pin-spacer, all five titles visible), `Pause motion mid-story reverts cleanly` (click the hero's motion control, assert no `.pin-spacer`, no leftover inline `transform` on `.story-scene`, no console errors).
- [ ] **Step 2: Run** `npm run test:intro`. Expected: new checks FAIL.
- [ ] **Step 3: Implement** the timeline, goo layer and controls. Call `ScrollTrigger.refresh()` when `products.length` changes (static export loads late) and on `resize`/`orientationchange`.
- [ ] **Step 4: Run** `npm run test:intro`. Expected: PASS. Also take screenshots of each scene at 1440x900 and 390x844 into `test-results/` and look at them.
- [ ] **Step 5: Commit and push** (`Pin the intro story and melt the scenes into each other`).

### Task 5: Scene illustrations that move

**Files:**
- Modify: `components/intro-story.jsx`, `app/intro-story.css`

**Interfaces:**
- Consumes: the timeline from Task 4 (each scene exposes its illustration root via `data-scene`); `Gobble` moods.
- Produces: scrubbed illustration animations: scene 1 tab/link tiles pile up then Gobble swallows the pile; scene 2 a ticket flies into Gobble's mouth (`hungry`) and a product card (name from `products[0]` if any) pops out; scene 3 a card opens, a bookmark fills with a confetti burst, a comment bubble types in; scene 4 a post ticket fills (image, title, link) and ends on an "In the review queue" receipt; scene 5 Gobble `wink`s with a "Fresh picks below" arrow. Gobble's mood follows `scenes[i].mood`. All illustrations stay `aria-hidden`.

- [ ] **Step 1: Add failing checks**: `each scene illustration changes between its start and end progress` (compare computed transform or opacity of a named child, e.g. `[data-part="ticket"]`, at two scroll positions), `scene 2 shows the first product's name when the catalogue is seeded`, `no console errors across a full scroll`.
- [ ] **Step 2: Run** `npm run test:intro`. Expected: FAIL.
- [ ] **Step 3: Implement** the five illustrations; use `Flip` for the ticket-to-card move and `MorphSVG` or plain path tweens for Gobble's squash and stretch between moods.
- [ ] **Step 4: Run** `npm run test:intro`. Expected: PASS; review screenshots of every scene at both sizes.
- [ ] **Step 5: Commit and push** (`Animate each scene of the intro story`).

### Task 6: Smooth scroll that respects the dialog

**Files:**
- Create: `components/use-smooth-scroll.js`
- Modify: `components/launch.jsx`

**Interfaces:**
- Produces: `useSmoothScroll({ enabled: boolean, paused: boolean })`. Creates a `lenis` instance only when `enabled` (motion on, pin mode allowed), drives it from `gsap.ticker`, syncs `ScrollTrigger.update`, stops it while `paused` (pass `paused={Boolean(preview)}` from `Launch`), and destroys it on disable/unmount. Hash links and `scrollTo` keep working.

- [ ] **Step 1: Add failing checks**: `opening a preview stops smooth scroll and locks the body`, `closing it restores scrolling at the same position`, `Page Down, Space and keyboard Tab still move the page`, `loading /#for-makers lands on the makers section`.
- [ ] **Step 2: Run** `npm run test:intro`. Expected: FAIL.
- [ ] **Step 3: Implement** the hook and wire it into `Launch`.
- [ ] **Step 4: Run** `npm run test:intro && npm run test:launch`. Expected: PASS.
- [ ] **Step 5: Commit and push** (`Smooth the home page scroll`).

### Task 7: Cursor blob and magnetic buttons

**Files:**
- Create: `components/use-cursor-fx.js`
- Modify: `components/launch.jsx`, `app/intro-story.css`

**Interfaces:**
- Produces: `useCursorFx({ enabled: boolean })`. When `enabled` and `(pointer: fine)` and `(hover: hover)` match, mounts a fixed, `aria-hidden`, pointer-events-none blob that eases behind the cursor, grows over `a, button`, and applies a small pull (a few px) to elements marked `data-magnetic` (the hero's primary and outline buttons, "Post your thing"). Fully removed on disable/unmount, never mounted on touch.

- [ ] **Step 1: Add failing checks**: `no cursor blob on a touch context`, `cursor blob appears and follows on a desktop context`, `cursor blob is gone after Pause motion`, `buttons stay clickable under the blob`.
- [ ] **Step 2: Run** `npm run test:intro`. Expected: FAIL.
- [ ] **Step 3: Implement** the hook; mark the target buttons with `data-magnetic`.
- [ ] **Step 4: Run** `npm run test:intro`. Expected: PASS.
- [ ] **Step 5: Commit and push** (`Add a liquid cursor and magnetic buttons`).

### Task 8: Whole-site verification and polish

**Files:**
- Modify: whatever the checks turn up; `README.md` (one line under "What's inside"); `docs/LAUNCH_QA.md` (record the run).

- [ ] **Step 1: Add final checks** to `scripts/intro-e2e.mjs`: phone 390x844 full scroll with no horizontal overflow; low-powered device emulation (`hardwareConcurrency` 4 on a coarse-pointer context) gets the static list; layout-shift total stays under 0.1 (reuse the CLS observer from `scripts/launch-e2e.mjs`); resize 1440→390 while pinned leaves no gap and no console errors.
- [ ] **Step 2: Run** `npm run test:intro`. Fix anything that fails.
- [ ] **Step 3: Run the full regression**: `npm test`, `npm run test:launch`, `npm run build:hosting`. Expected: all pass and the static export is produced. Then serve it (`npm run preview:hosting`) and confirm the intro works with products loading late.
- [ ] **Step 4: Measure and record**: gzipped size of the added JS against the 60 KB target; note any miss in `docs/LAUNCH_QA.md`.
- [ ] **Step 5: Look at the screenshots** of all scenes (phone and desktop) and fix anything that looks off; then commit and push (`Check the intro story across phone, desktop and the static export`).
