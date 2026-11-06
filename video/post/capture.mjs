// Captures the real tadgobble UI from the local demo server as still states + a scroll clip.
// Output: data/post/shots/*.jpg and data/post/shots.json (states, target rects, scroll frames).
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
const out = path.resolve('data/post'), shots = path.join(out, 'shots');
rmSync(shots, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });
const origin = 'http://127.0.0.1:3115';
const W = 540, H = 960;

// An invented demo artwork (no real user data).
const art = await sharp(
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1b5c"/><stop offset=".55" stop-color="#7a4fd0"/><stop offset="1" stop-color="#ff9a6b"/></linearGradient>
<radialGradient id="m" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#f7e9a8"/></radialGradient></defs>
<rect width="900" height="1200" fill="url(#g)"/>
<circle cx="610" cy="330" r="150" fill="url(#m)"/><circle cx="660" cy="300" r="128" fill="#7a4fd0" opacity=".28"/>
<g fill="#fffbe6" opacity=".9"><circle cx="150" cy="170" r="5"/><circle cx="300" cy="90" r="3"/><circle cx="780" cy="130" r="4"/><circle cx="90" cy="420" r="3"/><circle cx="420" cy="260" r="4"/><circle cx="820" cy="560" r="3"/></g>
<path d="M0 820 C150 720 300 780 450 740 S760 690 900 760 V1200 H0Z" fill="#1c1240"/>
<path d="M0 930 C200 850 330 920 520 880 S780 840 900 900 V1200 H0Z" fill="#12092e"/>
<g fill="#ffd36e"><rect x="170" y="720" width="14" height="110" rx="7"/><circle cx="177" cy="712" r="30"/><rect x="560" y="770" width="12" height="90" rx="6"/><circle cx="566" cy="762" r="24" fill="#ff9a6b"/><rect x="700" y="740" width="12" height="110" rx="6"/><circle cx="706" cy="732" r="26" fill="#fffbe6"/></g></svg>`),
).jpeg({ quality: 92 }).toBuffer();
writeFileSync(path.join(out, 'demo-art.jpg'), art);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2,
  storageState: path.resolve('data/intro/session.json'), reducedMotion: 'no-preference',
});
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const meta = { w: W, h: H, states: {}, rects: {}, scroll: [], errors };
const snap = async (name, q = 90) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(shots, name + '.jpg'), type: 'jpeg', quality: q });
  meta.states[name] = name + '.jpg'; console.log('shot', name);
};
const rect = async (name, loc) => { meta.rects[name] = await loc.boundingBox(); };

// 1. The real scroll story, driven frame by frame.
await page.goto(origin + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const total = await page.evaluate(() => {
  const el = document.querySelector('.story-scenes') || document.body;
  const s = document.querySelector('.story-scenes')?.closest('section') ?? el;
  const r = s.getBoundingClientRect();
  return { top: Math.round(r.top + scrollY), height: Math.round(r.height) };
});
console.log('story', total);
meta.story = total;
const FR = 150;
mkdirSync(path.join(shots, 'scroll'), { recursive: true });
const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const from = Math.max(0, total.top - 40), to = total.top + total.height - H;
for (let i = 0; i < FR; i++) {
  const y = from + (to - from) * (i / (FR - 1));
  await page.evaluate((v) => window.scrollTo(0, v), Math.round(y));
  await page.waitForTimeout(i === 0 ? 900 : 90);
  const f = `scroll/${String(i).padStart(4, '0')}.jpg`;
  await page.screenshot({ path: path.join(shots, f), type: 'jpeg', quality: 88 });
  meta.scroll.push(f);
}

// 2. The real posting flow.
await page.goto(origin + '/discover?submit=1', { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: /Made something/ }).waitFor({ timeout: 20000 });
await snap('post-0-open');
await rect('photo', page.getByLabel('Add a photo of your work'));
await page.getByLabel('Add a photo of your work').setInputFiles(path.join(out, 'demo-art.jpg'));
await page.getByText('Image ready', { exact: true }).waitFor({ timeout: 30000 });
await snap('post-1-photo');
const title = page.getByLabel('Give it a title');
await title.scrollIntoViewIfNeeded();
await rect('title', title);
const words = 'Moon Garden';
for (let i = 1; i <= words.length; i++) {
  await title.fill(words.slice(0, i));
  await page.waitForTimeout(60);
  if (i === 4 || i === words.length) await snap(`post-2-title-${i}`);
}
const box = page.getByRole('checkbox', { name: /This is my work/ });
await box.scrollIntoViewIfNeeded();
await rect('checkbox', box);
await snap('post-3-before-check');
await box.check();
await snap('post-4-checked');
const btn = page.getByRole('button', { name: 'Post it', exact: true });
await btn.scrollIntoViewIfNeeded();
await rect('post', btn);
await snap('post-5-ready');
await btn.click();
await page.getByText('It’s live', { exact: true }).waitFor({ timeout: 30000 });
await snap('post-6-live');
writeFileSync(path.join(out, 'shots.json'), JSON.stringify(meta, null, 1));
await browser.close();
console.log(errors.length ? 'page errors: ' + errors.join(' | ') : 'no page errors');
