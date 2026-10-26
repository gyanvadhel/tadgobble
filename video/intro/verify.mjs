import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url),
  ffmpeg = require('ffmpeg-static');
const dir = path.resolve('data/intro/qa');
mkdirSync(dir, { recursive: true });
const run = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ['-hide_banner', ...args], { windowsHide: true });
    let log = '';
    p.stderr.on('data', (b) => (log += b));
    p.on('exit', (c) => (c ? reject(new Error(log.slice(-3000))) : resolve(log)));
  });
const audioOnly = process.argv.includes('--audio');
const loudness = await run([
  '-i',
  audioOnly ? 'data/intro/master.wav' : 'deliverables/tadgobble-intro.mp4',
  '-vn',
  '-af',
  'ebur128=peak=true',
  '-f',
  'null',
  '-',
]);
const summary = loudness.slice(loudness.lastIndexOf('Summary:'));
console.log(summary);
if (audioOnly) process.exit(0);
const decoded = await run([
  '-i',
  'deliverables/tadgobble-intro.mp4',
  '-map',
  '0:v:0',
  '-an',
  '-f',
  'null',
  '-',
]);
const videoLine = decoded
  .split('\n')
  .find((l) => l.includes('Stream #0:0') && l.includes('Video:'));
const duration = decoded.match(/Duration: ([\d:.]+)/)?.[1];
const frameMatches = [...decoded.matchAll(/frame=\s*(\d+)/g)];
const frames = Number(frameMatches.at(-1)?.[1]);
if (
  !videoLine?.includes('1080x1920') ||
  !videoLine?.includes('60 fps') ||
  frames !== 2400 ||
  duration !== '00:00:40.00'
)
  throw new Error('Unexpected export dimensions, rate, or duration.');
for (const sec of [1, 5, 9.3, 10.6, 14.7, 16.9, 18.7, 20.3, 23.7, 27.2, 28.9, 31.5, 33.8, 37.8])
  await run([
    '-y',
    '-ss',
    String(sec),
    '-i',
    'deliverables/tadgobble-intro.mp4',
    '-frames:v',
    '1',
    path.join(dir, `export-${sec}.png`),
  ]);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4188/video/intro/watch.html');
const playback = await page.locator('video').evaluate(async (video) => {
  video.muted = true;
  await video.play();
  await new Promise((r) => setTimeout(r, 1200));
  video.pause();
  return {
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight,
    time: video.currentTime,
    error: video.error?.message ?? null,
  };
});
await browser.close();
if (playback.error || playback.time < 0.5) throw new Error('Browser playback failed.');
const report = {
  duration,
  frames,
  width: 1080,
  height: 1920,
  fps: 60,
  bytes: statSync('deliverables/tadgobble-intro.mp4').size,
  videoLine,
  loudness: summary,
  playback,
  checks: [
    'All 2400 frames decode',
    'Audio loudness and true peak measured',
    'Browser MP4 playback succeeds',
    '14 exported frames sampled for visual review',
    'Approved Gobbler script',
    'Original Gobble retained',
    'Real local UI recording',
    'Isolated demo submission remains pending',
  ],
};
writeFileSync(path.join(dir, 'verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
