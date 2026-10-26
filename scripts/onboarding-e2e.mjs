import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import sharp from 'sharp';
mkdirSync('test-results', { recursive: true });
const dir = mkdtempSync(path.resolve('test-results/onboarding-browser-')),
  origin = 'http://127.0.0.1:3195',
  password = randomBytes(20).toString('hex');
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3195'],
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
    stdio: 'ignore',
    windowsHide: true,
  },
);
let browser;
const checks = [],
  errors = [];
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const external = [];
  page.on('request', (r) => {
    if (/blobatar\.dev/.test(r.url())) external.push(r.url());
  });
  const boot = async () =>
    (await (await context.request.get(origin + '/api/bootstrap')).json()).user;
  await page.goto(origin + '/discover?submit=1');
  await page.getByRole('button', { name: 'New here? Create an account', exact: true }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Ari Makes');
  await page.getByLabel('Email', { exact: true }).fill('intro@test.example');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create your account', exact: true }).click();
  await page.waitForURL('**/welcome?next=*');
  await page.getByRole('heading', { name: 'Meet your little weirdo.' }).waitFor();
  assert.equal((await boot()).onboarding.complete, false);
  await page.getByRole('button', { name: 'Cloud', exact: true }).click();
  await page.getByRole('button', { name: 'Tangerine', exact: true }).click();
  await page.getByRole('button', { name: 'I know a spot', exact: true }).click();
  await page.screenshot({ path: dir + '/picker-desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: dir + `/picker-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'That’s my blob', exact: true }).click();
  await page.locator('[name=name]').fill('Ari Makes');
  await page.locator('[name=username]').fill('arimakes');
  await page.getByLabel('A little of both', { exact: false }).check();
  await page.getByRole('button', { name: 'Photography', exact: true }).click();
  await page.getByRole('button', { name: 'Art & painting', exact: true }).click();
  await page.screenshot({ path: dir + '/questions-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Let’s gobble', exact: true }).click();
  await page.waitForURL('**/discover?submit=1');
  await page.getByLabel('Give it a title').waitFor();
  const saved = await boot();
  assert.equal(saved.onboarding.complete, true);
  assert.equal(saved.profile.blob.shape, 'cloud');
  assert.equal(saved.profile.blob.mood, 'wink');
  assert.deepEqual(saved.onboarding.interests, ['Photography', 'Art & painting']);
  checks.push(
    'Actual signup opens setup and completion returns to the original submission. Blob and private answers persist.',
  );
  await page.goto(origin + '/discover');
  await page.getByRole('button', { name: 'Open account', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: 'Delete my account', exact: true }).count(),
    0,
  );
  await page.goto(origin + '/settings');
  await page.getByRole('heading', { name: 'Your corner.' }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Cloud', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(
    await page.getByRole('button', { name: 'Delete my account', exact: true }).isVisible(),
    false,
  );
  await page
    .locator('summary')
    .filter({ hasText: /^Delete account$/ })
    .click();
  await page.getByRole('button', { name: 'Delete my account', exact: true }).waitFor();
  await page
    .locator('summary')
    .filter({ hasText: /^Delete account$/ })
    .click();
  await page.getByRole('button', { name: 'Use a photo', exact: true }).click();
  const photo = await sharp({
    create: { width: 300, height: 300, channels: 3, background: '#85b5a3' },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel('Profile photo', { exact: true })
    .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: photo });
  await page.locator('.blob-mini-stage .creator-avatar > img').waitFor();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.getByText('Profile saved. Looking good.', { exact: true }).waitFor();
  assert.ok((await boot()).profile.avatar?.id);
  await page.getByRole('button', { name: 'Be a blob', exact: true }).click();
  await page.getByRole('button', { name: 'Boba', exact: true }).click();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.getByText('Profile saved. Looking good.', { exact: true }).waitFor();
  assert.equal((await boot()).profile.avatar, null);
  await page.reload();
  assert.equal(
    await page.getByRole('button', { name: 'Boba', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  await page.screenshot({ path: dir + '/settings-mobile.png', fullPage: true });
  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const publicPage = await visitor.newPage();
  await publicPage.goto(origin + '/profile/arimakes');
  await publicPage.getByRole('heading', { name: 'Ari Makes', exact: true }).waitFor();
  await publicPage.getByRole('img', { name: 'Ari Makes Gobble avatar', exact: true }).waitFor();
  const profile = (await (await visitor.request.get(origin + '/api/profiles/arimakes')).json())
    .profile;
  assert.equal(profile.onboarding, undefined);
  assert.equal(profile.interests, undefined);
  assert.equal(profile.blob.shape, 'round');
  checks.push(
    'Photo/blob switching survives reload, the public profile renders the chosen blob, and deletion is only inside collapsed Settings.',
  );
  await context.request.post(origin + '/api/auth/logout', { headers: { origin }, data: {} });
  await context.request.post(origin + '/api/auth/register', {
    headers: { origin },
    data: { name: 'Skip Friend', email: 'skip@test.example', password },
  });
  await page.goto(origin + '/welcome?next=https://example.org');
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await page.waitForURL(origin + '/discover');
  assert.equal((await boot()).onboarding.complete, true);
  await context.request.post(origin + '/api/auth/logout', { headers: { origin }, data: {} });
  await page.goto(origin + '/discover?signin=1');
  await page.getByLabel('Email', { exact: true }).fill('skip@test.example');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(new URL(page.url()).pathname, '/discover');
  checks.push(
    'Skip is remembered on the next sign-in and external return destinations are rejected. No third-party avatar requests.',
  );
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  writeFileSync(dir + '/report.json', JSON.stringify({ checks, errors }, null, 2));
  checks.forEach((c) => console.log('PASS: ' + c));
  console.log('Evidence: ' + dir);
} catch (e) {
  await browser
    ?.contexts()[0]
    ?.pages()[0]
    ?.screenshot({ path: dir + '/failure.png', fullPage: true })
    .catch(() => {});
  throw e;
} finally {
  await browser?.close();
  server.kill();
}
