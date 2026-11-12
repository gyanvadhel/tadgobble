import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import sharp from 'sharp';
mkdirSync('test-results', { recursive: true });
const dir = mkdtempSync(path.resolve('test-results/creators-qa-')),
  origin = 'http://127.0.0.1:3196',
  password = randomBytes(20).toString('hex');
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3196'],
  {
    env: {
      ...process.env,
      DATA_DIR: dir,
      APP_URL: origin,
      ADMIN_EMAIL: 'owner@test.example',
      ADMIN_PASSWORD: password,
      SEED_CATALOG: 'false',
      INSTAGRAM_PUBLISH_ENABLED: 'false',
      INSTAGRAM_ACCESS_TOKEN: '',
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let log = '',
  browser;
server.stdout.on('data', (c) => (log += c));
server.stderr.on('data', (c) => (log += c));
const checks = [],
  errors = [];
const pass = (s) => {
  checks.push(s);
  console.log('PASS: ' + s);
};
const image = await sharp(
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000"><rect width="700" height="1000" fill="#f4e4cb"/><circle cx="440" cy="290" r="160" fill="#df6945"/><path d="M0 480Q180 270 370 490T700 420V1000H0" fill="#6c8f90"/><path d="M0 660Q170 470 370 710T700 570V1000H0" fill="#324c61"/></svg>',
  ),
)
  .png()
  .toBuffer();
const art = { name: 'painting.png', mimeType: 'image/png', buffer: image };
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const request = async (route, data, ctx = context) => {
    const response = await ctx.request.post(origin + '/api/' + route, {
      headers: { origin },
      data,
    });
    const value = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(value));
    return value;
  };
  await request('auth/register', { name: 'Ari', email: 'ari@test.example', password });
  await page.goto(origin + '/settings');
  await page.getByRole('heading', { name: 'Your corner.' }).waitFor();
  await page.locator('[name=displayName]').fill('Ari Draws');
  await page.locator('[name=username]').fill('aridraws');
  await page.locator('[name=specialty]').fill('Paintings, quiet places & 2am ideas');
  await page
    .locator('[name=bio]')
    .fill(
      'Finding a little colour in ordinary days. These are the things I make when I should probably be asleep.',
    );
  await page.locator('[name=instagram]').fill('@ari.draws');
  await page.locator('[name=website]').fill('https://example.com');
  await page.getByRole('button', { name: 'Use a photo', exact: true }).click();
  await page.getByLabel('Profile photo', { exact: true }).setInputFiles(art);
  await page.getByRole('button', { name: 'Save profile', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.getByText('Profile saved. Looking good.').waitFor();
  await page.screenshot({ path: dir + '/settings-desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: dir + `/settings-${width}.png`, fullPage: true });
  }
  pass('Editable profile and owned avatar save successfully; settings fit 320px and 390px.');
  await page.goto(origin + '/discover?submit=1');
  await page.getByRole('heading', { name: /Made something/ }).waitFor();
  const noisy = await sharp(randomBytes(1800 * 1800 * 3), {
    raw: { width: 1800, height: 1800, channels: 3 },
  })
    .png()
    .toBuffer();
  assert.ok(noisy.length > 5 * 1024 * 1024);
  await page
    .getByLabel('Add a photo of your work')
    .setInputFiles({ name: 'large-phone-photo.png', mimeType: 'image/png', buffer: noisy });
  await page.getByText('Image ready', { exact: true }).waitFor();
  await page.locator('.cover-stage img').evaluate((i) => i.decode());
  assert.equal(await page.locator('.cover-stage img').evaluate((i) => i.naturalWidth), 1600);
  pass('A real image larger than 5 MB is resized before upload.');
  await page.getByLabel('Add a photo of your work').setInputFiles(art);
  await page.getByText('Image ready', { exact: true }).waitFor();
  await page.getByLabel('Give it a title').fill('Somewhere quiet');
  await page.getByRole('checkbox', { name: /This is my work/ }).check();
  await page.getByRole('button', { name: 'Post it', exact: true }).click();
  await page.getByRole('link', { name: /Track it in My work/ }).click();
  await page.getByRole('heading', { name: 'My work.' }).waitFor();
  await page.getByText('Live', { exact: true }).last().waitFor();
  await page.screenshot({ path: dir + '/work-live-mobile.png', fullPage: true });
  const work = (await (await context.request.get(origin + '/api/my-work')).json()).products[0];
  assert.equal(work.status, 'published');
  assert.equal((await context.request.get(origin + '/api/products/' + work.slug)).status(), 200);
  const admin = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await request('auth/login', { email: 'owner@test.example', password }, admin);
  const studio = await admin.newPage();
  studio.on('pageerror', (e) => errors.push(e.message));
  await studio.goto(origin + '/studio?tab=products&status=all');
  await studio.getByRole('button', { name: 'Open', exact: true }).click();
  await studio.getByLabel('Why take it down?').fill('Please tell us what medium you used.');
  await studio.screenshot({ path: dir + '/studio-mobile.png', fullPage: true });
  studio.once('dialog', (d) => d.accept());
  await studio.getByRole('button', { name: 'Take down', exact: true }).click();
  await studio.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal((await context.request.get(origin + '/api/products/' + work.slug)).status(), 404);
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await page.getByText('Please tell us what medium you used.').waitFor();
  pass('A take-down note reaches My work and the work leaves the public site.');
  await page.getByRole('button', { name: 'Edit work' }).click();
  await page.locator('.share-extras summary').click();
  await page
    .getByLabel('A little about it', { exact: true })
    .fill('Acrylic on paper. An imaginary place to take a breath.');
  await page.getByRole('checkbox', { name: /This is my work/ }).check();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText('It’s live', { exact: true }).waitFor();
  assert.equal((await context.request.get(origin + '/api/products/' + work.slug)).status(), 404);
  pass('Editing a taken-down work saves the edit but does not put it back.');
  await studio.reload();
  await studio.getByRole('button', { name: 'Open', exact: true }).click();
  await studio.getByRole('button', { name: 'Put back live', exact: true }).click();
  await studio.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.goto(origin + '/profile/aridraws');
  await page.getByRole('heading', { name: 'Things I’ve made.' }).waitFor();
  await page.getByRole('link', { name: /Somewhere quiet/ }).waitFor();
  assert.ok(
    await page
      .locator('.creator-work-image img')
      .evaluate((img) => img.getBoundingClientRect().height <= img.parentElement.clientHeight + 1),
    'The full artwork must fit its preview frame.',
  );
  await page.screenshot({ path: dir + '/profile-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({ path: dir + '/profile-desktop.png', fullPage: true });
  await page.getByRole('link', { name: /Somewhere quiet/ }).click();
  await page.getByRole('link', { name: 'Made by Ari Draws', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Made by Ari Draws', exact: true }).click();
  assert.ok(page.url().endsWith('/profile/aridraws'));
  pass(
    'A work put back live appears on the public profile; product credit links back to the creator.',
  );
  assert.equal(
    await page.locator('.follow-button').count(),
    0,
    'No follow button on your own profile.',
  );
  const fan = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const fanPage = await fan.newPage();
  fanPage.on('pageerror', (e) => errors.push(e.message));
  await fanPage.goto(origin + '/profile/aridraws');
  await fanPage.getByRole('button', { name: 'Follow', exact: true }).click();
  await fanPage.getByRole('dialog').waitFor();
  pass('Signed out, Follow asks you to sign in.');
  await request('auth/register', { name: 'Bo', email: 'bo@test.example', password }, fan);
  await fanPage.reload();
  const follow = fanPage.locator('.follow-button');
  await fanPage.getByText('0 followers', { exact: true }).waitFor();
  await follow.click();
  await fanPage.getByRole('button', { name: 'Following', exact: true }).waitFor();
  assert.equal(await follow.getAttribute('aria-pressed'), 'true');
  await fanPage.getByText('1 follower', { exact: true }).waitFor();
  await fanPage.screenshot({ path: dir + '/profile-follow-mobile.png', fullPage: true });
  assert.ok(await fanPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await fanPage.reload();
  await fanPage.getByRole('button', { name: 'Following', exact: true }).waitFor();
  await fanPage.getByText('1 follower', { exact: true }).waitFor();
  await fanPage.setViewportSize({ width: 1440, height: 1050 });
  await fanPage.screenshot({ path: dir + '/profile-follow-desktop.png' });
  await follow.click();
  await fanPage.getByRole('button', { name: 'Follow', exact: true }).waitFor();
  await fanPage.getByText('0 followers', { exact: true }).waitFor();
  await fan.close();
  pass('Follow toggles, counts, survives a reload, and is absent on your own profile.');
  await page.goto(origin + '/my-work');
  await page.getByRole('button', { name: 'Edit work' }).click();
  await page.getByText('Edits go live as soon as you save them.').waitFor();
  await page.getByLabel('Give it a title').fill('Somewhere quiet, revised');
  await page.getByRole('checkbox', { name: /This is my work/ }).check();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText('It’s live', { exact: true }).waitFor();
  const live = await context.request.get(origin + '/api/products/' + work.slug);
  assert.equal(live.status(), 200);
  assert.equal((await live.json()).product.name, 'Somewhere quiet, revised');
  pass('Editing live work updates it at once.');
  assert.deepEqual(errors, []);
  writeFileSync(dir + '/report.json', JSON.stringify({ checks, errors }, null, 2));
  console.log('Evidence: ' + dir);
} catch (e) {
  writeFileSync(dir + '/failure.log', String(e) + '\n' + log);
  throw e;
} finally {
  await browser?.close();
  server.kill();
}
