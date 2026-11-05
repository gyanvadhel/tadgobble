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

// A page at the given size, with console errors collected on page.errors.
async function open(getBrowser, url, { width = 1440, height = 900, reducedMotion = 'no-preference', wait = 'pinned', touch = false, cores, shifts = false } = {}) {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  const page = await context.newPage();
  if (cores) await page.addInitScript((n) => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => n }), cores);
  if (shifts)
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  await page.goto(url, { waitUntil: 'load' });
  if (wait === 'pinned') await page.waitForSelector('.intro-story[data-mode="pinned"] .story-scene[data-active="true"]', { state: 'attached', timeout: 10000 });
  else await page.waitForTimeout(1200);
  return page;
}
// Scroll so the story is `k` viewport heights in, then say which scene is active.
const storyAt = (page, k) =>
  page.evaluate(async (k) => {
    const top = document.querySelector('.intro-story').getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + innerHeight * k, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 250));
    return [...document.querySelectorAll('.story-scene')].findIndex((s) => s.dataset.active === 'true');
  }, k);

check('story pins while scrolling', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  assert.equal(await storyAt(page, 0.1), 0);
  assert.equal(await storyAt(page, 4.3), 4);
  await page.screenshot({ path: path.join(dir, 'pinned-scene-5.png') });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

check('the story sticks in place with CSS, not a scripted fixed pin', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  assert.equal(await page.locator('.pin-spacer').count(), 0);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.story-stage')).position), 'sticky');
  const ratio = await page.evaluate(() => document.querySelector('.intro-story').offsetHeight / innerHeight);
  assert.ok(ratio > 5.4 && ratio < 5.6, `story is ${ratio} screens tall`);
  await page.context().close();
});

check('scrolling back rewinds', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  await storyAt(page, 4.3);
  assert.equal(await storyAt(page, 0.1), 0);
  await page.context().close();
});

check('skip lands on fresh picks', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  await storyAt(page, 1.5);
  await page.click('.story-skip');
  await page.waitForFunction(() => {
    const r = document.querySelector('#fresh-picks').getBoundingClientRect();
    return r.top < innerHeight * 0.6 && r.bottom > 0;
  }, null, { timeout: 4000 });
  await page.context().close();
});

check('reduced motion has no pin and shows every title', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded, { reducedMotion: 'reduce', wait: 'still' });
  assert.equal(await page.locator('.pin-spacer').count(), 0);
  for (const title of titles) assert.ok(await page.locator('.story-scene h3', { hasText: title }).isVisible(), title);
  await page.context().close();
});

check('Pause motion mid-story reverts cleanly', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  await storyAt(page, 2.2);
  await page.click('.motion-control');
  await page.waitForFunction(() => document.querySelector('.intro-story').dataset.mode !== 'pinned', null, { timeout: 4000 });
  const leftovers = await page.evaluate(() => [...document.querySelectorAll('.story-scene, .story-scene h3')].filter((e) => e.style.transform || e.style.opacity).length);
  assert.equal(leftovers, 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// Scroll to `k` viewport heights into the story, let the scrub catch up, read how a part looks.
const partLook = (page, k, selector) =>
  page.evaluate(
    async ([k, selector]) => {
      const top = document.querySelector('.intro-story').getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + innerHeight * k, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 1500));
      const cs = getComputedStyle(document.querySelector(selector));
      return `${cs.transform}|${cs.opacity}`;
    },
    [k, selector],
  );

check('each scene illustration changes between its start and end', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  const parts = [
    '[data-scene="rabbit-hole"] .art-chip',
    '[data-scene="feed"] [data-part="ticket"]',
    '[data-scene="stash"] [data-part="bubble"]',
    '[data-scene="post"] [data-part="receipt"]',
    '[data-scene="first-time"] [data-part="arrow"]',
  ];
  for (const [n, selector] of parts.entries()) {
    const start = await partLook(page, 4.5 * (n / 5 + 0.004), selector);
    const end = await partLook(page, 4.5 * ((n + 1) / 5 - 0.004), selector);
    assert.notEqual(start, end, `scene ${n + 1} ${selector} should move`);
  }
  await page.context().close();
});

check('scene 2 shows the first product name on the ticket', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  const name = await page.locator('[data-scene="feed"] [data-part="ticket"]').textContent();
  assert.ok(name.trim() && !/your thing/.test(name), `ticket text was "${name}"`);
  await page.context().close();
});

check('no console errors across a full scroll', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  for (let k = 0; k <= 4.8; k += 0.4) await storyAt(page, k);
  for (let k = 4.8; k >= 0; k -= 0.8) await storyAt(page, k);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// -- later tasks add their browser checks below this line --

// Past the story, at the products, with the page settled.
const settle = (page, ms = 900) => page.waitForTimeout(ms);
const openPreview = (page) => page.evaluate(() => document.querySelector('.drawer-quick').click());

check('opening a preview stops smooth scroll and locks the body', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  await page.evaluate(() => document.querySelector('#fresh-picks').scrollIntoView({ behavior: 'instant' }));
  await settle(page);
  await openPreview(page);
  await page.waitForSelector('dialog[open]');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis-stopped')), true);
  const before = await page.evaluate(() => scrollY);
  await page.mouse.move(300, 300);
  await page.mouse.wheel(0, 600);
  await settle(page);
  assert.equal(await page.evaluate(() => scrollY), before, 'the page does not scroll under the dialog');
  await page.context().close();
});

check('closing the preview restores scrolling at the same position', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  await page.evaluate(() => document.querySelector('#fresh-picks').scrollIntoView({ behavior: 'instant' }));
  await settle(page);
  const before = await page.evaluate(() => scrollY);
  await openPreview(page);
  await page.waitForSelector('dialog[open]');
  await page.click('.snack-dialog-close');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.equal(await page.evaluate(() => scrollY), before);
  await page.mouse.move(300, 300);
  await page.mouse.wheel(0, 500);
  await page.waitForFunction((b) => scrollY > b + 100, before, { timeout: 4000 });
  await page.context().close();
});

check('Page Down, Space and Tab still move the page', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  const y0 = await page.evaluate(() => scrollY);
  await page.keyboard.press('PageDown');
  await page.waitForFunction((y) => scrollY > y + 100, y0, { timeout: 4000 });
  const y1 = await page.evaluate(() => scrollY);
  await page.keyboard.press('Space');
  await page.waitForFunction((y) => scrollY > y + 100, y1, { timeout: 4000 });
  await page.evaluate(() => document.querySelector('#fresh-picks').scrollIntoView({ behavior: 'instant' }));
  await settle(page);
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  assert.ok(focused && focused !== 'BODY', 'Tab moves focus');
  await page.context().close();
});

check('loading /#for-makers lands on the makers section', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded + '/#for-makers');
  await page.waitForTimeout(1500);
  const top = await page.evaluate(() => document.querySelector('#for-makers').getBoundingClientRect().top);
  assert.ok(Math.abs(top) < 200, `makers section top was ${top}`);
  await page.context().close();
});


check('no cursor blob on a touch context', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded, { width: 390, height: 844, wait: 'still', touch: true });
  assert.equal(await page.locator('.cursor-blob').count(), 0);
  await page.context().close();
});

check('cursor blob appears and follows on a desktop context', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  await page.mouse.move(200, 200);
  await page.mouse.move(700, 450, { steps: 8 });
  await page.waitForSelector('.cursor-blob');
  await page.waitForTimeout(900);
  const box = await page.locator('.cursor-blob').boundingBox();
  const centre = [box.x + box.width / 2, box.y + box.height / 2];
  assert.ok(Math.abs(centre[0] - 700) < 40 && Math.abs(centre[1] - 450) < 40, `blob centre was ${centre}`);
  assert.equal(await page.locator('.cursor-blob').getAttribute('aria-hidden'), 'true');
  await page.context().close();
});

check('cursor blob is gone after Pause motion', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  await page.mouse.move(600, 400, { steps: 4 });
  await page.waitForSelector('.cursor-blob');
  await page.click('.motion-control');
  await page.waitForFunction(() => !document.querySelector('.cursor-blob'), null, { timeout: 4000 });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

check('buttons stay clickable under the blob', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const link = page.locator('.intro-actions .outline-button');
  const box = await link.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.waitForTimeout(500);
  const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href'), [box.x + box.width / 2, box.y + box.height / 2]);
  assert.equal(top, '/discover');
  await page.context().close();
});

// Walk the whole page top to bottom in steps, calling `look` at each stop.
const walk = (page, look, step = 0.7, pause = 120) =>
  page.evaluate(async ([look, step, pause]) => {
    const check = new Function('return ' + look)();
    const bad = [];
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step > 5 ? step : innerHeight * step) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, pause));
      const wrong = check();
      if (wrong) bad.push(`${Math.round(y)}: ${wrong}`);
    }
    return bad;
  }, [look, step, pause]);

check('phone-width scroll has no horizontal overflow', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded, { width: 390, height: 844 });
  const bad = await walk(page, '() => document.documentElement.scrollWidth > innerWidth + 1 && "scrollWidth " + document.documentElement.scrollWidth');
  assert.deepEqual(bad, []);
  await page.context().close();
});

check('a low-powered touch device gets the plain list', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded, { width: 390, height: 844, wait: 'still', touch: true, cores: 4 });
  assert.equal(await page.getAttribute('.intro-story', 'data-mode'), 'static');
  assert.equal(await page.locator('.pin-spacer').count(), 0);
  assert.equal(await page.locator('.cursor-blob').count(), 0);
  for (const title of titles) assert.ok(await page.locator('.story-scene h3', { hasText: title }).count(), title);
  await page.context().close();
});

check('layout shift stays under 0.1 through the whole story', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded, { shifts: true });
  await walk(page, '() => false', 80, 50); // small wheel-sized steps, like a real scroll
  const cls = await page.evaluate(() => window.__cls);
  assert.ok(cls < 0.1, `CLS was ${cls}`);
  await page.context().close();
});

check('resizing from desktop to phone while pinned leaves no gap or errors', async ({ seeded }, getBrowser) => {
  const page = await open(getBrowser, seeded);
  await storyAt(page, 2.2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  assert.equal(await storyAt(page, 0.1), 0);
  assert.equal(await storyAt(page, 3.2), 4);
  const stage = await page.evaluate(() => {
    const r = document.querySelector('.story-stage').getBoundingClientRect();
    return { top: Math.round(r.top), height: Math.round(r.height), vh: innerHeight };
  });
  assert.equal(stage.top, 0);
  assert.equal(stage.height, stage.vh);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

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
