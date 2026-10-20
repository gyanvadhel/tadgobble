import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const origin = process.argv[2] || 'http://127.0.0.1:3002';
const dir = 'test-results/full-redesign';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => console.log('PAGE ERROR', error.message));
  await page.goto(origin);
  await page.getByRole('button', { name: 'Pause animations' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/hero.png` });
  await page.getByRole('button', { name: 'Pause animations' }).click();
  await page.locator('.product-menu').screenshot({ path: `${dir}/menu.png` });
  await page.locator('.maker-poster').screenshot({ path: `${dir}/maker.png` });
  await page.locator('.launch-footer').screenshot({ path: `${dir}/footer.png` });
  for (const name of ['Excalidraw', 'Photopea', 'Penpot', 'n8n', 'Cal.com']) {
    await page.getByLabel(`Explore ${name}`, { exact: true }).click();
    await page.waitForTimeout(100);
    await page
      .locator('.product-drawer[open]')
      .screenshot({ path: `${dir}/${name.toLowerCase().replace('.', '-')}.png` });
  }
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `${dir}/hero-${width}.png` });
    if (
      !(await page
        .getByLabel('Explore Tally', { exact: true })
        .evaluate((el) => el.parentElement.open))
    )
      await page.getByLabel('Explore Tally', { exact: true }).click();
    await page.locator('.product-menu').screenshot({ path: `${dir}/menu-${width}.png` });
    console.log(
      width,
      'overflow:',
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    );
    console.log(
      'Headline fits:',
      await page
        .locator('.poster-title')
        .evaluate((el) =>
          [...el.children].every(
            (child) => child.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1,
          ),
        ),
    );
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/discover`);
    await page.locator('.catalog-product').first().waitFor();
    await page.screenshot({ path: `${dir}/catalog-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Explore Tally', exact: true }).click();
    await page.getByRole('heading', { name: 'Tally', exact: true }).waitFor();
    await page.screenshot({ path: `${dir}/detail-${width}.png`, fullPage: true });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Product detail fits ${width}px`,
    );
    console.log('Product detail fits', width);
  }
  console.log(dir);
} finally {
  await browser.close();
}
