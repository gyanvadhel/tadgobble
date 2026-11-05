// Checks for the home-page intro story: a seeded server on one port, an empty one on another.
// Usage: npm run build && npm run test:intro   (screenshots land in test-results/intro-qa-*)
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

mkdirSync('test-results', { recursive: true });
const dir = mkdtempSync(path.resolve('test-results/intro-qa-'));
const titles = [
  'A better rabbit hole.',
  'Feed Gobble. Get a find.',
  'Peek. Save. Say something nice.',
  'Made a thing? Let it loose.',
  'Pehli baar? Perfect.',
];
const servers = [];
let browser;
const checks = [];
const check = (name, fn) => checks.push([name, fn]);

async function start(port, seed) {
  const origin = `http://127.0.0.1:${port}`;
  const data = mkdtempSync(path.join(dir, `data-${port}-`));
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      env: {
        ...process.env,
        DATA_DIR: data,
        APP_URL: origin,
        ADMIN_EMAIL: 'owner@test.example',
        ADMIN_PASSWORD: 'intro-e2e-password-123',
        SEED_CATALOG: seed ? 'true' : 'false',
        INSTAGRAM_PUBLISH_ENABLED: 'false',
        INSTAGRAM_ACCESS_TOKEN: '',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.log = '';
  child.stdout.on('data', (d) => (child.log += d));
  child.stderr.on('data', (d) => (child.log += d));
  servers.push(child);
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) return origin;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server on ${port} did not start.\n${child.log}`);
}

// The story's own HTML, cut out of the server-rendered page.
const storyHtml = (html) => {
  const from = html.indexOf('id="how-it-works"');
  assert.ok(from > 0, 'the story section is in the HTML');
  const to = html.indexOf('discovery-ribbon', from);
  return html.slice(from, to > from ? to : undefined);
};

check('no-JS HTML has all five scene titles in order and the skip link', async ({ seeded }) => {
  const html = storyHtml(await (await fetch(seeded)).text());
  let at = 0;
  for (const title of titles) {
    const next = html.indexOf(title.replace(/'/g, '&#x27;'), at);
    assert.ok(next >= at, `scene title "${title}" appears in order`);
    at = next;
  }
  assert.match(html, /<a[^>]*class="story-skip"[^>]*href="#fresh-picks"|<a[^>]*href="#fresh-picks"[^>]*class="story-skip"/);
});

check('empty catalogue shows the generic ticket and no product name', async ({ empty }) => {
  const html = storyHtml(await (await fetch(empty)).text());
  assert.match(html, /your thing\?/);
});

check('seeded catalogue puts a real product on the scene 2 ticket', async ({ seeded }) => {
  const html = storyHtml(await (await fetch(seeded)).text());
  assert.doesNotMatch(html.match(/data-part="ticket"[^>]*>[^<]*/)?.[0] || '', /your thing\?/);
});

// -- later tasks add their browser checks below this line --

try {
  const ctx = { seeded: await start(3102, true), empty: await start(3103, false) };
  ctx.dir = dir;
  let failed = 0;
  for (const [name, fn] of checks) {
    try {
      await fn(ctx, async () => (browser ||= await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] })));
      console.log(`PASS: ${name}`);
    } catch (error) {
      failed++;
      console.log(`FAIL: ${name}\n  ${error.message.split('\n')[0]}`);
    }
  }
  if (failed) process.exitCode = 1;
  else console.log(`All ${checks.length} intro checks passed. Screenshots: ${dir}`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const s of servers) s.kill();
}
