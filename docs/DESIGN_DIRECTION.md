# Tadgobble: full visual rebuild

The brief is a replacement of the page structure, not a refinement of the rejected grid or pond. Keep the original tailless blob, real catalog, and account flows. Remove the old split serif hero, pond, pinned snack-card sequence, browser-window maker section, and palette picker.

## Direction before implementation

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

## Reference research

Reviewed the first two pages of the supplied [Awwwards collection](https://www.awwwards.com/mireia_ortega/collections/color-palettes-websites/) and downloaded public preview videos for local analysis. No reference artwork is shipped.

- [Clar background color scrolling](https://www.awwwards.com/inspiration/clar-background-color-scrolling): full-width color as page architecture.
- [Bennett Tea product page](https://www.awwwards.com/inspiration/bennett-tea-color-palette-product-page): product-scale visuals and surrounding color.
- [Carnival with Spotify](https://www.awwwards.com/inspiration/carnival-with-spotify-colorful-hover-interaction): playful expressive typography and action-driven geometry.
- [Blob Mixer](https://www.awwwards.com/sites/blob-mixer): character as an interactive object.

Apply those principles through Tadgobble's own content, layouts, illustrations, and tailless mascot; do not copy reference screens.
