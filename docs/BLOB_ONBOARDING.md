# Your little Gobble

Use Alain00/blobatar (MIT), pinned to 2.7.0, rendered on the device. Keep the
original tailless Gobble as one selectable face. Its new friends have cloud,
pebble and round bodies, expressive eyes and a small Tadgobble smile. No external
avatar API, email-derived seeds, image uploads or storage objects for blobs.

Palette: plum #39245a, lavender #c5b5f5, butter #f9f4a7, paper #fffef6,
pond #234638, orange #ff7949. Keep Bricolage Grotesque for the expressive headings
and DM Sans for labels and readable body copy. Reuse the existing button language.

Desktop layout: a large character stage beside a compact two-step setup.

    [ Tadgobble                                      Skip for now ]
    [                                               ]
    [    large selected Gobble    |  1 Your blob      ]
    [    short character caption |  2 A little you   ]
    [                            |  controls / form ]
    [                            |  Back / Continue ]

On a phone the character preview sits above the controls, without a fixed-height
viewport or scroll trap. Selection changes animate the character only; respect
reduced motion. Keyboard-visible focus and 44px targets throughout. Keep the form
left-aligned and the character centred.

The memorable element is the character, not a wall of onboarding cards. Revise
the generic wizard pattern into a dressing room: body thumbnails, named colour
swatches, expressions, and a surprise-me button. Photo selection is an equal
option. Step two asks for name/username and optional intent/interests, with no
claims of algorithmic personalisation. Everything remains editable in Settings.

New accounts get setup after authentication, preserving the requested return
page. Skip persists so it never nags. Existing users are marked complete during
migration and can open setup from Settings. Interests and intent are private;
only the chosen blob appears on the public profile. Validate all options on both
backends. Profile photos still use existing ownership/visibility rules.

Remove deletion from the quick account menu. Keep a clearly labelled collapsed
Delete account section at the bottom of Settings, retaining final confirmation
and the admin-account restriction.

Check local and cloud signup/sign-in routing, saved selections after reload,
photo/blob switching, public privacy, malformed values, skipped setup, return-URL
safety, mobile/keyboard/reduced-motion layouts, and deletion placement. Do not
delete real accounts or publish test content.
