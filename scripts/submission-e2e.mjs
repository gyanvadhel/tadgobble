import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import sharp from 'sharp';

mkdirSync('test-results', { recursive: true });
const dir = mkdtempSync(path.resolve('test-results/submission-qa-'));
const origin = 'http://127.0.0.1:3191',
  password = randomBytes(18).toString('hex');
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3191'],
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
server.stdout.on('data', (c) => (log += c));
server.stderr.on('data', (c) => (log += c));
const checks = [],
  errors = [];
const pass = (message) => {
  checks.push(message);
  console.log('PASS: ' + message);
};
const image = await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000" viewBox="0 0 700 1000"><rect width="700" height="1000" fill="#f4e4cb"/><circle cx="440" cy="290" r="160" fill="#df6945"/><path d="M0 480 Q180 270 370 490 T700 420V1000H0" fill="#6c8f90"/><path d="M0 660 Q170 470 370 710 T700 570V1000H0" fill="#324c61"/><path d="M0 830 Q230 650 430 840 T700 810V1000H0" fill="#bd8e6c"/><path d="M70 925H230" stroke="#f4e4cb" stroke-width="7"/></svg>`,
  ),
)
  .png()
  .toBuffer();
const imageFile = { name: 'sunday-painting.png', mimeType: 'image/png', buffer: image };
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const headers = { origin };
  const signup = await context.request.post(origin + '/api/auth/register', {
    headers,
    data: { name: 'Curious Artist', email: 'artist@test.example', password },
  });
  assert.equal(signup.status(), 200);
  await page.goto(origin + '/discover?submit=1');
  await page.getByRole('heading', { name: /Made something/ }).waitFor();
  await page
    .locator('.submission-modal')
    .screenshot({ path: path.join(dir, 'art-empty-desktop.png') });
  assert.equal(await page.getByLabel('Give it a title').isVisible(), true);
  assert.equal(await page.getByLabel('A link, if you have one').isVisible(), false);
  await page.getByLabel('Give it a title').fill('Sunday, somewhere quiet');
  await page.getByRole('checkbox', { name: /This is my work/ }).check();
  await page.getByRole('button', { name: 'Send for review', exact: true }).click();
  await page.locator('.share-error').waitFor();
  assert.ok(await page.locator('.share-error').evaluate((el) => document.activeElement === el));
  await page.getByLabel('Add a photo of your work').setInputFiles(imageFile);
  await page.getByText('Image ready', { exact: true }).waitFor();
  assert.deepEqual(
    await page.locator('.cover-stage img').evaluate((img) => [img.naturalWidth, img.naturalHeight]),
    [700, 1000],
  );
  assert.equal(
    await page.locator('.cover-stage img').evaluate((el) => getComputedStyle(el).objectFit),
    'contain',
  );
  await page.locator('.share-extras summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByLabel('Category', { exact: true }).isVisible(), true);
  await page.getByLabel('Category', { exact: true }).selectOption('Painting');
  await page
    .getByLabel('A little about it', { exact: true })
    .fill('An imaginary place to take a breath. Acrylic on paper.');
  await page
    .getByLabel('Describe the image', { exact: true })
    .fill('A rust orange sun above layered blue and terracotta hills.');
  await page.locator('.share-extras summary').click();
  await page.locator('.submission-modal').evaluate((el) => el.scrollTo(0, 0));
  await page
    .locator('.submission-modal')
    .screenshot({ path: path.join(dir, 'art-filled-desktop.png') });
  pass(
    'Image-first form, keyboard disclosure, focused error, optional link, and full portrait preview work.',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator('.submission-modal')
    .screenshot({ path: path.join(dir, 'art-mobile-top.png') });
  await page.getByRole('button', { name: 'Send for review', exact: true }).scrollIntoViewIfNeeded();
  assert.ok(
    await page.locator('.submission-modal').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  );
  await page.screenshot({ path: path.join(dir, 'art-mobile-submit.png') });
  await page.getByRole('button', { name: 'Send for review', exact: true }).click();
  await page.getByText('In the review queue', { exact: true }).waitFor();
  const publicData = await (await context.request.get(origin + '/api/bootstrap')).json();
  assert.equal(publicData.products.length, 0);
  pass('390px mobile submission succeeds with no website and stays out of public discoveries.');

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  assert.equal(
    (
      await adminContext.request.post(origin + '/api/auth/login', {
        headers,
        data: { email: 'owner@test.example', password },
      })
    ).status(),
    200,
  );
  const studio = await (await adminContext.request.get(origin + '/api/studio')).json();
  const work = studio.products.find((p) => p.name === 'Sunday, somewhere quiet');
  assert.equal(work.url, '');
  assert.equal(work.submission.kind, 'art');
  assert.equal(work.category, 'Painting');
  const adminPage = await adminContext.newPage();
  adminPage.on('pageerror', (e) => errors.push(e.message));
  await adminPage.goto(origin + '/studio?tab=products&status=pending');
  await adminPage.getByRole('button', { name: 'Review', exact: true }).first().click();
  await adminPage.getByText('CREATIVE WORK REVIEW', { exact: true }).waitFor();
  assert.equal(await adminPage.getByRole('link', { name: 'Open source', exact: false }).count(), 0);
  await adminPage.getByRole('checkbox', { name: /I reviewed the image/ }).check();
  await adminPage.getByRole('button', { name: 'Publish work', exact: true }).click();
  await adminPage.getByText('CREATIVE WORK REVIEW', { exact: true }).waitFor({ state: 'hidden' });
  await page.goto(origin + '/product/' + work.slug);
  await page.getByRole('heading', { name: work.name, exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: /Try Sunday/ }).count(), 0);
  assert.ok(
    await page
      .getByAltText('A rust orange sun above layered blue and terracotta hills.')
      .isVisible(),
  );
  await page.getByLabel('Your comment').fill('Love the colours. How did you choose them?');
  await page.getByRole('button', { name: 'Join the conversation', exact: true }).click();
  await page.getByText('Love the colours. How did you choose them?', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(dir, 'art-detail-mobile.png'), fullPage: true });
  await page.goto(origin + '/go/' + work.slug);
  await page.waitForURL('**/product/' + work.slug);
  pass(
    'Admin can review art; public work shows its whole image, alt text and comments without dead website links.',
  );

  await page.goto(origin + '/discover?submit=1');
  await page.getByRole('radio', { name: 'App or tool', exact: true }).check();
  await page.getByLabel('App or tool name').fill('Oddly Useful');
  await page.getByLabel('Website link').fill('https://example.com/oddly');
  await page.getByLabel('What does it do?').fill('Keep your research notes in one curious place.');
  await page.locator('.share-extras summary').click();
  await page.getByLabel('Category', { exact: true }).selectOption('Research');
  await page.getByLabel('Who is it for?').selectOption('Students');
  await page.getByRole('checkbox', { name: 'Web app', exact: true }).check();
  await page.getByLabel('Pricing', { exact: true }).selectOption('Free');
  await page.getByLabel('Demo video link').fill('https://example.com/demo');
  await page.locator('.share-extras summary').click();
  await page.getByRole('checkbox', { name: /This is my work/ }).check();
  await page.getByRole('button', { name: 'Send for review', exact: true }).click();
  await page.getByText('In the review queue', { exact: true }).waitFor();
  const app = (await (await adminContext.request.get(origin + '/api/studio')).json()).products.find(
    (p) => p.name === 'Oddly Useful',
  );
  assert.equal(app.url, 'https://example.com/oddly');
  assert.equal(app.category, 'Research');
  assert.equal(app.submission.kind, 'app');
  assert.deepEqual(app.submission.platforms, ['Web app']);
  assert.equal(app.submission.demoUrl, 'https://example.com/demo');
  await page.goto(origin + '/discover');
  await page.getByRole('button', { name: 'Art & design', exact: true }).click();
  assert.equal(await page.locator('.showcase-card').count(), 1);
  await page.getByRole('button', { name: 'Apps & tools', exact: true }).click();
  assert.equal(await page.locator('.showcase-card').count(), 0);
  pass(
    'Existing app fields still submit correctly; creative and app discovery filters separate the two.',
  );
  assert.deepEqual(errors, []);
  writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log('Evidence: ' + dir);
} catch (error) {
  console.error(log.slice(-2500));
  throw error;
} finally {
  await browser?.close();
  server.kill();
}
