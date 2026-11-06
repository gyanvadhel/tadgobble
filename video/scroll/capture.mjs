// Captures the website's scroll story frame by frame (1080x1920 @30fps) from the local demo server,
// with the "Skip the tour" / "Pause the tour" buttons hidden. Output: data/scroll/frames/00000.jpg ...
// Usage: node video/scroll/capture.mjs
import { chromium } from 'playwright';
import { mkdirSync, rmSync, copyFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const FPS = 30, W = 540, H = 960;
const LEAD = 1.0, SCROLL = 24, TAIL = 1.6; // seconds: hold on the first scene, scroll, hold on the last
const dir = path.resolve('data/scroll/frames');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:3115/', { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '.story-skip,.story-pause{display:none!important}' });
await page.waitForTimeout(1500);
const story = await page.evaluate(() => {
  const s = document.querySelector('.story-scenes').closest('section');
  const r = s.getBoundingClientRect();
  return { top: Math.round(r.top + scrollY), height: Math.round(r.height) };
});
const from = story.top, to = story.top + story.height - H;
console.log('story', story, 'scroll', from, '->', to);

// Mostly-linear scroll that eases gently in and out, so it reads as a calm, steady scroll.
const smooth = (p) => p * p * (3 - 2 * p);
const ease = (p) => 0.55 * p + 0.45 * smooth(p);
const nLead = Math.round(LEAD * FPS), nScroll = Math.round(SCROLL * FPS), nTail = Math.round(TAIL * FPS);
const name = (i) => path.join(dir, String(i).padStart(5, '0') + '.jpg');
const shoot = async (i) => page.screenshot({ path: name(i), type: 'jpeg', quality: 93 });

await page.evaluate((v) => window.scrollTo(0, v), from);
await page.waitForTimeout(1200);
await shoot(0);
for (let i = 1; i < nLead; i++) copyFileSync(name(0), name(i));
let n = nLead;
const positions = [];
for (let k = 0; k < nScroll; k++) {
  const y = Math.round(from + (to - from) * ease(k / (nScroll - 1)));
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(k === 0 ? 450 : 330);
  await shoot(n);
  positions.push(y);
  if (k % 60 === 0) console.log('frame', n, 'y', y);
  n++;
}
const last = n - 1;
for (let i = 0; i < nTail; i++) copyFileSync(name(last), name(n + i));
n += nTail;
writeFileSync(path.resolve('data/scroll/meta.json'), JSON.stringify({ fps: FPS, frames: n, story, from, to, lead: nLead, scroll: nScroll, positions }, null, 1));
await browser.close();
console.log('frames', n, 'duration', (n / FPS).toFixed(2) + 's', errors.length ? 'page errors: ' + errors.join(' | ') : 'no page errors');
