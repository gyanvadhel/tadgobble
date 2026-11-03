import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import * as media from 'mediabunny';
import { videoFixtures } from './helpers/video-fixtures.mjs';
import { inspectVideo, VIDEO_POLICY } from '../supabase/functions/_shared/video.mjs';
mkdirSync('test-results', { recursive: true });
process.env.DATA_DIR = mkdtempSync(path.resolve('test-results/video-unit-'));
process.env.APP_URL = 'http://127.0.0.1:3000';
process.env.SEED_CATALOG = 'false';
const fixtures = videoFixtures(path.join(process.env.DATA_DIR, 'fixtures'));
const { handle } = await import('../lib/api.mjs');
const { get, run, now } = await import('../lib/db.mjs');
const { createSession } = await import('../lib/auth.mjs');
const { videoResponse } = await import('../lib/videos.mjs');
for (const [id, role] of [
  ['maker', 'member'],
  ['other', 'member'],
  ['admin', 'admin'],
])
  run('INSERT INTO users VALUES(?,?,?,?,?,?)', id, id + '@example.test', id, 'unused', role, now());
const poster = await sharp({
  create: { width: 360, height: 640, channels: 3, background: '#c5b5f5' },
})
  .webp()
  .toBuffer();
const form = (bytes = fixtures.short.bytes) => {
  const f = new FormData();
  f.set('file', new Blob([bytes], { type: 'video/mp4' }), 'clip.mp4');
  f.set('poster', new Blob([poster], { type: 'image/webp' }), 'poster.webp');
  return f;
};
async function api(user, route, body) {
  const multipart = body instanceof FormData;
  const response = await handle(
    new Request(process.env.APP_URL + '/api/' + route, {
      method: 'POST',
      headers: {
        origin: process.env.APP_URL,
        ...(multipart ? {} : { 'Content-Type': 'application/json' }),
        ...(user ? { cookie: 'ap_session=' + createSession(user) } : {}),
      },
      body: multipart ? body : JSON.stringify(body),
    }),
    route.split('/'),
  );
  return { status: response.status, ...(await response.json()) };
}
test('actual video data supplies trusted duration, codec, dimensions and audio metadata', async () => {
  const info = await inspectVideo(new Blob([fixtures.short.bytes], { type: 'text/html' }), media);
  assert.equal(info.width, 360);
  assert.equal(info.height, 640);
  assert.equal(info.codec, 'avc');
  assert.equal(info.hasAudio, true);
  assert.ok(info.duration >= 2 && info.duration < 2.1);
  assert.equal(info.mime, 'video/mp4');
  await assert.rejects(() => inspectVideo(new Blob([fixtures.long.bytes]), media), /30 seconds/);
  await assert.rejects(
    () => inspectVideo(new Blob(['<html>' + '.'.repeat(1000)]), media),
    /could not be read/,
  );
  await assert.rejects(
    () => inspectVideo(new Blob([new Uint8Array(VIDEO_POLICY.bytes + 1)]), media),
    /under 5 MB/,
  );
});
test('video uploads remain private, support seeking, enforce ownership and follow review changes', async () => {
  assert.equal((await api(null, 'videos/upload', form())).status, 401);
  assert.equal((await api('maker', 'videos/upload', form(fixtures.long.bytes))).status, 400);
  const upload = await api('maker', 'videos/upload', form());
  assert.equal(upload.status, 200, upload.error);
  const cover = upload.cover,
    vid = cover.video.id;
  assert.equal((await api(null, 'videos/play', { id: vid })).status, 404);
  assert.equal((await api('other', 'videos/play', { id: vid })).status, 404);
  assert.equal((await api('maker', 'videos/play', { id: vid })).status, 200);
  assert.equal(
    (
      await api('maker', 'profile/save', {
        name: 'Maker',
        username: 'makername',
        avatarId: cover.id,
      })
    ).status,
    400,
  );
  const body = { kind: 'art', name: 'A little motion', ownership: true, coverId: cover.id };
  assert.equal((await api('other', 'submit', body)).status, 400);
  const sent = await api('maker', 'submit', body);
  assert.equal(sent.status, 200, sent.error);
  const product = get('SELECT * FROM products WHERE slug=?', sent.slug);
  assert.equal(
    (await api('admin', 'studio/product', { id: product.id, action: 'verify', confirmed: true }))
      .status,
    200,
  );
  assert.equal((await api(null, 'videos/play', { id: vid })).status, 200);
  const partial = videoResponse(
    new Request('http://localhost', { headers: { range: 'bytes=0-99' } }),
    vid,
    null,
  );
  assert.equal(partial.status, 206);
  assert.equal((await partial.arrayBuffer()).byteLength, 100);
  assert.equal(
    videoResponse(
      new Request('http://localhost', { headers: { range: 'bytes=999999999-' } }),
      vid,
      null,
    ).status,
    416,
  );
  assert.equal((await api('maker', 'works/update', { ...body, id: product.id })).status, 200);
  // The live version, video included, stays up while the edit is reviewed.
  assert.equal((await api(null, 'videos/play', { id: vid })).status, 200);
  await api('admin', 'studio/product', { id: product.id, action: 'reject' });
  assert.equal((await api(null, 'videos/play', { id: vid })).status, 200);
  assert.equal((await api('admin', 'videos/play', { id: vid })).status, 200);
});
