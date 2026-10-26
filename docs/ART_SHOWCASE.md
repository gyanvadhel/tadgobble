# Share something you made

Art and design can be shared with an image and a title. A website, portfolio,
price, and marketing copy are not required. Apps retain their website link.
All submissions remain private until reviewed. Existing listings keep their type.

## Design plan

- Plum `#39245a`: type, focus rings, primary action.
- Paper `#fffdf8`: quiet form surface.
- Butter `#faf5ad`: the photo mounting area.
- Lavender `#c5b5f5`: selected controls and small decorative tape.
- Muted plum `#665578`: supporting text with readable contrast.
- White `#ffffff`: inputs and the image mat.

Bricolage Grotesque gives the title its familiar Tadgobble character; DM Sans
keeps labels, instructions, and entered text clear. Retain the original blob.
The memorable element is a small studio pinboard: the actual work on a paper
mat, with a strip of tape. No artificial crop, decorative dashboard, or progress
wizard. The work itself supplies the color.

Desktop:

```text
Share something you made.                  close
[ Art & design ] [ App or tool ]
┌───────────────────────┬─────────────────────────┐
│                       │ Title                   │
│   photo / artwork     │ [                       ]│
│   (whole image)       │                         │
│                       │ > More details (optional)│
│ [Add a photo]         │ □ This is my work…      │
│ formats / size        │ [Send for review →]     │
└───────────────────────┴─────────────────────────┘
```

Mobile stacks these in reading order. Keep controls at least 44 px tall, use
native inputs and an accessible disclosure, support keyboard file selection,
associate errors with fields, announce uploading/success, and honor reduced
motion. The optional section holds a short story, creative category, accessible
image description, and optional link. App-specific fields appear only in app mode.

## Implementation and review

Store the type in `submission_details.kind` (`art` / `app`); older listings are
apps. Compress uploaded images to WebP within 1600 × 1600 without cropping or
upscaling. Preserve the existing website screenshot format. A single image per
work keeps this first release simple and uses the existing storage and review
system; it adds no paid service. New types do not modify existing public work.

Check no-link submissions, ownership and review controls, portrait image
preservation, both form modes, keyboard operation, and mobile overflow before
deployment. The intended flow is image → title → review, with details optional.
