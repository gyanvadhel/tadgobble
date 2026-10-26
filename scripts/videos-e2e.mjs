import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import * as media from 'mediabunny';
import { videoFixtures } from '../tests/helpers/video-fixtures.mjs';
import { inspectVideo } from '../supabase/functions/_shared/video.mjs';
mkdirSync('test-results', { recursive: true });
const dir = mkdtempSync(path.resolve('test-results/video-browser-')),
  origin = 'http://127.0.0.1:3198',
  password = randomBytes(20).toString('hex');
const fixtures = videoFixtures(path.join(dir, 'fixtures'), true);
assert.ok(fixtures.large.bytes.length > 5 * 1024 * 1024);
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3198'],
  {
    env: {
      ...process.env,
      DATA_DIR: dir,
      APP_URL: origin,
      ADMIN_EMAIL: 'owner@test.example',
      ADMIN_PASSWORD: password,
      SEED_CATALOG: 'false',
      INSTAGRAM_PUBLISH_ENABLED: 'false',
    },
    windowsHide: true,
    stdio: 'ignore',
  },
);
let browser;
const errors = [],
  checks = [];
const pass = (text) => {
  checks.push(text);
  console.log('PASS: ' + text);
};
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true });
  const maker = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const call = async (ctx, route, data) => {
    const res = await ctx.request.post(origin + '/api/' + route, { headers: { origin }, data });
    const value = await res.json();
    assert.equal(res.status(), 200, JSON.stringify(value));
    return value;
  };
  await call(maker, 'auth/register', {
    name: 'Motion Maker',
    email: 'motion@test.example',
    password,
  });
  await call(maker, 'profile/save', { name: 'Motion Maker', username: 'motionmaker' });
  const page = await maker.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/discover?submit=1');
  await page.getByLabel('Add a video of your work').setInputFiles(fixtures.long.path);
  await page.locator('.cover-error').filter({ hasText: '30 seconds' }).waitFor();
  const uploaded = page.waitForResponse((r) => r.url() === origin + '/api/videos/upload', {
    timeout: 120000,
  });
  await page.getByLabel('Add a video of your work').setInputFiles(fixtures.large.path);
  const result = await Promise.race([
    uploaded,
    page
      .locator('.cover-error')
      .waitFor({ state: 'visible', timeout: 120000 })
      .then(async () => {
        throw new Error(await page.locator('.cover-error').innerText());
      }),
  ]);
  const compressed = await result.json();
  assert.ok(compressed.cover?.video, JSON.stringify(compressed));
  const video = compressed.cover.video;
  assert.ok(video.bytes < 5 * 1024 * 1024);
  assert.ok(video.width <= 1280 && video.height <= 1280);
  const raw = await maker.request.get(origin + '/api/videos/' + video.id);
  const info = await inspectVideo(new Blob([await raw.body()]), media);
  assert.equal(info.hasAudio, true);
  pass(
    'A real oversized video compresses below 5 MB in the browser, retains sound, and generates its own cover frame. Overlong clips are rejected.',
  );
  const replaced = page.waitForResponse((r) => r.url() === origin + '/api/videos/upload');
  await page.getByLabel('Add a video of your work').setInputFiles(fixtures.short.path);
  const { cover } = await (await replaced).json();
  await page.getByRole('button', { name: 'Play Your work video', exact: true }).waitFor();
  await page.getByLabel('Give it a title').fill('Little motion');
  await page.screenshot({ path: dir + '/submission-mobile.png', fullPage: true });
  await page.getByRole('checkbox', { name: /This is my work/ }).check();
  await page.getByRole('button', { name: 'Send for review', exact: true }).click();
  await page.getByText('In the review queue', { exact: true }).waitFor();
  const pending = (await (await maker.request.get(origin + '/api/my-work')).json()).products[0];
  const anonymous = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  assert.equal(
    (await anonymous.request.get(origin + '/api/videos/' + cover.video.id)).status(),
    404,
  );
  const admin = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    reducedMotion: 'reduce',
  });
  await call(admin, 'auth/login', { email: 'owner@test.example', password });
  const review = await admin.newPage();
  await review.goto(origin + '/studio?tab=products&status=pending');
  await review.getByRole('button', { name: 'Review', exact: true }).click();
  await review.getByRole('button', { name: 'Play Little motion video', exact: true }).click();
  await review.locator('video').evaluate(
    (v) =>
      new Promise((resolve, reject) => {
        if (v.readyState >= 2) return resolve();
        v.addEventListener('loadeddata', resolve, { once: true });
        v.addEventListener('error', reject, { once: true });
      }),
  );
  await review.getByRole('checkbox', { name: /I watched the video/ }).check();
  await review.getByRole('button', { name: 'Publish work', exact: true }).click();
  await review.getByRole('dialog').waitFor({ state: 'hidden' });
  const visitor = await anonymous.newPage();
  visitor.on('pageerror', (e) => errors.push(e.message));
  const downloads = [];
  visitor.on('request', (r) => {
    if (r.method() === 'GET' && r.url().includes('/api/videos/')) downloads.push(r.url());
  });
  await visitor.goto(origin + '/profile/motionmaker');
  await visitor.locator('.video-badge').waitFor();
  assert.equal(downloads.length, 0);
  await visitor.screenshot({ path: dir + '/profile-mobile.png', fullPage: true });
  await visitor.getByRole('link', { name: /Open Little motion/ }).click();
  await visitor.getByRole('button', { name: 'Play Little motion video', exact: true }).waitFor();
  assert.equal(downloads.length, 0);
  await visitor.getByRole('button', { name: 'Play Little motion video', exact: true }).click();
  await visitor.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  assert.ok(downloads.length > 0);
  assert.equal(await visitor.locator('video').evaluate((v) => v.muted), false);
  await visitor.locator('video').evaluate((v) => {
    v.pause();
    v.currentTime = 1;
  });
  for (const width of [390, 320]) {
    await visitor.setViewportSize({ width, height: 844 });
    assert.ok(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await visitor.screenshot({ path: dir + `/playing-${width}.png`, fullPage: true });
  }
  pass(
    'Admin can watch and approve private clips; profiles show the poster/duration, video bytes load only after Play, and the player supports sound and seeking at mobile widths.',
  );
  await call(maker, 'works/update', {
    id: pending.id,
    kind: 'art',
    name: 'Little motion',
    coverId: cover.id,
    ownership: true,
  });
  assert.equal(
    (await anonymous.request.get(origin + '/api/videos/' + cover.video.id)).status(),
    200,
  );
  pass('Editing a published video keeps the live clip up while the edit is reviewed.');
  assert.deepEqual(errors, []);
  writeFileSync(dir + '/report.json', JSON.stringify({ checks, errors }, null, 2));
  console.log('Evidence: ' + dir);
} catch (error) {
  await browser
    ?.contexts()[0]
    ?.pages()[0]
    ?.screenshot({ path: dir + '/failure.png', fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  server.kill();
}
