# Tadgobble: design direction

## Current: the Highlighter look (November 2026)

tadgobble is India's home for new makers. The page is dark violet with one highlighter yellow, so the newest work and the "Post your thing" action are the brightest things on screen. The full spec is [the Highlighter look design](superpowers/specs/2026-11-03-highlighter-look-design.md).

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

Type: Bricolage Grotesque 700–800 for headlines, DM Sans for descriptions and controls. Body copy stays under 65 characters per line.

Home page, top to bottom:

1. **Header**, with a yellow "Post your thing" button.
2. **Hero:** a yellow block reading "Fresh from first-timers.", with Gobble beside it.
3. **Fresh today:** a grid of the newest work, up to 12 cards, with a "new" badge on anything posted in the last few days and a link to see everything.
4. **The snack machine**, restyled for the dark page.
5. **The "Made a thing?" poster**, with a "Post your thing" button.
6. **Footer.**

Motion: reduced motion means static; animations last about 0.5s or less; no cursor effects on touch.

## Previous look: full visual rebuild (October 2026)

Kept as a record. None of the palette, poster or drawer layout below is current.

The brief is a replacement of the page structure, not a refinement of the rejected grid or pond. Keep the original tailless blob, real catalog, and account flows. Remove the old split serif hero, pond, pinned snack-card sequence, browser-window maker section, and palette picker.

### Direction before implementation

An oversized internet snack shop: a typographic poster opens the page; colorful, full-width product drawers turn discovery into opening a new toy.

Core palette: Butter `#F9F4A7`, Plum `#39245A`, Tangerine `#FF7547`, Lavender `#C5B5F5`, Sky `#BFDCF5`, Blob lime `#D5F568`. White is a functional paper surface inside demonstrations. Colors organize whole sections and products, not decorative gradient washes.

Type: Bricolage Grotesque 700–800 for large, tightly set poster headlines and product names; DM Sans for readable descriptions and controls. No italic-serif headline treatment. Headers are left aligned or deliberately fill the full poster width. Body copy remains below 65 characters per line.

Concept A: a horizontal product carousel, one huge product at a time.

```
LOGO                     discover / saved / submit
                 GOOD FINDS.
          intro / 3D blob / tiny aside
-------------------------------------------------
<     PRODUCT NAME     [large demo scene]         >
      copy / link      [whole stage recolors]
-------------------------------------------------
                 maker poster
```

Concept B (chosen): a full-width product drawer stack with interactive editorial scenes; all product names stay in the document and scanning stays easy.

```
LOGO                     discover / saved / submit
                 GOOD FINDS.
          intro / 3D blob / tiny aside
=================================================
Find your next fixation.       search / audience
-------------------------------------------------
Tally                                      open
  what it does / link     [playable form artwork]
-------------------------------------------------
Excalidraw                                 open
-------------------------------------------------
Photopea                                   open
-------------------------------------------------
...each product has its own full-width color...
=================================================
    MADE A THING?                 [giant asterisk]
    LET IT LOOSE.                 submit / explain
=================================================
                    tadgobble.
```

Review: Concept A is visually strong but hides the rest of the catalog. Concept B better fits useful discovery, survives without JavaScript, and replaces both rejected showcase formats. A typical equal-card grid and decorative dashboard HUD were excluded. The memorable device is the colorful product drawer, with small real interactions illustrating each tool's purpose. The mascot retains its original identity.

Motion: one poster entrance, scroll-driven title drift and a typographic ribbon, native-feeling product expansion, action-driven demo responses. No forced multi-screen scroll pin. Reduced motion and an explicit pause switch remain supported.

Mascot correction: the user prefers the purple, lobed SVG Gobble shown before the old WebGL scene loaded. Keep that character permanently, at the same size and position, on its lavender disc. The comparison is `[purple Gobble -> unrelated square 3D character]` versus `[purple Gobble -> the same purple Gobble]`; use the latter. Preserve the current butter/plum/lavender palette and typography. Booping squashes this same silhouette; feeding moves the adjacent product ticket into its mouth before opening the real product preview. Do not replace the mascot after hydration or load WebGL for it.

### Reference research

Reviewed the first two pages of the supplied [Awwwards collection](https://www.awwwards.com/mireia_ortega/collections/color-palettes-websites/) and downloaded public preview videos for local analysis. No reference artwork is shipped.

- [Clar background color scrolling](https://www.awwwards.com/inspiration/clar-background-color-scrolling): full-width color as page architecture.
- [Bennett Tea product page](https://www.awwwards.com/inspiration/bennett-tea-color-palette-product-page): product-scale visuals and surrounding color.
- [Carnival with Spotify](https://www.awwwards.com/inspiration/carnival-with-spotify-colorful-hover-interaction): playful expressive typography and action-driven geometry.
- [Blob Mixer](https://www.awwwards.com/sites/blob-mixer): character as an interactive object.

Apply those principles through Tadgobble's own content, layouts, illustrations, and tailless mascot; do not copy reference screens.
