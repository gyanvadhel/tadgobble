# Short video posts

Use the existing photo-first form, profile masonry, plum/butter controls, and Gobble.
Add a separate, labelled video upload button beside the photo button. Preserve photo
uploads and avatar behaviour. A generated cover frame and duration identify video
posts without fetching video data. Tapping the cover in work details or admin review
opens an inline player with native controls; no autoplay in galleries.

Keep media private until publication. A video belongs to one uploaded poster cover,
so replacing/removing the cover also changes the associated clip. Ownership and
moderation continue to follow that cover. Avatars remain still images.

Initial policy: 30 seconds, 5 MiB stored video, originals up to 100 MiB for browser
compression. Policy constants live in `supabase/functions/_shared/video.mjs` and are
shared by browser, local backend and Edge validation. Tightening the duration later
does not break playback of existing approved clips. Resize/transcode on supported
browsers, preserve audio, and provide export guidance when a codec is unsupported.

Cloud uploads use an authenticated Edge Function which reads the actual container,
duration, dimensions, codec and bytes before writing private Storage objects. Browser
claims alone cannot approve a video. No transcoding server or paid service is added.
Videos load on explicit play; signed playback links are obtained at that time.

Verify short portrait/landscape clips, compression, audio, generated posters, metadata
spoofing, oversized/overlong files, ownership, private/public transitions, seek ranges,
avatar restrictions, cancellation and the existing image workflow. Exercise local and
static hosting, including the live Edge upload with disposable private fixtures.
