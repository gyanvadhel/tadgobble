import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

mkdirSync('test-results', { recursive: true });
const testDir = mkdtempSync(path.resolve('test-results/e2e-'));
const password = randomBytes(16).toString('hex');
const port = 3100;
const origin = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  DATA_DIR: testDir,
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
try {
  await untilReady();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/discover?utm_source=instagram&utm_campaign=pilot');
  await page.locator('.product-card').first().waitFor();
  assert.equal(await page.locator('.product-card').count(), 6);
  await page.screenshot({ path: path.join(testDir, 'discover-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  assert.equal(await page.locator('.product-card').count(), 3);
  await page.getByRole('button', { name: 'All discoveries', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search products' }).fill('n8n');
  assert.equal(await page.locator('.product-card').count(), 1);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Save Tally', exact: true }).click();
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Early Explorer');
  await page.getByLabel('Email', { exact: true }).fill('explorer@test.example');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create your account', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await page.waitForURL('**/discover*');
  await page.locator('.modal').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Save Tally', exact: true }).click();
  await page.getByRole('button', { name: 'Unsave Tally', exact: true }).waitFor();
  await page.getByRole('button', { name: /^Saved/ }).click();
  assert.equal(await page.locator('.product-card').count(), 1);
  await page.locator('.showcase-title').click();
  await page.getByRole('heading', { name: 'Tally', exact: true }).waitFor();
  await page
    .getByPlaceholder('What caught your curiosity?')
    .fill('This would be useful for a client intake form.');
  await page.getByRole('button', { name: 'Join the conversation', exact: true }).click();
  await page.locator('.comment').first().waitFor();
  assert.match(await page.locator('.comment').innerText(), /client intake/);
  const redirect = await context.request.get(origin + '/go/tally?source=instagram', {
    maxRedirects: 0,
  });
  assert.equal(redirect.status(), 302);
  assert.match(redirect.headers().location, /tally.so/);
  await page.getByRole('button', { name: 'Share your work', exact: true }).first().click();
  await page.getByRole('radio', { name: 'App or tool', exact: true }).check();
  await page.getByLabel('App or tool name', { exact: true }).fill('Workflow Fixture');
  await page.getByLabel('Website link', { exact: true }).fill('https://example.com/demo');
  await page
    .getByLabel('What does it do?')
    .fill('A demo product for checking the complete workflow.');
  await page.locator('.share-extras summary').click();
  await page.getByLabel('Category', { exact: true }).selectOption('Developer tools');
  await page.getByLabel('Who is it for?').selectOption('Developers');
  await page.getByLabel('Pricing', { exact: true }).selectOption('Free');
  await page.getByLabel('Pricing details', { exact: true }).fill('Test only');
  await page
    .getByLabel('Tell us more')
    .fill('This test listing only exists in an isolated test database.');
  await page
    .getByLabel('Key capabilities')
    .fill('Demonstrates the content workflow\nProvides a test recording');
  await page.getByLabel('Source for those details').fill('https://example.com/demo');
  await page.getByRole('checkbox', { name: /This is my work/ }).check();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await page.getByText('In the review queue', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back to discoveries' }).click();
  await page.locator('.modal').waitFor({ state: 'hidden' });
  const denied = await context.request.get(origin + '/api/studio');
  assert.equal(denied.status(), 403);
  await page.getByRole('button', { name: 'Open account' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.goto(origin + '/studio');
  await page.getByRole('button', { name: 'Sign in to the studio' }).click();
  await page.getByLabel('Email', { exact: true }).fill('owner@test.example');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('.studio-main').waitFor();
  await page.getByRole('button', { name: /^Products/ }).click();
  const row = page.locator('tr').filter({ hasText: 'Workflow Fixture' });
  await row.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('checkbox', { name: /I checked these details/ }).check();
  await page.getByRole('button', { name: 'Verify & publish listing' }).click();
  await page.locator('.modal').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Product for content draft' })
    .selectOption({ label: 'Workflow Fixture' });
  await page.getByRole('button', { name: 'Prepare draft' }).click();
  await page.locator('.job-editor').waitFor();
  process.env.DATA_DIR = testDir;
  process.env.SEED_CATALOG = 'false';
  const { command } = await import('../lib/render.mjs');
  const fixture = path.join(testDir, 'fixture.mp4');
  await command([
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=640x360:rate=15',
    '-t',
    '3',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    fixture,
  ]);
  await page.getByRole('checkbox').check();
  await page.locator('input[type=file]').setInputFiles(fixture);
  await page.getByText('Demo uploaded. Ready to render.').waitFor();
  await page.getByRole('button', { name: 'Render Reel', exact: true }).click();
  await page.getByText('Waiting for the worker.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Run one workflow step' }).click();
  await page.getByText('Ready for review', { exact: true }).waitFor({ timeout: 120000 });
  await page.locator('.content-card').filter({ hasText: 'Workflow Fixture' }).click();
  await page.locator('video').waitFor();
  await page.getByRole('button', { name: 'I reviewed this video & caption' }).click();
  await page.getByLabel('Publish at · your local timezone').waitFor();
  const future = new Date(Date.now() + 86400_000);
  const local = new Date(future.getTime() - future.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  await page.getByLabel('Publish at · your local timezone').fill(local);
  await page.getByRole('button', { name: 'Schedule approved post' }).click();
  await page.getByText('Scheduled', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  await page.locator('.queue-row').waitFor();
  assert.match(await page.locator('.queue-row').innerText(), /Workflow Fixture/);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.screenshot({ path: path.join(testDir, 'studio-desktop.png'), fullPage: true });
  const stats = await (await context.request.get(origin + '/api/studio')).json();
  assert.equal(stats.jobs[0].status, 'queued');
  assert.equal(stats.jobs[0].media_id, null);
  assert.ok(stats.analytics.productVisits >= 1);
  assert.equal(stats.analytics.members, 1);
  assert.equal(stats.analytics.saves, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/discover');
  await page.locator('.product-card').first().waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(testDir, 'discover-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: discovery, filters, registration, saves, comments, submission, admin isolation, moderation, MP4 upload/render, approval, scheduling, analytics, mobile layout.',
  );
  console.log('Screenshots:', testDir);
} catch (e) {
  writeFileSync(path.join(testDir, 'server.log'), log);
  if (browser) {
    for (const c of browser.contexts())
      for (const p of c.pages())
        await p
          .screenshot({ path: path.join(testDir, 'failure.png'), fullPage: true })
          .catch(() => {});
  }
  console.error(e);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
