import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { cloudAdmin, check } from './cloud-admin.mjs';
import { videoFixtures } from '../tests/helpers/video-fixtures.mjs';
const dir = 'test-results/cloud-video';
mkdirSync(dir, { recursive: true });
const fixtures = videoFixtures(dir + '/fixtures');
const origin = process.env.CLOUD_TEST_URL || 'http://127.0.0.1:4186';
const server = process.env.CLOUD_TEST_URL
  ? null
  : spawn(process.execPath, ['scripts/serve-hosting.mjs'], {
      env: { ...process.env, PORT: '4186' },
      stdio: 'ignore',
      windowsHide: true,
    });
const admin = cloudAdmin(),
  email = 'video-qa-' + Date.now() + '@example.com',
  password = randomBytes(24).toString('base64url');
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
let user, browser;
const checks = [],
  errors = [];
try {
  if (server)
    for (let i = 0; i < 40; i++) {
      try {
        if ((await fetch(origin + '/discover')).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
  user = check(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'Video QA' },
    }),
  ).user;
  check(await admin.from('tg_profiles').update({ setup_completed: true }).eq('id', user.id));
  const initial = check(await anon.rpc('tg_api', { route: 'bootstrap' }))
    .products.map((p) => p.id)
    .sort();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await context.route('**/rest/v1/rpc/tg_api', (r) =>
    r.request().postDataJSON()?.route === 'events'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
      : r.continue(),
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/discover?submit=1');
  await page.getByText('Email & password', { exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  const response = page.waitForResponse((r) => r.url().includes('/functions/v1/video-upload'), {
    timeout: 60000,
  });
  await page.getByLabel('Add a video of your work').setInputFiles(fixtures.short.path);
  const upload = await response,
    result = await upload.json();
  assert.equal(upload.status(), 200, JSON.stringify(result));
  await page.getByRole('button', { name: 'Play Your work video', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Play Your work video', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  await page.locator('video').evaluate((v) => v.pause());
  assert.equal(await page.locator('video').evaluate((v) => v.muted), false);
  await page.screenshot({ path: dir + '/upload-mobile.png', fullPage: true });
  const record = check(await admin.from('tg_videos').select('*').eq('owner_id', user.id).single());
  assert.ok((await anon.storage.from('videos').createSignedUrl(record.path, 60)).error);
  assert.ok((await anon.rpc('tg_video_play', { video_id: record.id })).error);
  await page.getByLabel('Give it a title').fill('Private video QA');
  await page.getByRole('checkbox', { name: /This is my work/ }).check();
  await page.getByRole('button', { name: 'Send for review', exact: true }).click();
  await page.getByText('In the review queue', { exact: true }).waitFor();
  const work = check(await admin.from('tg_products').select('*').eq('owner_id', user.id).single());
  assert.equal(work.status, 'pending');
  await page.goto(origin + '/my-work');
  await page.locator('.video-badge').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  checks.push(
    'Real hosted video upload, automatic poster, signed tap-to-play with sound, pending submission and My work succeed. Unapproved video bytes and playback links remain private.',
  );
  const member = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  check(await member.auth.signInWithPassword({ email, password }));
  const poster = await sharp({
    create: { width: 360, height: 640, channels: 3, background: '#c5b5f5' },
  })
    .webp()
    .toBuffer();
  const invalid = new FormData();
  invalid.set('file', new Blob([fixtures.long.bytes], { type: 'video/mp4' }), 'lie.mp4');
  invalid.set('poster', new Blob([poster], { type: 'image/webp' }), 'poster.webp');
  invalid.set('duration', '2');
  const rejected = await member.functions.invoke('video-upload', { body: invalid });
  assert.ok(rejected.error);
  const errorBody = await rejected.error.context.json();
  assert.match(errorBody.error, /30 seconds/);
  await member.auth.signOut();
  assert.equal(check(await admin.from('tg_videos').select('id').eq('owner_id', user.id)).length, 1);
  const after = check(await anon.rpc('tg_api', { route: 'bootstrap' }))
    .products.map((p) => p.id)
    .sort();
  assert.deepEqual(after, initial);
  assert.deepEqual(errors, []);
  checks.push(
    'The Edge Function rejects an overlong video even when its submitted duration lies. No QA video was published and existing discoveries are unchanged.',
  );
  writeFileSync(dir + '/report.json', JSON.stringify({ checks, errors }, null, 2));
  for (const c of checks) console.log('PASS: ' + c);
} catch (error) {
  await browser
    ?.contexts()[0]
    ?.pages()[0]
    ?.screenshot({ path: dir + '/failure.png', fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  server?.kill();
  if (user) {
    const videos = check(await admin.from('tg_videos').select('path').eq('owner_id', user.id));
    if (videos.length) check(await admin.storage.from('videos').remove(videos.map((v) => v.path)));
    check(await admin.from('tg_products').delete().eq('owner_id', user.id));
    const covers = check(await admin.from('tg_covers').select('id,path').eq('owner_id', user.id));
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
    check(await admin.auth.admin.deleteUser(user.id));
  }
}
