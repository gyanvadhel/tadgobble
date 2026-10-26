import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { cloudAdmin, check } from './cloud-admin.mjs';

const origin = process.env.CLOUD_TEST_URL || 'http://127.0.0.1:4186';
const server = process.env.CLOUD_TEST_URL
  ? null
  : spawn(process.execPath, ['scripts/serve-hosting.mjs'], {
      env: { ...process.env, PORT: '4186' },
      windowsHide: true,
      stdio: 'ignore',
    });
const admin = cloudAdmin(),
  users = [];
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const email = `art-qa-${Date.now()}@example.com`,
  password = randomBytes(24).toString('base64url');
const evidence = 'test-results/cloud-artwork';
mkdirSync(evidence, { recursive: true });
const passed = [],
  errors = [];
let browser;
try {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(origin + '/discover')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  const user = check(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'Art QA' },
    }),
  ).user;
  users.push(user.id);
  check(await admin.from('tg_profiles').update({ setup_completed: true }).eq('id', user.id));
  const initial = check(await anon.rpc('tg_api', { route: 'bootstrap' }));
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: 'reduce',
  });
  await context.route('**/rest/v1/rpc/tg_api', (route) =>
    route.request().postDataJSON()?.route === 'events'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
      : route.continue(),
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/discover?submit=1');
  await page.getByText('Email & password', { exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: /Made something/ }).waitFor();
  const image = await sharp({
    create: { width: 600, height: 1000, channels: 3, background: '#c5b5f5' },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel('Add a photo of your work')
    .setInputFiles({ name: 'cloud-art-qa.png', mimeType: 'image/png', buffer: image });
  await page.getByText('Image ready', { exact: true }).waitFor({ timeout: 30000 });
  await page.getByLabel('Give it a title').fill('Private artwork QA');
  await page.locator('.cover-stage img').evaluate((i) => i.decode());
  assert.deepEqual(
    await page.locator('.cover-stage img').evaluate((i) => [i.naturalWidth, i.naturalHeight]),
    [600, 1000],
  );
  await page.locator('.submission-modal').screenshot({ path: `${evidence}/desktop.png` });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByLabel('Give it a title').scrollIntoViewIfNeeded();
    assert.ok(
      await page
        .locator('.submission-modal')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    await page.screenshot({ path: `${evidence}/form-${width}.png` });
  }
  await page.getByRole('checkbox', { name: /This is my work/ }).check();
  await page.getByRole('button', { name: 'Send for review', exact: true }).click();
  await page.getByText('In the review queue', { exact: true }).waitFor({ timeout: 30000 });
  const work = check(await admin.from('tg_products').select('*').eq('owner_id', user.id).single());
  assert.equal(work.status, 'pending');
  assert.equal(work.url, '');
  assert.equal(work.source, '');
  assert.equal(work.submission_details.kind, 'art');
  const cover = check(await admin.from('tg_covers').select('*').eq('id', work.cover_id).single());
  assert.equal(cover.kind, 'upload');
  assert.equal(cover.status, 'ready');
  assert.ok((await anon.storage.from('covers').createSignedUrl(cover.path, 60)).error);
  const current = check(await anon.rpc('tg_api', { route: 'bootstrap' }));
  assert.ok(!current.products.some((p) => p.id === work.id));
  for (const p of initial.products) assert.ok(current.products.some((q) => q.id === p.id));
  await page.goto(origin + '/my-work');
  await page.getByRole('heading', { name: 'My work.', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Private artwork QA', exact: true }).waitFor();
  await page.goto(origin + '/settings');
  await page.locator('[name=displayName]').fill('QA Creator');
  const username = 'qacreator' + Date.now();
  await page.locator('[name=username]').fill(username);
  await page.locator('[name=bio]').fill('Temporary profile for release verification.');
  await page.getByRole('button', { name: 'Use a photo', exact: true }).click();
  await page
    .getByLabel('Profile photo', { exact: true })
    .setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: image });
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.getByText('Profile saved. Looking good.').waitFor();
  const publicProfile = check(await anon.rpc('tg_api', { route: 'profiles/' + username }));
  assert.equal(publicProfile.profile.name, 'QA Creator');
  assert.equal(publicProfile.profile.email, undefined);
  assert.equal(publicProfile.products.length, 0);
  assert.ok(
    check(await anon.storage.from('covers').createSignedUrl(publicProfile.profile.avatar.path, 60))
      .signedUrl,
  );
  await page.goto(origin + '/profile/' + username);
  await page.getByRole('heading', { name: 'QA Creator', exact: true }).waitFor();
  await page.screenshot({ path: evidence + '/profile-mobile.png', fullPage: true });
  await page.goto(origin + '/settings');
  await page.getByRole('checkbox', { name: /Show my public profile/ }).uncheck();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.getByText('Profile saved. Looking good.').waitFor();
  assert.ok((await anon.rpc('tg_api', { route: 'profiles/' + username })).error);
  assert.ok(
    (await anon.storage.from('covers').createSignedUrl(publicProfile.profile.avatar.path, 60))
      .error,
  );
  passed.push(
    'Hosted settings, avatar storage, public profile routing, private pending work and profile visibility work with real Supabase.',
  );
  assert.deepEqual(errors, []);
  passed.push(
    'Real Supabase sign-in, portrait upload, title-only submission and pending review succeed.',
    '600 × 1000 image retains its dimensions; 390px and 320px form has no horizontal overflow.',
    'Pending image cannot be signed by an anonymous visitor; existing public listings remain available.',
    'No JavaScript page errors. QA artwork was never published.',
  );
  writeFileSync(`${evidence}/report.json`, JSON.stringify({ passed }, null, 2));
  for (const item of passed) console.log('PASS: ' + item);
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page)
    await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  server?.kill();
  if (users.length) {
    check(await admin.from('tg_profiles').update({ avatar_id: null }).in('id', users));
    check(await admin.from('tg_products').delete().in('owner_id', users));
    const covers = check(await admin.from('tg_covers').select('id,path').in('owner_id', users));
    if (covers.length) {
      check(await admin.storage.from('covers').remove(covers.map((c) => c.path)));
      check(
        await admin
          .from('tg_covers')
          .delete()
          .in(
            'id',
            covers.map((c) => c.id),
          ),
      );
    }
    for (const id of users) check(await admin.auth.admin.deleteUser(id));
  }
}
