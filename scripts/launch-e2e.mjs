import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

mkdirSync('test-results', { recursive: true });
const dir = mkdtempSync(path.resolve('test-results/launch-qa-'));
const origin = 'http://127.0.0.1:3101';
const password = randomBytes(18).toString('hex');
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3101'],
  {
    env: {
      ...process.env,
      DATA_DIR: dir,
      APP_URL: origin,
      ADMIN_EMAIL: 'owner@test.example',
      ADMIN_PASSWORD: password,
      SEED_CATALOG: 'true',
      INSTAGRAM_PUBLISH_ENABLED: 'false',
      INSTAGRAM_ACCESS_TOKEN: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let serverLog = '',
  browser;
server.stdout.on('data', (data) => (serverLog += data));
server.stderr.on('data', (data) => (serverLog += data));
const report = { checks: [], screenshots: dir };
const pass = (text) => {
  report.checks.push(text);
  console.log(`PASS: ${text}`);
};
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  assert.ok(ready, 'Production preview starts');
  browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    window.__visualMetrics = { cls: 0, lcp: 0 };
    new PerformanceObserver((list) =>
      list.getEntries().forEach((e) => {
        if (!e.hadRecentInput) window.__visualMetrics.cls += e.value;
      }),
    ).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) window.__visualMetrics.lcp = last.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const page = await context.newPage(),
    errors = [],
    failedRequests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(origin + '/?utm_source=instagram&utm_campaign=redesign');
  await page.getByRole('button', { name: 'Pause animations' }).waitFor();
  const originalGobble = await page.locator('.gobble-shape > path').first().getAttribute('d');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('h1').textContent(), 'Fresh from first-timers.');
  assert.equal(await page.locator('.product-drawer').count(), 0);
  assert.equal(await page.locator('.discovery-ribbon').count(), 0);
  assert.equal(await page.locator('h1', { hasText: 'GOOD FINDS' }).count(), 0);
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    'rgb(22, 11, 38)',
  );
  assert.equal(await page.locator('canvas,.scene-canvas,.scene-fallback').count(), 0);
  assert.ok(await page.locator('.fresh-hero .gobble-character').isVisible());
  assert.equal(
    await page.locator('.gobble-shape').evaluate((el) => getComputedStyle(el).color),
    'rgb(197, 181, 245)',
  );
  await page.waitForTimeout(2000);
  assert.equal(
    await page.locator('.gobble-shape > path').first().getAttribute('d'),
    originalGobble,
  );
  assert.equal(await page.locator('.gobble-snack,.feed-button').count(), 0);
  report.localDesktopMetrics = await page.evaluate(() => ({
    ...window.__visualMetrics,
    transferredBytes: performance
      .getEntriesByType('resource')
      .reduce((n, e) => n + e.transferSize, 0),
    note: 'Local Chromium; not a field measurement.',
  }));
  await page.screenshot({ path: path.join(dir, 'hero-desktop.png') });
  pass('Yellow hero says "Fresh from first-timers." on the dark page; Gobble stays lilac and still');

  const catalogCount = await page.evaluate(
    async () => (await (await fetch('/api/bootstrap')).json()).products.length,
  );
  const cards = page.locator('.fresh-grid article');
  assert.equal(await cards.count(), Math.min(catalogCount, 12));
  const created = await cards.evaluateAll((els) => els.map((el) => Date.parse(el.dataset.created)));
  assert.ok(created.every((t) => Number.isFinite(t)), 'every card carries its created_at');
  assert.ok(
    created.every((t, i) => i === 0 || created[i - 1] >= t),
    'cards run newest first',
  );
  await page.getByRole('heading', { name: 'Fresh today' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'See everything' }).getAttribute('href'), '/discover');
  const firstName = await cards.first().locator('h3').textContent();
  await cards.first().locator('.fresh-card').click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.locator('#snack-dialog-title').textContent(), firstName);
  assert.match(
    await page.getByRole('link', { name: 'Take a proper look' }).getAttribute('href'),
    /^\/product\//,
  );
  await page.keyboard.press('Escape');
  assert.ok(
    await page.evaluate(() => document.activeElement?.closest('.fresh-grid article') !== null),
  );
  pass('Fresh grid shows up to 12 newest cards; a card opens the preview and focus returns to it');

  await page.getByRole('button', { name: 'Boop the hungry blob' }).click();
  assert.match(await page.locator('.boop-caption').textContent(), /excellent boop/);
  await page.locator('.gobble-character').focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.boop-caption').textContent(), /besties/);
  await page.getByRole('button', { name: 'Pause animations' }).click();
  assert.equal(
    await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    ),
    0,
  );
  pass('Boop responds and pause stops page animation');

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    if (width <= 800) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await page.getByRole('navigation').getByRole('link', { name: 'For makers' }).click();
      assert.equal(
        await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'),
        'false',
      );
    }
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width}px has no horizontal overflow`,
    );
    assert.ok(
      await page.locator('h1').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `${width}px headline is not clipped`,
    );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: path.join(dir, `home-${width}.png`), fullPage: true });
  }
  pass('Desktop, tablet, 390px and 320px layouts fit; mobile navigation works');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.header-submit').click();
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Launch Explorer');
  await page.getByLabel('Email', { exact: true }).fill('launch@test.example');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create your account', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await page.waitForURL('**/discover*');
  await page.getByRole('radio', { name: 'App or tool', exact: true }).check();
  await page.getByLabel('App or tool name', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  pass('"Post your thing" continues from registration into product submission');
  await page.goto(origin + '/?from=instagram&utm_source=instagram&utm_campaign=old-link');
  await page.waitForURL('**/discover?**');
  assert.equal(new URL(page.url()).searchParams.get('utm_campaign'), 'old-link');
  await page.goto(origin + '/discover?audience=Developers');
  await page.locator('.showcase-card').first().waitFor();
  assert.equal(
    await page.getByRole('button', { name: /^Filter by audience/ }).getAttribute('aria-label'),
    'Filter by audience: Developers',
  );
  assert.equal(await page.locator('.showcase-card').count(), 2);
  pass('Existing campaign URLs and catalog audience links remain functional');

  const reduced = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await reduced.goto(origin);
  await reduced.getByRole('button', { name: 'Reduced motion enabled by your device' }).waitFor();
  const stillGobble = await reduced.locator('.gobble-shape > path').first().getAttribute('d');
  await reduced.waitForTimeout(800);
  assert.equal(await reduced.locator('.gobble-shape > path').first().getAttribute('d'), stillGobble);
  assert.equal(
    await reduced.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    ),
    0,
  );
  assert.equal(
    await reduced.locator('.fresh-hero').evaluate((el) => getComputedStyle(el).opacity),
    '1',
  );
  await reduced.locator('.fresh-grid .fresh-card').first().click();
  await reduced.getByRole('dialog').waitFor();
  await reduced.keyboard.press('Escape');
  await reduced.screenshot({ path: path.join(dir, 'reduced-motion.png') });
  await reduced.close();
  pass('Reduced motion keeps Gobble and the snack machine static and the grid working');

  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind.includes('webgl') ? null : original.call(this, kind, ...args);
    };
  });
  fallback.on('pageerror', (e) => errors.push(e.message));
  await fallback.goto(origin);
  await fallback.getByRole('button', { name: 'Pause animations' }).waitFor();
  assert.equal(await fallback.locator('canvas').count(), 0);
  await fallback.locator('.fresh-grid .fresh-card').first().click();
  await fallback.getByRole('dialog').waitFor();
  await fallback.close();
  pass('Devices without WebGL keep Gobble and a working grid');

  const nojs = await browser.newPage({ javaScriptEnabled: false });
  await nojs.goto(origin);
  assert.equal(await nojs.locator('.fresh-grid article').count(), Math.min(catalogCount, 12));
  const href = await nojs.locator('.fresh-grid .fresh-card').first().getAttribute('href');
  assert.match(href, /^\/product\//);
  await nojs.locator('.fresh-grid .fresh-card').first().click();
  assert.match(nojs.url(), /\/product\//);
  await nojs.close();
  pass('Server-rendered fresh cards are real product links without JavaScript');

  const emptyOrigin = 'http://127.0.0.1:3102';
  const empty = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3102'],
    {
      env: {
        ...process.env,
        DATA_DIR: mkdtempSync(path.resolve('test-results/launch-empty-')),
        APP_URL: emptyOrigin,
        SEED_CATALOG: 'false',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      windowsHide: true,
      stdio: 'ignore',
    },
  );
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${emptyOrigin}/api/health`)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    const emptyPage = await browser.newPage();
    await emptyPage.goto(emptyOrigin);
    await emptyPage.getByText('Nothing fresh yet. Be the first.').waitFor();
    assert.equal(await emptyPage.locator('.fresh-grid article').count(), 0);
    assert.equal(
      await emptyPage
        .locator('.fresh-grid')
        .getByRole('link', { name: 'Post your thing' })
        .getAttribute('href'),
      '/discover?submit=1',
    );
    await emptyPage.close();
  } finally {
    empty.kill();
  }
  pass('An empty catalog invites the first post');
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  pass('No uncaught browser errors or failed page requests');
  writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  writeFileSync(path.join(dir, 'server.log'), serverLog);
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
