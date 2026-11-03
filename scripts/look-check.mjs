import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, copyFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Screenshots every route in the Highlighter look and checks that no page
// falls back to the old cream paper. Product demo drawings and the profile
// colour a maker picks (theme-*) are art and may
// use any colour. Uses the seeded catalog and test
// accounts only, never real user data.
const outDir = path.resolve('test-results/look');
mkdirSync(outDir, { recursive: true });
const dataDir = mkdtempSync(path.resolve('test-results/look-data-'));
const password = randomBytes(16).toString('hex');
const port = 3104;
const origin = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  DATA_DIR: dataDir,
  APP_URL: origin,
  ADMIN_EMAIL: 'owner@test.example',
  ADMIN_PASSWORD: password,
  SEED_CATALOG: 'true',
  INSTAGRAM_PUBLISH_ENABLED: 'false',
  INSTAGRAM_ACCESS_TOKEN: '',
  NEXT_TELEMETRY_DISABLED: '1',
};
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);
let log = '';
server.stdout.on('data', (b) => (log += b));
server.stderr.on('data', (b) => (log += b));
let browser;
async function untilReady() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Test server did not become ready. ' + log.slice(-2000));
}

const BG = 'rgb(22, 11, 38)';
const CREAM = 'rgb(249, 244, 167)';

async function checkLook(page, name) {
  const look = await page.evaluate((cream) => {
    const creamText = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return (
          box.width &&
          box.height &&
          el.innerText?.trim() &&
          !el.closest('.product-demo, [class*="theme-"]') &&
          getComputedStyle(el).backgroundColor === cream
        );
      })
      .map((el) => el.className || el.tagName);
    return { bg: getComputedStyle(document.body).backgroundColor, creamText };
  }, CREAM);
  assert.equal(look.bg, BG, `${name}: body background`);
  assert.deepEqual(look.creamText, [], `${name}: text on the old cream`);
}

try {
  await untilReady();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const post = async (route, data) => {
    const response = await context.request.post(origin + '/api/' + route, {
      headers: { origin },
      data,
    });
    assert.equal(response.status(), 200, `${route}: ${await response.text()}`);
  };

  // A test maker with a public profile, for /profile, /my-work and /settings.
  await post('auth/register', { name: 'Look Check', email: 'look@test.example', password });
  await page.goto(origin + '/settings');
  await page.locator('[name=username]').fill('lookcheck');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.getByText('Profile saved. Looking good.').waitFor();

  const { products } = await (await fetch(origin + '/api/bootstrap')).json();
  const routes = [
    ['home', '/'],
    ['discover', '/discover'],
    ['product', '/product/' + products[0].slug],
    ['profile', '/profile/lookcheck'],
    ['my-work', '/my-work'],
    ['settings', '/settings'],
    ['welcome', '/welcome'],
    ['privacy', '/privacy'],
    ['terms', '/terms'],
  ];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const [name, pathname] of routes) {
      await page.goto(origin + pathname);
      await page.waitForLoadState('networkidle');
      await checkLook(page, `${name} at ${width}px`);
      await page.screenshot({ path: path.join(outDir, `${name}-${width}.png`), fullPage: true });
    }
    await page.goto(origin + '/discover?submit=1');
    await page.getByRole('heading', { name: /Made something/ }).waitFor();
    await page.screenshot({ path: path.join(outDir, `submit-${width}.png`) });
    await page.goto(origin + '/discover');
    await page.locator('.dropdown button').first().click();
    await page.locator('.dropdown.is-open').waitFor();
    await page.screenshot({ path: path.join(outDir, `dropdown-${width}.png`) });
  }
  // The README screenshot: the top of the home page at desktop size.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(outDir, 'readme-home.png') });

  // The studio, signed in as the owner.
  const admin = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  admin.setDefaultTimeout(20000);
  await admin.goto(origin + '/studio');
  await admin.getByRole('button', { name: 'Sign in to the studio' }).click();
  await admin.getByLabel('Email', { exact: true }).fill('owner@test.example');
  await admin.getByLabel('Password', { exact: true }).fill(password);
  await admin.getByRole('button', { name: 'Sign in', exact: true }).click();
  await admin.locator('.studio-main').waitFor();
  for (const width of [390, 1440]) {
    await admin.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await checkLook(admin, `studio at ${width}px`);
    await admin.screenshot({ path: path.join(outDir, `studio-${width}.png`), fullPage: true });
  }

  assert.deepEqual(errors, [], 'page errors');
  if (process.argv.includes('--readme')) {
    copyFileSync(path.join(outDir, 'readme-home.png'), 'docs/images/tadgobble.png');
  }
  console.log(`PASS: every route is on the dark page with no old cream. Screenshots in ${outDir}`);
} finally {
  await browser?.close();
  server.kill();
}
