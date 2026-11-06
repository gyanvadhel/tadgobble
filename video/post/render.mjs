// Renders composition.html frame by frame (30 fps, 1080x1920) and muxes audio with ffmpeg-static.
// Usage: node video/post/render.mjs [outFile]
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ffmpeg from 'ffmpeg-static';

const FPS = 30,
  framesDir = path.resolve('data/post/frames');
const outFile = path.resolve(process.argv[2] || 'deliverables/tadgobble-how-to-post.mp4');
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(path.dirname(outFile), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(pathToFileURL(path.resolve('video/post/composition.html')).href);
await page.evaluate(() => document.fonts.ready);
const D = await page.evaluate(() => window.__duration);
const total = Math.round(D * FPS);
// Preload every captured image once so no frame renders with a missing picture.
await page.evaluate(async () => {
  const urls = [...document.querySelectorAll('img')].map((i) => i.src).filter(Boolean);
  for (let i = 0; i < 150; i++)
    urls.push(new URL('../../data/post/shots/scroll/' + String(i).padStart(4, '0') + '.jpg', location.href).href);
  await Promise.all(urls.map((u) => new Promise((r) => { const im = new Image(); im.onload = im.onerror = r; im.src = u; })));
});
for (let f = 0; f < total; f++) {
  await page.evaluate((t) => window.render(t), f / FPS);
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null))));
  await page.screenshot({ path: path.join(framesDir, String(f).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 95 });
  if (f % 90 === 0) console.log(`frame ${f}/${total}`);
}
await browser.close();

const args = [
  '-y', '-framerate', String(FPS), '-i', path.join(framesDir, '%05d.jpg'),
  '-i', path.resolve('data/post/audio.wav'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-shortest', outFile,
];
await new Promise((res, rej) => {
  const p = spawn(ffmpeg, args, { stdio: 'inherit' });
  p.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c))));
});
console.log('wrote', outFile);
