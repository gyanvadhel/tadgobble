# Third-party notices

The avatar picker uses [Blobatar by Alain](https://github.com/Alain00/blobatar),
with `blobatar` and `@blobatar/react` pinned to 2.7.0. Both are MIT licensed.
The complete copyright and licence notice is retained in
[`public/licenses/blobatar.txt`](public/licenses/blobatar.txt) and ships with the site.

Tadgobble adds its own palette, smile, original Gobble option, controls and setup
flow. Avatar rendering runs within the application; it does not call Blobatar's
hosted avatar API or use account email addresses as seeds.

The site's motion (letter drops, card glides, scroll effects, the save burst and
the draggable makers row) uses [GSAP](https://gsap.com) 3.15.0 and `@gsap/react`
2.1.2 by GreenSock, under GSAP's standard no-charge licence
(https://gsap.com/standard-license). It runs in the browser and makes no network calls.
