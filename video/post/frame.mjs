// Render selected times of the composition to PNG for review: node video/post/frame.mjs 1 7 9 ...
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const out = path.resolve('data/post/review'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await page.goto(pathToFileURL(path.resolve('video/post/composition.html')).href);
await page.evaluate(() => document.fonts.ready);
for (const t of process.argv.slice(2).map(Number)) {
  await page.evaluate((t) => window.render(t), t);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/t${String(t).replace('.', '_')}.png` });
}
await browser.close();
