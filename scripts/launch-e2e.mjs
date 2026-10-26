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
  assert.equal(await page.locator('.product-drawer').count(), 6);
  assert.equal(await page.locator('h1').textContent(), 'GOOD FINDS.');
  assert.equal(await page.locator('canvas,.scene-canvas,.scene-fallback').count(), 0);
  assert.ok(await page.locator('.gobble-character').isVisible());
  assert.equal(
    await page.locator('.gobble-shape > path').first().getAttribute('d'),
    originalGobble,
  );
  assert.equal(
    await page.locator('.gobble-shape').evaluate((el) => getComputedStyle(el).color),
    'rgb(57, 36, 90)',
  );
  await page.waitForTimeout(2000);
  assert.equal(
    await page.locator('.gobble-shape > path').first().getAttribute('d'),
    originalGobble,
  );
  assert.equal(await page.locator('canvas').count(), 0);
  assert.equal(
    await page.locator('.discovery-pond,.gobble-story,.color-lab,.palette-shortcut').count(),
    0,
  );
  report.localDesktopMetrics = await page.evaluate(() => ({
    ...window.__visualMetrics,
    transferredBytes: performance
      .getEntriesByType('resource')
      .reduce((n, e) => n + e.transferSize, 0),
    note: 'Local Chromium; not a field measurement.',
  }));
  await page.screenshot({ path: path.join(dir, 'hero-desktop.png') });
  pass(
    'Purple Gobble remains visible after hydration and a delayed check; no 3D replacement is mounted',
  );

  const names = await page.locator('.product-drawer summary h3').allTextContents();
  for (const name of names.slice(0, 2)) {
    await page.getByRole('button', { name: 'Feed me a find', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('#snack-dialog-title').textContent(), name);
    assert.match(
      await page.getByRole('link', { name: 'Take a proper look' }).getAttribute('href'),
      /^\/product\//,
    );
    await page.keyboard.press('Escape');
    assert.ok(await page.evaluate(() => document.activeElement?.matches('.feed-button')));
  }
  pass('Blob feed reveals successive products; preview closes and restores keyboard focus');
  await page.getByRole('button', { name: 'Boop the hungry blob' }).click();
  assert.match(await page.locator('.boop-caption').textContent(), /excellent boop/);
  await page.locator('.gobble-character').focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.boop-caption').textContent(), /besties/);
  await page.getByRole('link', { name: /^Preview / }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  assert.ok(await page.evaluate(() => document.activeElement?.matches('.gobble-snack')));
  await page.getByRole('button', { name: 'Pause animations' }).click();
  assert.equal(
    await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    ),
    0,
  );
  pass('Boop responds and pause stops page animation');

  await page.getByRole('button', { name: 'I build', exact: true }).click();
  assert.deepEqual((await page.locator('.product-drawer h3').allTextContents()).sort(), [
    'Penpot',
    'n8n',
  ]);
  await page.getByRole('button', { name: 'Pick one for me' }).click();
  await page.getByRole('dialog').waitFor();
  assert.ok(['Penpot', 'n8n'].includes(await page.locator('#snack-dialog-title').textContent()));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'For everyone', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search products' }).fill('automation');
  assert.deepEqual(await page.locator('.product-drawer h3').allTextContents(), ['n8n']);
  await page.getByRole('textbox', { name: 'Search products' }).fill('no-such-product-123');
  await page.getByRole('heading', { name: 'No bites for that one.' }).waitFor();
  await page.getByRole('button', { name: 'Show all the finds' }).click();
  assert.equal(await page.locator('.product-drawer').count(), 6);
  pass('Audience filters, search, random discovery and empty-state reset work together');

  async function openProduct(name) {
    const summary = page.getByLabel(`Explore ${name}`, { exact: true });
    if (!(await summary.evaluate((el) => el.parentElement.open))) await summary.click();
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll('.product-drawer[open] h3')].some(
          (el) => el.textContent === name,
        ),
      name,
    );
    return page.locator('.product-drawer[open]');
  }
  let drawer = await openProduct('Tally');
  await drawer.getByRole('button', { name: 'literally just pasta' }).click();
  await drawer.getByRole('button', { name: 'That’s me' }).click();
  await drawer.getByRole('heading', { name: 'Excellent taste.' }).waitFor();
  await drawer.getByRole('button', { name: 'Go again' }).click();
  await drawer.getByRole('button', { name: 'Just a quick look' }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  assert.ok(await page.evaluate(() => document.activeElement?.matches('.drawer-quick')));
  await page.locator('.product-menu').screenshot({ path: path.join(dir, 'product-menu.png') });
  drawer = await openProduct('Excalidraw');
  await drawer.getByRole('button', { name: 'a very good plan' }).click();
  assert.match(await drawer.locator('.bubble-end').textContent(), /a tiny side quest/);
  drawer = await openProduct('Photopea');
  const range = drawer.getByRole('slider', { name: 'Try the color adjustment' });
  await range.focus();
  await page.keyboard.press('Home');
  assert.match(await drawer.locator('.photo-composition').getAttribute('style'), /saturate\(0\)/);
  drawer = await openProduct('Penpot');
  const beforeShape = await drawer.locator('.design-object').getAttribute('style');
  await drawer.getByRole('slider', { name: 'Try the shape adjustment' }).focus();
  await page.keyboard.press('End');
  assert.notEqual(await drawer.locator('.design-object').getAttribute('style'), beforeShape);
  drawer = await openProduct('n8n');
  await drawer.getByRole('button', { name: 'Try the chain reaction' }).click();
  assert.match(await drawer.locator('.flow-node').last().textContent(), /Done!/);
  drawer = await openProduct('Cal.com');
  await drawer.getByRole('button', { name: 'Thu 15' }).click();
  assert.match(await drawer.locator('.calendar-confirm').textContent(), /Thursday/);
  pass('All six original editorial demos respond to real controls');
  const summary = page.getByLabel('Explore Cal.com', { exact: true });
  await summary.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.product-drawer[open]').count(), 0);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.product-drawer[open]').count(), 1);
  assert.equal(await page.locator('.product-drawer[open] h3').textContent(), 'Cal.com');
  pass('Product drawers open and close with keyboard and keep a single scene expanded');

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    if (width <= 800) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await page.getByRole('navigation').getByRole('link', { name: 'The good stuff' }).click();
      assert.equal(
        await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'),
        'false',
      );
    }
    await openProduct('Tally');
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width}px has no horizontal overflow`,
    );
    assert.ok(
      await page
        .locator('.poster-title')
        .evaluate((el) =>
          [...el.children].every(
            (child) => child.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1,
          ),
        ),
      `${width}px headline is not clipped`,
    );
    await page
      .locator('.product-drawer[open]')
      .screenshot({ path: path.join(dir, `product-${width}.png`) });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: path.join(dir, `hero-${width}.png`) });
  }
  pass('Desktop, tablet, 390px and 320px layouts fit; mobile navigation works');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: 'Share your work', exact: true }).click();
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
  pass('Maker CTA continues from registration into product submission');
  await page.goto(origin + '/?from=instagram&utm_source=instagram&utm_campaign=old-link');
  await page.waitForURL('**/discover?**');
  assert.equal(new URL(page.url()).searchParams.get('utm_campaign'), 'old-link');
  await page.goto(origin + '/discover?audience=Developers');
  await page.locator('.product-card').first().waitFor();
  assert.equal(
    await page.getByRole('button', { name: /^Filter by audience/ }).getAttribute('aria-label'),
    'Filter by audience: Developers',
  );
  assert.equal(await page.locator('.product-card').count(), 2);
  pass('Existing campaign URLs and catalog audience links remain functional');

  const reduced = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await reduced.goto(origin);
  await reduced.getByRole('button', { name: 'Reduced motion enabled by your device' }).waitFor();
  assert.equal(await reduced.locator('canvas').count(), 0);
  await reduced.getByRole('button', { name: 'Feed me a find', exact: true }).click();
  await reduced.getByRole('dialog').waitFor();
  await reduced.keyboard.press('Escape');
  await reduced.screenshot({ path: path.join(dir, 'reduced-motion.png') });
  await reduced.close();
  pass('Reduced motion uses the tailless SVG blob and keeps discovery functional');

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
  await fallback.getByRole('button', { name: 'Feed me a find', exact: true }).click();
  await fallback.getByRole('dialog').waitFor();
  await fallback.close();
  pass('Devices without WebGL retain the blob and working discovery');

  const nojs = await browser.newPage({ javaScriptEnabled: false });
  await nojs.goto(origin);
  assert.equal(await nojs.locator('.product-drawer').count(), 6);
  await nojs.getByLabel('Explore Excalidraw', { exact: true }).click();
  assert.ok(await nojs.getByRole('link', { name: 'Meet Excalidraw', exact: true }).isVisible());
  await nojs.getByRole('link', { name: 'Meet Excalidraw', exact: true }).click();
  assert.match(nojs.url(), /\/product\/excalidraw/);
  await nojs.close();
  pass('Server-rendered product names, native drawers and product links work without JavaScript');
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
