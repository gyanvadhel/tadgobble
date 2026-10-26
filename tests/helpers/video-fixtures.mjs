import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
export function videoFixtures(dir, large = false) {
  mkdirSync(dir, { recursive: true });
  const make = (name, seconds, width, height, crf) => {
    const file = path.join(dir, name + '.mp4');
    if (!existsSync(file))
      execFileSync(
        ffmpeg,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          `testsrc2=size=${width}x${height}:rate=24`,
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=440:sample_rate=44100',
          '-t',
          String(seconds),
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          String(crf),
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '96k',
          '-movflags',
          '+faststart',
          '-y',
          file,
        ],
        { windowsHide: true, timeout: 60000 },
      );
    return { path: file, bytes: readFileSync(file) };
  };
  return {
    short: make('short-portrait', 2, 360, 640, 24),
    long: make('too-long', 33, 320, 240, 32),
    ...(large ? { large: make('large-landscape', 12, 1920, 1080, 16) } : {}),
  };
}
