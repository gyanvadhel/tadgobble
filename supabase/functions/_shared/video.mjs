export const VIDEO_POLICY = Object.freeze({
  seconds: 30,
  bytes: 5 * 1024 * 1024,
  sourceBytes: 100 * 1024 * 1024,
  posterBytes: 512 * 1024,
});
export const videoFile = (file) =>
  !!file && (/^video\//i.test(file.type) || /\.(mp4|m4v|mov|webm)$/i.test(file.name || ''));

// Uses container/packet metadata, never client-supplied duration or MIME claims.
export async function inspectVideo(file, media, { source = false } = {}) {
  if (
    !file ||
    file.size < 24 ||
    file.size > (source ? VIDEO_POLICY.sourceBytes : VIDEO_POLICY.bytes)
  )
    throw new Error(
      source
        ? 'Choose a video under 100 MB. We will try to compress it.'
        : 'The prepared video must be under 5 MB. Export a smaller clip and try again.',
    );
  const input = new media.Input({
    source: new media.BlobSource(file),
    formats: [media.MP4, media.QTFF, media.WEBM],
  });
  try {
    const tracks = await input.getVideoTracks();
    const audio = await input.getAudioTracks();
    if (tracks.length !== 1 || audio.length > 1)
      throw new Error('Choose a video with one picture track and at most one audio track.');
    const track = tracks[0];
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0 || duration > VIDEO_POLICY.seconds + 0.1)
      throw new Error(
        `Keep your clip to ${VIDEO_POLICY.seconds} seconds or less. Trim it in your Photos app, then try again.`,
      );
    const width = track.displayWidth,
      height = track.displayHeight;
    if (!(width >= 16 && height >= 16 && width <= 8192 && height <= 8192))
      throw new Error('This video has unsupported dimensions.');
    const format = await input.getFormat();
    const mime = format === media.WEBM ? 'video/webm' : 'video/mp4';
    if (
      !source &&
      (format === media.QTFF ||
        (mime === 'video/mp4'
          ? track.codec !== 'avc' || audio.some((t) => t.codec !== 'aac')
          : !['vp8', 'vp9'].includes(track.codec) || audio.some((t) => t.codec !== 'opus')) ||
        width > 1920 ||
        height > 1920)
    )
      throw new Error(
        'Export an MP4 using H.264/AAC or a WebM using VP8/VP9 and Opus, at 1080p or below.',
      );
    return {
      duration,
      width,
      height,
      mime,
      bytes: file.size,
      codec: track.codec,
      hasAudio: audio.length > 0,
    };
  } catch (error) {
    if (/Choose |prepared video|Keep your|Export |unsupported dimensions/.test(error.message))
      throw error;
    throw new Error('This video could not be read. Export a regular MP4 or WebM and try again.');
  } finally {
    input.dispose();
  }
}

export async function readVideoForm(req) {
  const limit = VIDEO_POLICY.bytes + VIDEO_POLICY.posterBytes + 64 * 1024;
  if (Number(req.headers.get('content-length')) > limit)
    throw new Error('The video upload is too large. Keep the prepared clip under 5 MB.');
  const reader = req.body?.getReader();
  if (!reader) throw new Error('Choose a video first.');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error('The video upload is too large. Keep the prepared clip under 5 MB.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const form = await new Response(bytes, {
    headers: { 'Content-Type': req.headers.get('content-type') || '' },
  }).formData();
  const file = form.get('file'),
    poster = form.get('poster');
  if (
    !file ||
    typeof file === 'string' ||
    !poster ||
    typeof poster === 'string' ||
    poster.size > VIDEO_POLICY.posterBytes ||
    poster.size < 12
  )
    throw new Error('Choose a video with a valid cover frame.');
  const signature = new TextDecoder('ascii').decode(await poster.slice(0, 12).arrayBuffer());
  if (!signature.startsWith('RIFF') || signature.slice(8, 12) !== 'WEBP')
    throw new Error('The cover frame must be a WebP image.');
  return { file, poster };
}
