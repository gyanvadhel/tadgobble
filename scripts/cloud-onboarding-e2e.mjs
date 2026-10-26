import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { cloudAdmin, check } from './cloud-admin.mjs';
const dir = 'test-results/cloud-onboarding';
mkdirSync(dir, { recursive: true });
const origin = process.env.CLOUD_TEST_URL || 'http://127.0.0.1:4188';
const server = process.env.CLOUD_TEST_URL
  ? null
  : spawn(process.execPath, ['scripts/serve-hosting.mjs'], {
      env: { ...process.env, PORT: '4188' },
      windowsHide: true,
      stdio: 'ignore',
    });
const admin = cloudAdmin(),
  stamp = Date.now(),
  email = `blob-qa-${stamp}@example.com`,
  password = randomBytes(24).toString('base64url'),
  username = 'blobqa' + stamp;
let user, browser;
const checks = [],
  errors = [];
try {
  if (server)
    for (let i = 0; i < 40; i++) {
      try {
        if ((await fetch(origin + '/welcome')).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
  user = check(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'Blob QA' },
    }),
  ).user;
  assert.equal(
    check(await admin.from('tg_profiles').select('setup_completed').eq('id', user.id).single())
      .setup_completed,
    false,
  );
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await context.route('**/rest/v1/rpc/tg_api', (r) =>
    r.request().postDataJSON()?.route === 'events'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
      : r.continue(),
  );
  await page.goto(origin + '/discover?submit=1');
  await page.getByText('Email & password', { exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/welcome?next=*');
  await page.getByRole('heading', { name: 'Meet your little weirdo.' }).waitFor();
  // Exercise the real callback page with an authenticated disposable session.
  // This tests routing, not Google's own account/consent screens.
  await page.evaluate(() => sessionStorage.setItem('tg_auth_return', '/my-work'));
  await page.goto(origin + '/auth/callback');
  await page.waitForURL('**/welcome?next=%2Fmy-work');
  await page.getByRole('button', { name: 'Pebble', exact: true }).click();
  await page.getByRole('button', { name: 'Pond green', exact: true }).click();
  await page.getByRole('button', { name: 'Big win', exact: true }).click();
  await page.getByRole('button', { name: 'That’s my blob', exact: true }).click();
  await page.locator('[name=username]').fill(username);
  await page.getByLabel('Share what I make', { exact: false }).check();
  await page.getByRole('button', { name: 'Illustration', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s gobble', exact: true }).click();
  await page.waitForURL('**/my-work');
  const profile = check(await admin.from('tg_profiles').select('*').eq('id', user.id).single());
  assert.equal(profile.setup_completed, true);
  assert.equal(profile.blob_avatar.shape, 'pebble');
  assert.equal(profile.setup_intent, 'share');
  assert.deepEqual(profile.setup_interests, ['Illustration']);
  assert.equal(profile.role, 'member');
  await page.goto(origin + '/settings');
  await page.getByRole('button', { name: 'Pebble', exact: true }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Pebble', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(
    await page.getByRole('button', { name: 'Delete my account', exact: true }).isVisible(),
    false,
  );
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: dir + '/settings-mobile.png', fullPage: true });
  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const publicPage = await visitor.newPage();
  const response = publicPage.waitForResponse(
    (r) =>
      r.url().includes('/rest/v1/rpc/tg_api') &&
      r.request().postDataJSON()?.route === 'profiles/' + username,
  );
  await publicPage.goto(origin + '/profile/' + username);
  await publicPage.getByRole('img', { name: 'Blob QA Gobble avatar', exact: true }).waitFor();
  const visible = (await (await response).json()).profile;
  assert.equal(visible.interests, undefined);
  assert.equal(visible.onboarding, undefined);
  assert.equal(visible.email, undefined);
  assert.equal(visible.blob.color, 'pond');
  await publicPage.screenshot({ path: dir + '/public-profile-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  checks.push(
    'New cloud account and authenticated callback open setup, preserve the return page, and save the selected blob and private preferences.',
  );
  checks.push(
    'Saved blob appears on the public profile and Settings after reload. Deletion stays collapsed. No media uploaded or work published.',
  );
  writeFileSync(dir + '/report.json', JSON.stringify({ checks, errors }, null, 2));
  checks.forEach((c) => console.log('PASS: ' + c));
} catch (e) {
  await browser
    ?.contexts()[0]
    ?.pages()[0]
    ?.screenshot({ path: dir + '/failure.png', fullPage: true })
    .catch(() => {});
  throw e;
} finally {
  await browser?.close();
  server?.kill();
  if (user) check(await admin.auth.admin.deleteUser(user.id));
}
