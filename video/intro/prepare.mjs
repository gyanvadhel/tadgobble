import { mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve('data/intro');
process.env.DATA_DIR = path.join(root, 'demo');
process.env.SEED_CATALOG = 'true';
mkdirSync(path.join(root, 'stills'), { recursive: true });
const { all, get, run, id, now } = await import('../../lib/db.mjs');
const { hashPassword, createSession } = await import('../../lib/auth.mjs');
const { storeCover } = await import('../../lib/covers.mjs');
let user = get('SELECT * FROM users WHERE email=?', 'mira@demo.example');
if (!user) {
  run(
    'INSERT INTO users VALUES (?,?,?,?,?,?)',
    id(),
    'mira@demo.example',
    'Mira',
    hashPassword(randomBytes(24).toString('hex')),
    'member',
    now(),
  );
  user = get('SELECT * FROM users WHERE email=?', 'mira@demo.example');
}
// Read only the existing product asset; never change the real database.
const source = new DatabaseSync(path.resolve('data/aplatform.sqlite'), { readOnly: true });
const argus = source
  .prepare("SELECT * FROM products WHERE name='Argus' AND status='published' LIMIT 1")
  .get();
if (argus && !get('SELECT id FROM products WHERE id=?', argus.id)) {
  const cover = source.prepare('SELECT * FROM product_covers WHERE id=?').get(argus.cover_id);
  if (cover) {
    mkdirSync(path.join(process.env.DATA_DIR, 'covers'), { recursive: true });
    copyFileSync(
      path.resolve('data/covers', cover.filename),
      path.join(process.env.DATA_DIR, 'covers', cover.filename),
    );
    run(
      'INSERT OR IGNORE INTO product_covers VALUES (?,?,?,?,?,?)',
      cover.id,
      null,
      cover.filename,
      cover.kind,
      cover.source_url,
      now(),
    );
  }
  argus.owner_id = null;
  const keys = Object.keys(argus);
  run(
    `INSERT INTO products (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
    ...keys.map((k) => argus[k]),
  );
}
source.close();
const browser = await chromium.launch({ headless: true });
try {
  const entries = all(
    "SELECT * FROM products WHERE status='published' AND cover_id IS NULL AND id IN ('tally','penpot','n8n','cal-com')",
  );
  for (const item of entries) {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1200 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    try {
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);
      // Dismiss a visible cookie choice only when the website exposes one.
      const reject = page
        .getByRole('button', {
          name: /^(Reject all|Reject|Decline|Only necessary|Accept all cookies)$/i,
        })
        .first();
      if (await reject.isVisible().catch(() => false)) await reject.click();
      await page.waitForTimeout(500);
      const image = await page.screenshot();
      const cover = await storeCover(image, user.id, 'capture', item.url);
      run('UPDATE products SET cover_id=? WHERE id=?', cover.id, item.id);
      writeFileSync(path.join(root, 'stills', `${item.id}-website.png`), image);
      console.log(`Website preview captured: ${item.name}`);
    } catch (e) {
      console.log(`Website preview skipped: ${item.name}: ${e.message.split('\n')[0]}`);
    }
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    reducedMotion: 'reduce',
  });
  const url = 'https://tadgobble.web.app/';
  if (!get('SELECT id FROM product_covers WHERE owner_id=? AND source_url=?', user.id, url)) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1000);
    const bytes = await page.screenshot();
    await storeCover(bytes, user.id, 'capture', url);
    writeFileSync(path.join(root, 'stills/tadgobble-website.png'), bytes);
    console.log('Maker demo cover captured: tadgobble');
  }
  await page.close();
} finally {
  await browser.close();
}
run('INSERT OR IGNORE INTO saves VALUES (?,?,?)', user.id, 'n8n', now());
run('DELETE FROM saves WHERE user_id=? AND product_id=?', user.id, 'penpot');
run('DELETE FROM saves WHERE user_id=? AND product_id=?', user.id, 'cal-com');
writeFileSync(
  path.join(root, 'session.json'),
  JSON.stringify({
    cookies: [
      {
        name: 'ap_session',
        value: createSession(user.id),
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        expires: -1,
      },
    ],
    origins: [],
  }),
);
console.log(
  `Demo ready with ${all("SELECT id FROM products WHERE status='published'").length} discoveries.`,
);
