import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

mkdirSync('test-results', { recursive: true });
const dir = mkdtempSync(path.resolve('test-results/submission-qa-'));
const origin = 'http://127.0.0.1:3102',
  password = randomBytes(18).toString('hex');
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3102'],
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
const report = { checks: [], screenshots: dir };
const pass = (message) => {
  report.checks.push(message);
  console.log(`PASS: ${message}`);
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
  await page.goto(origin);
  await page.getByRole('heading', { name: 'First bite’s yours.' }).waitFor();
  assert.equal(await page.locator('.product-drawer').count(), 0);
  assert.equal(await page.getByRole('textbox', { name: 'Search products' }).count(), 0);
  assert.equal(
    (await (await context.request.get(origin + '/api/bootstrap')).json()).products.length,
    0,
  );
  await page.screenshot({ path: path.join(dir, 'empty-landing.png'), fullPage: true });
  await page.getByRole('link', { name: 'Be the first find', exact: true }).click();
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Curious Maker');
  await page.getByLabel('Email', { exact: true }).fill('maker@test.example');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create your account', exact: true }).click();
  await page.getByRole('heading', { name: 'What did you make?' }).waitFor();
  pass('Empty discoveries invite a first submission; registration opens the guided form');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  assert.ok(await page.getByRole('heading', { name: 'What did you make?' }).isVisible());
  await page.getByLabel('Product name', { exact: true }).fill('Oddly Useful');
  await page.getByLabel('Product website', { exact: true }).fill('https://example.com/oddly');
  await page
    .getByLabel('One sentence that says it all', { exact: true })
    .fill('Keep your research notes in one curious place.');
  assert.equal(await page.locator('.ticket-copy h3').textContent(), 'Oddly Useful');
  await page
    .locator('.submission-modal')
    .screenshot({ path: path.join(dir, 'basics-desktop.png') });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.submission-error').waitFor();
  assert.equal(
    await page
      .getByRole('group', { name: 'Product category', exact: true })
      .getByRole('button')
      .count(),
    22,
  );
  assert.equal(
    await page
      .getByRole('group', { name: 'Product audience', exact: true })
      .getByRole('button')
      .count(),
    8,
  );
  await page.getByRole('textbox', { name: 'Find a category' }).fill('research');
  await page
    .getByRole('group', { name: 'Product category', exact: true })
    .getByRole('button', { name: 'Research', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Find a category' }).fill('');
  await page
    .getByRole('group', { name: 'Product audience', exact: true })
    .getByRole('button', { name: 'Students', exact: true })
    .click();
  await page.getByText('Where can people use it?', { exact: false }).click();
  await page.getByRole('button', { name: 'Web app', exact: true }).click();
  await page.getByRole('button', { name: 'API', exact: true }).click();
  await page
    .locator('.submission-modal')
    .screenshot({ path: path.join(dir, 'people-desktop.png') });
  pass(
    'Required fields validate; live preview, category search and audience/platform choices respond',
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  assert.equal(await page.getByLabel('Key capabilities', { exact: true }).isVisible(), false);
  await page.getByRole('button', { name: 'Free plan + paid upgrades', exact: true }).click();
  await page.getByLabel('Pricing details', { exact: true }).fill('from $8/month');
  await page.getByRole('button', { name: 'Sky', exact: true }).click();
  await page.getByText('Add a little more context', { exact: false }).click();
  await page
    .getByLabel('Tell us about it', { exact: true })
    .fill('A tiny research notebook for ideas that would otherwise get lost in your tabs.');
  await page
    .getByLabel('Key capabilities', { exact: true })
    .fill('Save research notes\nOrganize ideas');
  await page
    .getByLabel('Documentation or source link', { exact: true })
    .fill('https://example.com/docs');
  await page.getByLabel('Demo link', { exact: true }).fill('https://example.com/demo');
  await page
    .locator('.submission-modal')
    .screenshot({ path: path.join(dir, 'details-desktop.png') });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Edit basics', exact: true }).click();
  assert.equal(await page.getByLabel('Product name', { exact: true }).inputValue(), 'Oddly Useful');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: 'Research', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  assert.equal(
    await page.getByLabel('Pricing details', { exact: true }).inputValue(),
    'from $8/month',
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .locator('.submission-modal')
    .screenshot({ path: path.join(dir, 'review-desktop.png') });
  await page.getByRole('button', { name: 'Send for review', exact: true }).click();
  assert.equal(await page.locator('.submission-success').count(), 0);
  await page.getByRole('checkbox', { name: /I’m the maker/ }).check();
  await page.getByRole('button', { name: 'Send for review', exact: true }).click();
  await page.getByText('In the review queue', { exact: true }).waitFor();
  await page.locator('.submission-modal').screenshot({ path: path.join(dir, 'success.png') });
  assert.equal(
    (await (await context.request.get(origin + '/api/bootstrap')).json()).products.length,
    0,
  );
  await page.getByRole('button', { name: 'Back to the good stuff' }).click();
  pass(
    'Back/edit preserves input; confirmation submits once and keeps the product off the public menu',
  );

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const admin = await adminContext.newPage();
  admin.on('pageerror', (error) => errors.push(error.message));
  await admin.goto(origin + '/studio?tab=products&status=pending');
  await admin.getByRole('button', { name: 'Sign in to the studio' }).click();
  await admin.getByLabel('Email', { exact: true }).fill('owner@test.example');
  await admin.getByLabel('Password', { exact: true }).fill(password);
  await admin.getByRole('button', { name: 'Sign in', exact: true }).click();
  await admin.getByRole('heading', { name: 'Products', exact: true }).waitFor();
  const studio = await (await adminContext.request.get(origin + '/api/studio')).json();
  assert.equal(studio.products.length, 1);
  const product = studio.products[0];
  assert.equal(product.category, 'Research');
  assert.equal(product.audience, 'Students');
  assert.deepEqual(product.submission.platforms, ['Web app', 'API']);
  assert.equal(product.submission.demoUrl, 'https://example.com/demo');
  assert.equal(product.color, 'blue');
  await admin
    .locator('tr')
    .filter({ hasText: 'Oddly Useful' })
    .getByRole('button', { name: 'Review' })
    .click();
  assert.ok(await admin.getByText('Available on: Web app, API', { exact: true }).isVisible());
  assert.equal(
    await admin.getByRole('link', { name: 'Open demo', exact: true }).getAttribute('href'),
    'https://example.com/demo',
  );
  await admin.locator('.modal').screenshot({ path: path.join(dir, 'admin-review.png') });
  await admin.getByRole('checkbox', { name: /I checked these details/ }).check();
  await admin.getByRole('button', { name: 'Verify & publish listing' }).click();
  await admin.locator('.modal').waitFor({ state: 'hidden' });
  await page.goto(origin + '/discover');
  await page.locator('.catalog-product').waitFor();
  await page
    .getByRole('combobox', { name: 'More categories', exact: true })
    .selectOption('Research');
  await page
    .getByRole('combobox', { name: 'Filter by audience', exact: true })
    .selectOption('Students');
  assert.equal(await page.locator('.catalog-product').count(), 1);
  assert.equal(
    await page.locator('.catalog-product').evaluate((el) => getComputedStyle(el).backgroundColor),
    'rgb(191, 220, 245)',
  );
  pass(
    'Direct pending-review URL works; optional metadata survives review and approval publishes into matching filters',
  );

  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/discover?submit=1');
    await page.getByLabel('Product name', { exact: true }).fill('Tiny Thing');
    await page.getByLabel('Product website', { exact: true }).fill('https://example.com/tiny');
    await page
      .getByLabel('One sentence that says it all', { exact: true })
      .fill('A tiny thing for your next side quest.');
    for (let step = 0; step < 4; step++) {
      if (step === 1)
        await page
          .getByRole('group', { name: 'Product category', exact: true })
          .getByRole('button', { name: 'Play', exact: true })
          .click();
      assert.ok(
        await page
          .locator('.submission-modal')
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        `Step ${step + 1} fits ${width}px`,
      );
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page
        .locator('.submission-modal')
        .screenshot({ path: path.join(dir, `step-${step + 1}-${width}.png`) });
      if (step < 3) await page.getByRole('button', { name: 'Continue', exact: true }).click();
    }
    if (width === 320) {
      await page.getByRole('checkbox', { name: /I’m the maker/ }).check();
      await page.getByRole('button', { name: 'Send for review', exact: true }).click();
      await page.getByText('In the review queue', { exact: true }).waitFor();
    }
    await page.getByRole('button', { name: 'Close dialog' }).click();
  }
  const latest = await (await adminContext.request.get(origin + '/api/studio')).json();
  const minimal = latest.products.find((item) => item.name === 'Tiny Thing');
  assert.equal(minimal.status, 'pending');
  assert.equal(minimal.source, 'https://example.com/tiny');
  assert.equal(minimal.pricing, 'See current pricing');
  assert.deepEqual(minimal.facts, []);
  assert.deepEqual(minimal.submission.platforms, []);
  pass(
    'All four steps fit tablet/phone widths through 320px; minimal submissions need no optional details',
  );
  assert.deepEqual(errors, []);
  pass('No uncaught browser errors');
  writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  writeFileSync(path.join(dir, 'server.log'), log);
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
