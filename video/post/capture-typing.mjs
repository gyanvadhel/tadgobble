// Captures one still per typed character of the demo title (does not post anything).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const out = path.resolve('data/post/shots/type');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 540, height: 960 }, deviceScaleFactor: 2,
  storageState: path.resolve('data/intro/session.json'), reducedMotion: 'no-preference',
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:3115/discover?submit=1', { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: /Made something/ }).waitFor({ timeout: 20000 });
await page.getByLabel('Add a photo of your work').setInputFiles(path.resolve('data/post/demo-art.jpg'));
await page.getByText('Image ready', { exact: true }).waitFor({ timeout: 30000 });
const title = page.getByLabel('Give it a title');
await title.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await title.click();
const words = 'Moon Garden';
await page.screenshot({ path: `${out}/00.jpg`, type: 'jpeg', quality: 90 });
for (let i = 1; i <= words.length; i++) {
  await title.fill(words.slice(0, i));
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${out}/${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 90 });
}
await browser.close();
console.log('typed', words.length);
