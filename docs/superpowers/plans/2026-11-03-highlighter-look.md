# Highlighter Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every tadgobble page in the dark, high-contrast A2 "Highlighter" palette, and rebuild the home page around fresh work from first-timers.

**Architecture:**
- One token set in `lib/design-tokens.mjs` becomes CSS variables on `:root` in `app/globals.css`.
- Every stylesheet uses those variables only. A small checker script enforces this, and a unit test runs it.
- The home page (`components/launch.jsx`) gets a new hero and a fresh-work grid. It loses the "GOOD FINDS." poster, the ribbon and the drawers.
- No database, API or behaviour changes.

**Tech Stack:** Next.js 16 (App Router, JSX, plain CSS files), React 19, GSAP 3.15, `node:test`, Playwright e2e scripts in `scripts/`, sharp for brand assets.

**Spec:** `docs/superpowers/specs/2026-11-03-highlighter-look-design.md`

## Global Constraints

- Palette (exact values; the AA-safe text variants were computed against the spec's mockup colours):

  | Token | Value | Use | Contrast check |
  |---|---|---|---|
  | `bg` | `#160b26` | body | |
  | `surface` | `#22133a` | cards, panels, inputs | |
  | `text` | `#f6f1ff` | main text | 17.1:1 on bg |
  | `muted` | `#b8a9d6` | secondary text | 8.7:1 on bg |
  | `line` | `#3a2a55` | borders | non-text |
  | `yellow` | `#ffe600` | the highlight | |
  | `onYellow` | `#160b26` | text on yellow | 14.9:1 |
  | `violet` | `#7b4dff` | fills only (active tab, `mark`) | white on it 4.8:1 |
  | `violetText` | `#a98bff` | violet links and text | 7.1:1 |
  | `lilac` | `#c5b5f5` | Gobble | |
  | `orange` | `#ff7547` | sparingly | 7.1:1 |
- Yellow appears only in four places: the home hero block, the primary "Post your thing" button, "new" badges, and focus rings.
- The site is dark only. Don't add a light theme or a toggle.
- Fonts stay Bricolage Grotesque (display) and DM Sans (body). Gobble stays lilac `#c5b5f5`.
- Motion: reduced motion means static, about 0.5s or less, no cursor effects on touch.
- Read `node_modules/next/dist/docs/` before Next-specific code. `viewport.themeColor` is documented in `01-app/03-api-reference/04-functions/generate-viewport.md`.
- No database, API or schema changes. Don't run `supabase db push`. Don't deploy; the owner runs `npm run deploy:hosting`.
- Never use real user data in screenshots, fixtures or marketing images.
- Commits: no Claude attribution lines. Push to `origin main` after every commit.

## Review Focus

1. **A page nobody opened.** Every route has to be in the new palette, including `/terms`, `/privacy`, `/settings`, `/welcome`, `/studio`, `/my-work`, empty states, dialogs and dropdowns. Task 6 visits and screenshots every route.
2. **Browser-default form controls on dark.** Inputs, selects, checkboxes and native dropdown lists need dark backgrounds and readable text. Set `color-scheme: dark` on `:root` (Task 2).
3. **Dark avatars disappearing.** An avatar in "Gobble purple" `#39245a` on `#160b26` is only 1.4:1 contrast, so it needs an outline. Pinned by a test in Task 4.
4. **Home with zero or one product.** Fresh grid empty state: the copy "Nothing fresh yet. Be the first." and a link to `/discover?submit=1`. Pinned by the launch e2e in Task 3.
5. **Bad `created_at` values.** `isNew` must return `false`, not throw, for a missing date, an invalid date or a future date. Pinned by a unit test in Task 1.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/design-tokens.mjs` | Palette tokens, `paletteStyle`, `contrastRatio()` |
| `lib/fresh.mjs` (new) | `isNew()` and `freshProducts()` for the home grid |
| `scripts/check-colors.mjs` (new) | Lists stray hex colours in `app/*.css` outside `:root` |
| `tests/brand.test.mjs` (new) | Tokens, contrast, `isNew`/`freshProducts`, the colour checker, avatar outline |
| `app/*.css` | Restyled to use variables only |
| `components/launch.jsx`, `app/launch.css` | New home page |
| `components/story-card.js`, `scripts/brand-assets.mjs`, `app/icon.svg`, `public/social-card.png`, `app/layout.jsx`, `lib/brand.mjs`, `lib/blob-options.mjs`, `components/blob-avatar.jsx` | Off-site images, icons, metadata, avatar outline |
| `README.md`, `docs/BRAND.md`, `docs/DESIGN_DIRECTION.md` | Docs that describe the old look |

---

### Task 1: Tokens, contrast helper and fresh helpers

**Files:**
- Modify: `lib/design-tokens.mjs`
- Create: `lib/fresh.mjs`
- Test: `tests/brand.test.mjs`

**Interfaces:**
- Produces:
  - `sitePalette` with exactly the keys `bg, surface, text, muted, line, yellow, onYellow, violet, violetText, lilac, orange`
  - `paletteStyle` (each key becomes `--<kebab-key>`, e.g. `--on-yellow`, `--violet-text`)
  - `contrastRatio(a: string, b: string): number` (WCAG 2.1, hex `#rrggbb`)
  - `isNew(createdAt: string | undefined, now?: number): boolean`: true when within the last 7 days and not in the future
  - `freshProducts(products: object[]): object[]`: a new array sorted by `created_at` descending, ignoring `featured`
  - Keep `productTints` exported, with the same keys and darkened values (see Step 3).

- [ ] **Step 1: Write the failing tests** in `tests/brand.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { sitePalette, paletteStyle, contrastRatio } from '../lib/design-tokens.mjs';
import { isNew, freshProducts } from '../lib/fresh.mjs';

const DAY = 86400000, NOW = Date.parse('2026-11-03T12:00:00Z');

test('palette is the Highlighter set', () => {
  assert.equal(sitePalette.bg, '#160b26');
  assert.equal(sitePalette.yellow, '#ffe600');
  assert.equal(sitePalette.violet, '#7b4dff');
  assert.equal(paletteStyle['--on-yellow'], '#160b26');
  assert.equal(paletteStyle['--violet-text'], '#a98bff');
});
test('text pairs meet WCAG AA', () => {
  const p = sitePalette;
  for (const [fg, bg] of [[p.text, p.bg], [p.text, p.surface], [p.muted, p.bg], [p.muted, p.surface],
    [p.onYellow, p.yellow], [p.violetText, p.bg], [p.violetText, p.surface], ['#ffffff', p.violet], [p.orange, p.bg]])
    assert.ok(contrastRatio(fg, bg) >= 4.5, `${fg} on ${bg}`);
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
});
test('isNew', () => {
  assert.equal(isNew(new Date(NOW - 2 * DAY).toISOString(), NOW), true);
  assert.equal(isNew(new Date(NOW - 8 * DAY).toISOString(), NOW), false);
  assert.equal(isNew(new Date(NOW + DAY).toISOString(), NOW), false);
  assert.equal(isNew(undefined, NOW), false);
  assert.equal(isNew('not a date', NOW), false);
});
test('freshProducts sorts newest first and ignores featured', () => {
  const list = [{ slug: 'a', created_at: '2026-10-01T00:00:00Z', featured: 1 },
                { slug: 'b', created_at: '2026-11-01T00:00:00Z', featured: 0 }];
  assert.deepEqual(freshProducts(list).map((p) => p.slug), ['b', 'a']);
  assert.equal(list[0].slug, 'a'); // input not mutated
});
```

- [ ] **Step 2: Run `node --test tests/brand.test.mjs`.** It should FAIL (`lib/fresh.mjs` doesn't exist yet).
- [ ] **Step 3: Implement.**
  - Replace `sitePalette` with the Global Constraints values.
  - `paletteStyle` converts camelCase keys to kebab-case.
  - Change `productTints` values to dark-friendly tints with the same keys (`rose, lilac, mint, lime, peach, blue`). Text drawn on them must still pass `contrastRatio(onYellow, tint) >= 4.5`, so keep them light pastel; they're used as cover-art backgrounds.
  - Write `lib/fresh.mjs`.
- [ ] **Step 4: Run `node --test tests/brand.test.mjs`.** It should PASS. Then run `npm test`; all existing tests should pass.
- [ ] **Step 5: Commit** with "Add the Highlighter palette tokens and fresh-work helpers", then push.

### Task 2: Global variables and the colour checker; restyle the shared stylesheets

**Files:**
- Create: `scripts/check-colors.mjs`
- Modify: `app/globals.css`, `app/motion.css`, `app/dropdown.css`, `app/legal.css`, `components/platform.jsx:229`, `components/launch.jsx:205`
- Test: `tests/brand.test.mjs`

**Interfaces:**
- Consumes: `paletteStyle` (Task 1).
- Produces: `findStrayColors(files: string[]): {file: string, line: number, value: string}[]` exported from `scripts/check-colors.mjs`.
  - It flags every `#hex`, `rgb(`, `rgba(` or named colour (`white`, `black`) in a CSS file.
  - It skips lines inside the `:root { … }` block of `app/globals.css`, and any line ending in `/* art */`.
  - Running it as a CLI prints the matches and exits 1 if there are any.
- Produces: CSS custom properties on `:root` named exactly as the `paletteStyle` keys. All later tasks use only these.

- [ ] **Step 1: Write the failing tests.**
  - Unit: `findStrayColors` on a temp file containing `a{color:#fff}\nb{color:var(--text)}\nc{background:#abc /* art */}` should return exactly one match, at line 1.
  - Gate: `findStrayColors(['app/globals.css','app/motion.css','app/dropdown.css','app/legal.css'])` should return `[]`.
- [ ] **Step 2: Run `node --test tests/brand.test.mjs`.** The unit test should fail because the module is missing.
- [ ] **Step 3: Implement the checker.** Then rewrite the `:root` block of `app/globals.css` to declare every token from `sitePalette`, keeping the same names and values. Also:
  - add `color-scheme: dark` to `:root`
  - keep `--font`
  - drop the old `--ink/--paper/--forest/--rose/--lime` names once nothing uses them

  Convert the four files to `var(--…)` only:
  - Body background `var(--bg)`, text `var(--text)`.
  - Inputs, selects and textareas: background `var(--surface)`, border `var(--line)`.
  - Focus rings: `outline: 3px solid var(--yellow)`.
  - For translucent shades use `color-mix(in srgb, var(--text) 20%, transparent)`, not hex with alpha.
  - Remove `style={paletteStyle}` from `platform.jsx` and `launch.jsx`; `:root` now covers every route.
- [ ] **Step 4: Run `node --test tests/brand.test.mjs`.** It should PASS. Then run `npm test` and `npm run build`; both should pass.
- [ ] **Step 5: Commit** with "Move site colours onto Highlighter variables", then push.

### Task 3: New home page

**Files:**
- Modify: `components/launch.jsx`, `app/launch.css`, `components/snack-machine.jsx` (frame and labels only), `scripts/launch-e2e.mjs`
- Test: `scripts/launch-e2e.mjs`, `tests/brand.test.mjs` (gate on `app/launch.css`)

**Interfaces:**
- Consumes: `isNew`, `freshProducts` (Task 1); CSS variables (Task 2).
- Produces: none.

**The new home page, top to bottom:**

1. **Header:** keep it. The submit link's text becomes `Post your thing` (aria-label `Post your thing`), styled with a yellow background and `--on-yellow` text.
2. **Hero:** `section.fresh-hero`, the yellow block.
   - `h1` contains `Fresh from <mark>first-timers.</mark>` (`mark` uses a violet fill and white text).
   - Sub-line: `India's newest makers, posting their first things. Go say something nice.`
   - Gobble (`<Gobble>` inside a `button.gobble-character` with the existing boop behaviour and captions) sits in the hero.
   - Delete the "Feed me a find" button, the `feed` function and the `.gobble-snack` link.
3. **Fresh grid:** `section#fresh-picks.fresh-grid` on the dark body.
   - Heading `Fresh today`, styled as the active pill. No Rising or Gobble's picks tabs yet (they arrive in project 2).
   - Up to 12 cards from `freshProducts(products)`, each with:
     - a 2px `--text` outline
     - the cover (reuse `productSceneColor`)
     - the name
     - `owner_name` (no city yet)
     - a yellow `new` badge when `isNew(p.created_at)`
   - Clicking a card opens the existing preview dialog (`openPreview`).
   - When there are no products, show the copy `Nothing fresh yet. Be the first.` and a link `Post your thing` to `/discover?submit=1`.
   - A `See everything` link goes to `/discover`.
4. **Snack machine:** in its own `section.snack-section`, restyled for dark (frame `--surface`, outline `--text`). Keep the category gumball colours; they're art and get `/* art */` markers.
5. **The `.maker-poster` section:** keep it, restyled. Its button text becomes `Post your thing`.
6. **Footer:** keep it. The tagline text stays.
7. **Removed:** `.poster-hero`, `.discovery-ribbon` and `<ProductShowcase>` from home, and the `ProductShowcase` default import. `ProductDemo` and `productSceneColor` stay, because `platform.jsx` and `showcase.jsx` use them. Delete the CSS rules for removed classes.

- [ ] **Step 1: Rewrite the home assertions in `scripts/launch-e2e.mjs`** (around lines 74–160). The drawer and "Feed me a find" checks move to the Discover-only flows or are deleted with the feature. The new checks:
  - `h1` text equals `Fresh from first-timers.`
  - `.product-drawer` count is 0, `.discovery-ribbon` count is 0, and no `h1` contains `GOOD FINDS`
  - `.fresh-grid article` count equals `min(products, 12)`, and the first card is the newest by `created_at`
  - clicking the first card opens the dialog with the matching title, and focus returns to the card on close
  - boop still cycles the captions (`excellent boop`, `besties`)
  - `getComputedStyle(document.body).backgroundColor` is `rgb(22, 11, 38)`
  - with an empty catalog (the script's empty-data run, or a new run with `SEED_CATALOG=false`), the text `Nothing fresh yet. Be the first.` is visible
  - with `reducedMotion: 'reduce'`, the snack machine and Gobble render static
  - Add `app/launch.css` to the colour-checker gate list in `tests/brand.test.mjs`.
- [ ] **Step 2: Run `npm run test:launch` and `node --test tests/brand.test.mjs`.** Both should FAIL on the old home page.
- [ ] **Step 3: Implement the layout above** in `components/launch.jsx` and `app/launch.css`. GSAP intro: at most a 0.5s fade-up of the hero, and nothing under reduced motion.
- [ ] **Step 4: Run `npm run test:launch`, `node --test tests/brand.test.mjs` and `npm run build`.** All should pass. Save screenshots of the home page at 390px and 1440px in `test-results/` and look at them.
- [ ] **Step 5: Commit** with "Rebuild the home page around fresh work from first-timers", then push.

### Task 4: Restyle the remaining pages, avatars and off-site images

**Files:**
- Modify: `app/catalog.css`, `app/creators.css`, `app/creator-studio.css`, `app/submission.css`, `app/showcase.css`, `app/covers.css`, `app/video-posts.css`, `app/blob-onboarding.css`
- Modify: `components/blob-avatar.jsx`, `lib/blob-options.mjs`, `components/story-card.js`, `components/motion.jsx`, `scripts/brand-assets.mjs`, `app/layout.jsx`, `lib/brand.mjs`
- Regenerate: `app/icon.svg`, `public/social-card.png` (`app/icon.jpg`: re-export from the new svg with sharp)
- Test: `tests/brand.test.mjs`, existing e2e scripts

**Interfaces:**
- Consumes: CSS variables (Task 2), `sitePalette`, `contrastRatio` (Task 1).
- Produces: `needsOutline(hex: string): boolean` exported from `lib/blob-options.mjs`. It returns true when `contrastRatio(hex, sitePalette.bg) < 3`.

**Changes:**
- **Every listed stylesheet:** variables only. Cover and art backgrounds get `/* art */` markers.
- **Primary submit buttons** across Discover, Studio and the submit wizard are labelled `Post your thing`. Other copy stays as it is.
- **Avatars:** `blob-avatar.jsx` adds a 2px `var(--text)` stroke to the blob path when `needsOutline(color.hex)`. Users' saved colours are unchanged.
- **Story card** (`components/story-card.js`):
  - background `sitePalette.bg`, main text `sitePalette.text`, the highlight band `sitePalette.yellow` with `onYellow` text
  - import from `lib/design-tokens.mjs`; no hex literals except Gobble's eyes
- **`scripts/brand-assets.mjs`:**
  - Social card: `bg` background, a yellow top band holding `tadgobble`, the headline `Fresh from first-timers.`, the sub-line `India's newest makers. Go say something nice.`, and lilac Gobble.
  - Icon: a rounded `bg` square with lilac Gobble.
  - Remove the "GOOD FINDS." and "OPEN ANOTHER TAB" text.
- **Confetti** in `components/motion.jsx:220`: swap `#39245a` (invisible on dark) and `#f9f4a7` for `sitePalette.yellow` and `sitePalette.violetText`.
- **Video frames:** `lib/render.mjs` and `lib/videos.mjs` have no old palette colours (checked), so they need no change.
- **`app/layout.jsx`:** `export const viewport = { themeColor: '#160b26' }`, plus `colorScheme: 'dark'` if the Next docs list it.
- **`lib/brand.mjs` `description`:** `India's home for new makers: art, design, photos and useful apps. Post your first thing. No portfolio required.`

- [ ] **Step 1: Write the failing tests.**
  - Gate: extend the colour-checker gate to every `app/*.css`; it should return `[]`.
  - Avatars: `needsOutline('#39245a') === true`, `needsOutline('#f2df65') === false`.
  - Brand: `brand.description` matches `/India/` and doesn't match `/zine|font/i`.
- [ ] **Step 2: Run `node --test tests/brand.test.mjs`.** It should FAIL.
- [ ] **Step 3: Implement the changes above.** Then run `node scripts/brand-assets.mjs` and look at `public/social-card.png` and `app/icon.svg`.
- [ ] **Step 4: Run these; all should pass:**
  - `node --test tests/brand.test.mjs`
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`, `npm run test:submission`, `npm run test:creators`, `npm run test:covers`, `npm run test:videos`

  If an e2e fails only because of a renamed button label (`Post your thing`) or the `rgb()` values in `covers-e2e.mjs`, update that assertion to the new value. Any other failure is a bug.
- [ ] **Step 5: Commit** with "Restyle every page, avatar and share image in the Highlighter palette", then push.

### Task 5: Docs

**Files:**
- Modify: `README.md` (line 15 and the second "zines, fonts" mention), `docs/BRAND.md`, `docs/DESIGN_DIRECTION.md`

- [ ] **Step 1: Run `grep -rniE "zines|fonts, tiny|GOOD FINDS|OPEN ANOTHER TAB|cream|#f9f4a7" README.md docs/BRAND.md docs/DESIGN_DIRECTION.md`.** Every hit is out of date.
- [ ] **Step 2: Rewrite those passages to match the spec.**
  - README: Discover shows "paintings, illustration, photos, design and useful apps".
  - BRAND.md and DESIGN_DIRECTION.md: the Highlighter palette table (copied from Global Constraints), the yellow-only-in-four-places rule, dark only, India-first kept subtle, and the new home page order.
- [ ] **Step 3: Rerun the grep.** There should be no hits, except historical mentions clearly marked as "previous look".
- [ ] **Step 4: Commit** with "Update the brand docs for the Highlighter look", then push.

### Task 6: Whole-site check

**Files:**
- Create: `scripts/look-check.mjs` (Playwright; same launch pattern as `scripts/launch-e2e.mjs`)

- [ ] **Step 1: Write `scripts/look-check.mjs`.**
  - Visit `/`, `/discover`, a `/product/<slug>`, a `/profile/<username>`, `/studio`, `/my-work`, `/settings`, `/welcome`, `/privacy` and `/terms`, at 390px and 1440px.
  - Screenshot each into `test-results/look/`.
  - Assert that `body` background is `rgb(22, 11, 38)` on each page, and that no element with visible text has computed `background-color` `rgb(249, 244, 167)` (the old cream).
  - Open the submit dialog and one dropdown, and screenshot those too.
- [ ] **Step 2: Run `node scripts/look-check.mjs`.** It should PASS. Look at every screenshot for unreadable text, white native controls and invisible avatars, and fix anything found in the owning stylesheet.
- [ ] **Step 3: Run the full suite** (`npm test`, `npm run build`, and the e2e scripts from Task 4 Step 4). Everything should pass.
- [ ] **Step 4: Commit** with "Add a whole-site look check", then push. Tell the owner the site is ready to review locally with `npm run dev`. Don't deploy.
