import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
const dir = path.resolve('data/intro'),
  origin = 'http://127.0.0.1:3115';
mkdirSync(path.join(dir, 'takes'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  storageState: path.join(dir, 'session.json'),
  reducedMotion: 'no-preference',
});
await context.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent =
      '*{cursor:none!important}#film-cursor{position:fixed;top:0;left:0;width:27px;height:33px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 3px 3px #39245a44)}.film-click{position:fixed;width:12px;height:12px;border:3px solid #ff7547;border-radius:50%;z-index:2147483646;pointer-events:none;animation:filmclick .42s ease-out forwards}@keyframes filmclick{to{transform:translate(-50%,-50%) scale(5);opacity:0}}';
    document.head.append(style);
    const el = document.createElement('div');
    el.id = 'film-cursor';
    el.innerHTML =
      '<svg viewBox="0 0 28 34"><path d="M3 2L25 19L15 20L10 31Z" fill="#39245a" stroke="#fffef6" stroke-width="2.3" stroke-linejoin="round"/></svg>';
    document.body.append(el);
    el.style.transform = 'translate(1200px,930px)';
    addEventListener(
      'mousemove',
      (e) => (el.style.transform = `translate(${e.clientX}px,${e.clientY}px)`),
    );
    addEventListener('mousedown', (e) => {
      const circle = document.createElement('div');
      circle.className = 'film-click';
      circle.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;transform:translate(-50%,-50%)`;
      document.body.append(circle);
      setTimeout(() => circle.remove(), 500);
    });
  });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const client = await context.newCDPSession(page);
const shots = [];
let active = null,
  cursor = { x: 1200, y: 930 };
client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  if (active) {
    const filename = `${String(active.frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(path.join(active.folder, filename), Buffer.from(data, 'base64'));
    active.frames.push({
      file: `takes/${active.name}/${filename}`,
      t: metadata.timestamp - active.epoch,
    });
  }
  await client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
async function start(name) {
  await page.evaluate(() => document.fonts.ready);
  const folder = path.join(dir, 'takes', name);
  mkdirSync(folder, { recursive: true });
  active = { name, folder, epoch: Date.now() / 1000, events: [], frames: [] };
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 96,
    maxWidth: 1440,
    maxHeight: 1100,
    everyNthFrame: 1,
  });
  await page.waitForTimeout(100);
}
function mark(name, extra = {}) {
  const event = { name, t: Date.now() / 1000 - active.epoch, ...extra };
  active.events.push(event);
  console.log(`${active.name}: ${name} ${event.t.toFixed(2)}s`);
  return event;
}
async function stop() {
  await page.waitForTimeout(180);
  await client.send('Page.stopScreencast');
  active.duration = Date.now() / 1000 - active.epoch;
  await page.screenshot({ path: path.join(dir, 'stills', active.name + '.png') });
  shots.push(active);
  writeFileSync(path.join(dir, 'takes.json'), JSON.stringify(shots, null, 2));
  console.log(
    `Recorded ${active.name}: ${active.frames.length} frames / ${active.duration.toFixed(2)}s`,
  );
  active = null;
}
async function go(url) {
  await page.goto(origin + url);
  await page.waitForTimeout(700);
  cursor = { x: 1200, y: 930 };
  await page.mouse.move(cursor.x, cursor.y);
}
async function glide(target, name, duration = 550, click = true) {
  await target.scrollIntoViewIfNeeded();
  const b = await target.boundingBox();
  if (!b) throw new Error('Missing target ' + name);
  const to = { x: b.x + b.width * 0.52, y: b.y + b.height * 0.54 },
    from = { ...cursor };
  mark(name + '-move', { box: b });
  const steps = Math.max(12, Math.round(duration / 18));
  for (let i = 1; i <= steps; i++) {
    let u = i / steps,
      e = u * u * (3 - 2 * u);
    let x = from.x + (to.x - from.x) * e,
      y = from.y + (to.y - from.y) * e - Math.sin(Math.PI * u) * 40;
    await page.mouse.move(x, y);
    await page.waitForTimeout(duration / steps);
  }
  cursor = to;
  if (click) {
    mark(name + '-click', { box: b, x: to.x, y: to.y });
    await page.mouse.click(to.x, to.y);
  }
  return b;
}
async function type(label, text, delay = 28) {
  const loc = page.getByLabel(label, { exact: true });
  await glide(loc, 'type-' + label, 240);
  await loc.pressSequentially(text, { delay });
  mark('typed-' + label);
}
try {
  await go('/');
  await start('hero');
  await page.waitForTimeout(3100);
  await glide(page.getByRole('button', { name: 'Feed me a find', exact: true }), 'feed', 650);
  await page.getByRole('dialog').waitFor();
  mark('preview-open');
  await page.waitForTimeout(2300);
  await stop();

  await go('/');
  await page.locator('#fresh-picks').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.locator('summary[aria-label="Explore Tally"]').click();
  await page.waitForTimeout(400);
  await start('drawers');
  await page.waitForTimeout(180);
  await glide(page.locator('summary[aria-label="Explore Tally"]'), 'open-drawer', 650);
  await page.waitForTimeout(1400);
  await stop();

  await go('/discover');
  await start('discover');
  await page.waitForTimeout(180);
  await glide(
    page
      .getByRole('group', { name: 'Filter by category' })
      .getByRole('button', { name: 'Productivity', exact: true }),
    'category',
    500,
  );
  await page.waitForTimeout(650);
  await glide(page.getByRole('button', { name: 'Save Cal.com', exact: true }), 'save', 550);
  await page.waitForTimeout(500);
  await glide(page.getByRole('button', { name: /^Saved/ }).first(), 'stash', 450);
  await page.waitForTimeout(1200);
  await stop();

  await go('/discover');
  await start('basics');
  await glide(
    page.getByRole('button', { name: 'Share your product', exact: true }).first(),
    'share',
    500,
  );
  await page.getByRole('heading', { name: 'What did you make?' }).waitFor();
  mark('form-open');
  await type('Product name', 'tadgobble', 24);
  await type('Product website', 'https://tadgobble.web.app/', 22);
  await type('One sentence that says it all', 'A new rabbit hole for your next good find.', 13);
  await page.waitForTimeout(350);
  await glide(page.getByRole('button', { name: 'Continue', exact: true }), 'basics-next', 350);
  await page.getByRole('heading', { name: 'Find your corner.' }).waitFor();
  await page.locator('.ticket-cover').waitFor({ timeout: 35000 });
  mark('cover-ready');
  await page.waitForTimeout(300);
  await stop();

  await start('people');
  await glide(
    page
      .getByRole('group', { name: 'Product category', exact: true })
      .getByRole('button', { name: 'Productivity', exact: true }),
    'maker-category',
    450,
  );
  await glide(
    page
      .getByRole('group', { name: 'Product audience', exact: true })
      .getByRole('button', { name: 'Creators', exact: true }),
    'audience',
    500,
  );
  await page.waitForTimeout(350);
  await glide(page.getByRole('button', { name: 'Continue', exact: true }), 'people-next', 350);
  await page.getByRole('heading', { name: 'Make it feel like you.' }).waitFor();
  await stop();

  await page.getByRole('button', { name: 'Sky', exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(450);
  await start('details');
  await glide(page.getByRole('button', { name: 'Sky', exact: true }), 'color', 500);
  await page.waitForTimeout(650);
  await glide(page.getByRole('button', { name: 'Continue', exact: true }), 'details-next', 380);
  await page.getByRole('heading', { name: 'Looking pretty tasty.' }).waitFor();
  await stop();

  await start('review');
  await glide(page.getByRole('checkbox', { name: /I’m the maker/ }), 'ownership', 450);
  await glide(page.getByRole('button', { name: 'Send for review', exact: true }), 'submit', 550);
  await page.getByText('In the review queue', { exact: true }).waitFor();
  mark('receipt');
  await page.waitForTimeout(1250);
  await stop();
  if (errors.length) console.log('Browser diagnostics:', errors);
  console.log('All real UI takes recorded. Submission remains pending in the isolated demo.');
} catch (e) {
  await page.screenshot({ path: path.join(dir, 'stills/recording-error.png') });
  throw e;
} finally {
  await browser.close();
}
