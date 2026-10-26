import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
const require = createRequire(import.meta.url),
  ffmpeg = require('ffmpeg-static');
const dir = path.resolve('data/intro'),
  output = path.resolve('deliverables');
mkdirSync(output, { recursive: true });
const isDraft = process.argv.includes('--draft'),
  fps = isDraft ? 30 : 60;
const browser = await chromium.launch({
  headless: true,
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
await page.goto('http://127.0.0.1:4188');
await page.waitForFunction(() => window.ready);
const target = path.join(output, isDraft ? 'tadgobble-intro-preview.mp4' : 'tadgobble-intro.mp4');
const encoder = spawn(
  ffmpeg,
  [
    '-hide_banner',
    '-y',
    '-f',
    'image2pipe',
    '-vcodec',
    'mjpeg',
    '-framerate',
    String(fps),
    '-i',
    'pipe:0',
    '-i',
    path.join(dir, 'master.wav'),
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'libx264',
    '-preset',
    isDraft ? 'ultrafast' : 'fast',
    '-crf',
    isDraft ? '24' : '18',
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'high',
    '-level',
    '4.2',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-colorspace',
    'bt709',
    '-c:a',
    'aac',
    '-b:a',
    '256k',
    '-ar',
    '48000',
    '-t',
    '40',
    '-movflags',
    '+faststart',
    target,
  ],
  { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] },
);
let errorLog = '';
encoder.stderr.on('data', (b) => (errorLog += b));
const finished = once(encoder, 'exit');
const start = Date.now();
try {
  for (let n = 0; n < 40 * fps; n++) {
    const data = await page.evaluate(
      async (frame) => {
        await window.renderFrame(frame);
        return document.querySelector('#film').toDataURL('image/jpeg', 0.96).split(',')[1];
      },
      (n * 60) / fps,
    );
    if (!encoder.stdin.write(Buffer.from(data, 'base64'))) await once(encoder.stdin, 'drain');
    if (n % (fps * 2) === 0)
      console.log(
        `Rendering ${String(n / fps).padStart(2, '0')}/40s · ${((Date.now() - start) / 1000).toFixed(1)}s elapsed`,
      );
  }
  encoder.stdin.end();
  const [code] = await finished;
  if (code) throw new Error(errorLog.slice(-5000));
  await page.evaluate(() => window.renderFrame(37.7 * 60));
  writeFileSync(
    path.join(output, 'tadgobble-intro-cover.png'),
    Buffer.from(
      await page.evaluate(
        () => document.querySelector('#film').toDataURL('image/png').split(',')[1],
      ),
      'base64',
    ),
  );
  console.log(`Finished: ${target}`);
} finally {
  await browser.close();
  writeFileSync(path.join(dir, 'render.log'), errorLog);
  if (encoder.exitCode === null) encoder.kill();
}
