import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import sharp from 'sharp';
mkdirSync('test-results', { recursive: true });
const dir = mkdtempSync(path.resolve('test-results/covers-qa-'));
const origin = 'http://127.0.0.1:3103',
  password = randomBytes(18).toString('hex');
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3103'],
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
      NEXT_TELEMETRY_DISABLED: '1',
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let log = '',
  browser;
server.stdout.on('data', (chunk) => (log += chunk));
server.stderr.on('data', (chunk) => (log += chunk));
const checks = [],
  pass = (message) => {
    checks.push(message);
    console.log('PASS:', message);
  };
try {
  for (let i = 0; i < 50; i++) {
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
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin + '/discover?submit=1');
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Cover Maker');
  await page.getByLabel('Email', { exact: true }).fill('maker@test.example');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create your account', exact: true }).click();
  await page.getByLabel('Product name', { exact: true }).fill('Cover Lab');
  await page.getByLabel('Product website', { exact: true }).fill('https://example.com');
  await page
    .getByLabel('One sentence that says it all', { exact: true })
    .fill('A place to give your ideas their first impression.');
  const capturedResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/covers/capture'),
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByRole('group', { name: 'Product category', exact: true })
    .getByRole('button', { name: 'Design', exact: true })
    .click();
  const response = await capturedResponse;
  assert.equal(response.status(), 200, await response.text());
  const captured = (await response.json()).cover;
  await page.locator('.ticket-cover').waitFor();
  assert.equal(await page.locator('.ticket-cover').evaluate((img) => img.naturalWidth), 1600);
  assert.equal((await fetch(origin + captured.url)).status, 404);
  pass(
    'A real public website is captured automatically while choosing a category; the cover remains private',
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.submission-modal').evaluate((el) => el.scrollTo(0, 0));
  await page
    .locator('.submission-modal')
    .screenshot({ path: path.join(dir, 'automatic-desktop.png') });
  const upload = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#bfdcf5"/><circle cx="1330" cy="250" r="260" fill="#c5b5f5"/><rect x="110" y="170" width="1100" height="760" rx="25" fill="#fff"/><text x="185" y="310" font-family="Arial" font-size="38" fill="#39245a">COVER LAB / TEST FIXTURE</text><text x="185" y="470" font-family="Arial" font-weight="bold" font-size="100" fill="#39245a">Little ideas.</text><text x="185" y="590" font-family="Arial" font-weight="bold" font-size="100" fill="#39245a">Big first impressions.</text><rect x="185" y="720" width="280" height="80" rx="40" fill="#39245a"/><circle cx="1300" cy="970" r="160" fill="#ffab7d"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  await page
    .getByLabel('Upload cover image')
    .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: upload });
  await page.getByText('Your uploaded cover', { exact: true }).waitFor();
  const chosenUrl = await page.locator('.ticket-cover').getAttribute('src');
  assert.notEqual(chosenUrl, captured.url);
  await page
    .getByLabel('Upload cover image')
    .setInputFiles({
      name: 'fake.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not an image'),
    });
  await page.locator('.cover-error').waitFor();
  assert.equal(await page.locator('.ticket-cover').getAttribute('src'), chosenUrl);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  assert.equal(await page.locator('.ticket-cover').count(), 0);
  await page
    .getByLabel('Upload cover image')
    .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: upload });
  await page.getByText('Your uploaded cover', { exact: true }).waitFor();
  const finalCoverUrl = await page.locator('.ticket-cover').getAttribute('src');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('.submission-modal').evaluate((el) => el.scrollTo(0, 0));
    await page
      .locator('.submission-modal')
      .screenshot({ path: path.join(dir, `cover-step-${width}.png`) });
    assert.ok(
      await page
        .locator('.submission-modal')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
  }
  pass(
    'Upload replaces the capture, invalid files preserve the chosen image, remove works, and cover controls fit through 320px',
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox', { name: /I’m the maker/ }).check();
  await page.getByRole('button', { name: 'Send for review', exact: true }).click();
  await page.getByText('In the review queue', { exact: true }).waitFor();
  assert.equal((await fetch(origin + finalCoverUrl)).status, 404);
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const admin = await adminContext.newPage();
  await admin.goto(origin + '/studio?tab=products&status=pending');
  await admin.getByRole('button', { name: 'Sign in to the studio' }).click();
  await admin.getByLabel('Email', { exact: true }).fill('owner@test.example');
  await admin.getByLabel('Password', { exact: true }).fill(password);
  await admin.getByRole('button', { name: 'Sign in', exact: true }).click();
  await admin.getByRole('button', { name: 'Review', exact: true }).click();
  assert.equal(await admin.locator('.cover-stage img').getAttribute('src'), finalCoverUrl);
  await admin.locator('.modal').screenshot({ path: path.join(dir, 'admin-cover.png') });
  await admin.getByRole('checkbox', { name: /I checked these details/ }).check();
  await admin.getByRole('button', { name: 'Verify & publish listing', exact: true }).click();
  await admin.locator('.modal').waitFor({ state: 'hidden' });
  assert.equal((await fetch(origin + finalCoverUrl)).status, 200);
  assert.equal((await fetch(origin + captured.url)).status, 404);
  pass(
    'Admin sees the chosen cover; approval publishes that image while unused captures remain private',
  );
  const product = (await (await fetch(origin + '/api/bootstrap')).json()).products[0];
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, pathname, selector] of [
      ['landing', '/', '.drawer-cover'],
      ['catalog', '/discover', '.catalog-cover img'],
      ['detail', '/product/' + product.slug, '.product-cover-figure img'],
    ]) {
      await page.goto(origin + pathname);
      await page.locator(selector).waitFor();
      assert.equal(await page.locator(selector).first().getAttribute('src'), finalCoverUrl);
      await page
        .locator(selector)
        .first()
        .evaluate((img) => img.decode());
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${name} fits ${width}px`,
      );
      if (name === 'landing')
        await page
          .locator('.product-menu')
          .screenshot({ path: path.join(dir, `${name}-${width}.png`) });
      else await page.screenshot({ path: path.join(dir, `${name}-${width}.png`), fullPage: true });
    }
  }
  pass(
    'Chosen cover persists across landing drawers, catalog, and product detail at desktop and mobile sizes',
  );
  await admin.goto(origin + '/studio?tab=products&status=published');
  await admin.getByRole('button', { name: 'Review', exact: true }).click();
  await admin.getByRole('button', { name: 'Retake website', exact: true }).click();
  await admin.getByText('Captured from your website', { exact: true }).waitFor();
  const replacementUrl = await admin.locator('.cover-stage img').getAttribute('src');
  assert.notEqual(replacementUrl, finalCoverUrl);
  await admin.getByRole('button', { name: 'Save cover', exact: true }).click();
  await admin.getByRole('button', { name: 'Save cover', exact: true }).waitFor({ state: 'hidden' });
  assert.equal((await fetch(origin + replacementUrl)).status, 200);
  assert.equal((await fetch(origin + finalCoverUrl)).status, 404);
  await admin.getByRole('button', { name: 'Remove', exact: true }).click();
  await admin.getByRole('button', { name: 'Save cover', exact: true }).click();
  await admin.getByRole('button', { name: 'Save cover', exact: true }).waitFor({ state: 'hidden' });
  assert.equal((await fetch(origin + replacementUrl)).status, 404);
  pass(
    'Admin can retake, save, and remove a published cover; replaced images become private again',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/discover?submit=1');
  await page.getByLabel('Product name', { exact: true }).fill('No Cover Yet');
  await page.getByLabel('Product website', { exact: true }).fill('http://127.0.0.1');
  await page
    .getByLabel('One sentence that says it all', { exact: true })
    .fill('Capture failure never blocks a submission.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByRole('group', { name: 'Product category', exact: true })
    .getByRole('button', { name: 'Play', exact: true })
    .click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.cover-error').waitFor();
  await page
    .locator('.submission-modal')
    .screenshot({ path: path.join(dir, 'capture-failure.png') });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox', { name: /I’m the maker/ }).check();
  await page.getByRole('button', { name: 'Send for review', exact: true }).click();
  await page.getByText('In the review queue', { exact: true }).waitFor();
  pass('An uncapturable site has actionable feedback and can still be submitted without a cover');
  await page.getByRole('button', { name: 'Back to the good stuff' }).click();
  let releaseCapture;
  const delayed = new Promise((resolve) => (releaseCapture = resolve));
  await page.route('**/api/covers/capture', async (route) => {
    await delayed;
    await route.fulfill({ json: { cover: captured } }).catch(() => {});
  });
  await page.goto(origin + '/discover?submit=1');
  await page.getByLabel('Product name', { exact: true }).fill('Another Little Thing');
  await page.getByLabel('Product website', { exact: true }).fill('https://example.com');
  await page
    .getByLabel('One sentence that says it all', { exact: true })
    .fill('Keep the cover I chose, even when captures finish late.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByRole('group', { name: 'Product category', exact: true })
    .getByRole('button', { name: 'Design', exact: true })
    .click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByLabel('Upload cover image')
    .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: upload });
  await page.getByText('Your uploaded cover', { exact: true }).waitFor();
  const override = await page.locator('.ticket-cover').getAttribute('src');
  releaseCapture();
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.ticket-cover').getAttribute('src'), override);
  pass('A slow automatic capture cannot overwrite a newer manual cover choice');
  assert.deepEqual(errors, []);
  writeFileSync(
    path.join(dir, 'report.json'),
    JSON.stringify({ checks, screenshots: dir }, null, 2),
  );
  console.log(dir);
} catch (error) {
  writeFileSync(path.join(dir, 'server.log'), log);
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
