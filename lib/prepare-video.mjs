import { VIDEO_POLICY, inspectVideo } from '../supabase/functions/_shared/video.mjs';

const cancelled = (signal) => {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
};
async function posterFrame(file, signal) {
  const video = document.createElement('video'),
    url = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const wait = (event, trigger) =>
    new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timer);
        video.removeEventListener(event, done);
        video.removeEventListener('error', fail);
        signal?.removeEventListener('abort', abort);
        error ? reject(error) : resolve();
      };
      const done = () => finish();
      const fail = () =>
        finish(
          new Error('This browser cannot open that video. Export an H.264 MP4 and try again.'),
        );
      const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
      const timer = setTimeout(fail, 15000);
      video.addEventListener(event, done, { once: true });
      video.addEventListener('error', fail, { once: true });
      signal?.addEventListener('abort', abort, { once: true });
      trigger();
      if (signal?.aborted) abort();
    });
  try {
    await wait('loadeddata', () => {
      video.src = url;
      video.load();
    });
    const at = Math.min(0.2, video.duration / 4);
    if (at > 0)
      await wait('seeked', () => {
        video.currentTime = at;
      });
    cancelled(signal);
    const canvas = document.createElement('canvas'),
      scale = Math.min(1, 1000 / video.videoWidth, 1000 / video.videoHeight);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('The cover frame could not be prepared. Try another browser.');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78));
    if (!poster || poster.type !== 'image/webp' || poster.size > VIDEO_POLICY.posterBytes)
      throw new Error('The cover frame could not be prepared. Try a smaller video.');
    return poster;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

export async function prepareVideo(file, signal, onProgress = () => {}) {
  cancelled(signal);
  onProgress('Checking your clip…');
  const media = await import('mediabunny');
  const info = await inspectVideo(file, media, { source: true });
  cancelled(signal);
  let prepared = file;
  try {
    await inspectVideo(file, media);
  } catch {
    onProgress('Making your clip smaller…');
    const input = new media.Input({
      source: new media.BlobSource(file),
      formats: [media.MP4, media.QTFF, media.WEBM],
    });
    let conversion, output;
    try {
      const scale = Math.min(1, 1280 / info.width, 1280 / info.height);
      for (const webm of [false, true]) {
        cancelled(signal);
        output = new media.Output({
          format: webm
            ? new media.WebMOutputFormat()
            : new media.Mp4OutputFormat({ fastStart: 'in-memory' }),
          target: new media.BufferTarget(),
        });
        conversion = await media.Conversion.init({
          input,
          output,
          tracks: 'primary',
          video: {
            codec: webm ? 'vp9' : 'avc',
            width: Math.max(16, Math.round((info.width * scale) / 2) * 2),
            height: Math.max(16, Math.round((info.height * scale) / 2) * 2),
            fit: 'contain',
            frameRate: 30,
            quality: new media.Quality({ bitrate: 1_000_000 }),
            allowTransformationMetadata: false,
          },
          audio: webm
            ? {
                codec: 'opus',
                quality: new media.Quality({ bitrate: 96_000 }),
                sampleRate: 48000,
                numberOfChannels: 2,
              }
            : { codec: 'aac' },
          showWarnings: false,
        });
        if (conversion.isValid && !conversion.discardedTracks.length) break;
        await conversion.cancel();
        conversion = null;
      }
      if (!conversion)
        throw new Error(
          'This browser cannot compress that clip. Export a video under 5 MB as H.264 MP4, or try Chrome or Safari.',
        );
      const abort = () => {
        void conversion.cancel();
      };
      signal?.addEventListener('abort', abort, { once: true });
      conversion.onProgress = (progress) =>
        onProgress(`Making your clip smaller… ${Math.round(progress * 100)}%`);
      try {
        cancelled(signal);
        await conversion.execute();
      } finally {
        signal?.removeEventListener('abort', abort);
      }
      prepared = new Blob([output.target.buffer], { type: await output.getMimeType() });
    } catch (error) {
      cancelled(signal);
      if (/This browser cannot/.test(error.message)) throw error;
      throw new Error(
        'This browser could not compress that video. Export an H.264 MP4 under 5 MB and try again.',
      );
    } finally {
      input.dispose();
    }
  }
  cancelled(signal);
  const final = await inspectVideo(prepared, media);
  onProgress('Choosing a cover frame…');
  const poster = await posterFrame(prepared, signal);
  cancelled(signal);
  onProgress('Uploading your clip…');
  const form = new FormData();
  form.set(
    'file',
    new Blob([prepared], { type: final.mime }),
    final.mime === 'video/webm' ? 'clip.webm' : 'clip.mp4',
  );
  form.set('poster', poster, 'poster.webp');
  return form;
}
