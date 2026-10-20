import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const origin = process.env.CLOUD_TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
mkdirSync('test-results/cloud-launch', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/rest/v1/rpc/tg_api', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [], user: null }) }));
  let providerEnabled = false;
  await page.route('**/auth/v1/settings', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { google: providerEnabled } }) }));
  await page.goto(origin + '/discover?submit=1', { waitUntil: 'networkidle' });
  const google = page.getByRole('button', { name: 'Continue with Google', exact: true });
  await google.click();
  await page.getByRole('alert').filter({ hasText: 'Google sign-in is still being connected' }).waitFor();
  assert.equal(await google.isEnabled(), true);
  assert.equal(await page.getByRole('button', { name: 'New here? Create an account' }).count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: 'test-results/cloud-launch/google-signin-mobile.png', fullPage: true });

  providerEnabled = true;
  await page.route('**/auth/v1/authorize?**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>OAuth request intercepted by the test.</p>' }));
  const request = page.waitForRequest((r) => new URL(r.url()).pathname === '/auth/v1/authorize');
  await google.click();
  const target = new URL((await request).url());
  assert.equal(target.searchParams.get('provider'), 'google');
  assert.equal(target.searchParams.get('redirect_to'), origin + '/auth/callback');
  assert.equal(target.searchParams.get('code_challenge_method').toLowerCase(), 's256');
  assert.ok(target.searchParams.get('code_challenge').length > 32);
  // No Google account is used: only the app's request and cancellation path are checked here.
  await page.goto(origin + '/auth/callback?error=access_denied&error_description=cancelled', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'One more try?' }).waitFor();
  assert.equal(new URL(page.url()).search, '');
  assert.equal(await page.getByRole('link', { name: 'Back to sign in' }).getAttribute('href'), '/discover?signin=1');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('tg_auth_return')), '/discover?submit=1');
  assert.deepEqual(errors, []);
  console.log('PASS: Google setup error, mobile login, PKCE request, submission return intent, and cancelled OAuth recovery. Real Google consent still requires an interactive check.');
} finally { await browser.close(); }
