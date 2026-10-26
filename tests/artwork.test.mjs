import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
mkdirSync('test-results', { recursive: true });
process.env.DATA_DIR = mkdtempSync(path.resolve('test-results/art-unit-'));
process.env.SEED_CATALOG = 'false';
process.env.APP_URL = 'http://127.0.0.1:3000';
const { handle } = await import('../lib/api.mjs');
const { storeCover, coverResponse } = await import('../lib/covers.mjs');
const { run, now, get } = await import('../lib/db.mjs');
const { createSession } = await import('../lib/auth.mjs');
for (const [id, role] of [
  ['artist', 'member'],
  ['other', 'member'],
  ['admin', 'admin'],
])
  run(
    'INSERT INTO users VALUES (?,?,?,?,?,?)',
    id,
    `${id}@test.example`,
    id,
    'unused',
    role,
    now(),
  );
function post(route, body, user = 'artist') {
  return handle(
    new Request(`${process.env.APP_URL}/api/${route}`, {
      method: 'POST',
      headers: {
        origin: process.env.APP_URL,
        'content-type': 'application/json',
        cookie: `ap_session=${createSession(user)}`,
      },
      body: JSON.stringify(body),
    }),
    route.split('/'),
  );
}

test('portrait and wide uploads retain the entire image without upscaling', async () => {
  for (const [width, height] of [
    [400, 800],
    [2400, 800],
  ]) {
    const image = await sharp({ create: { width, height, channels: 3, background: '#c5b5f5' } })
      .png()
      .toBuffer();
    const cover = await storeCover(image, 'artist', 'upload');
    const bytes = Buffer.from(
      await coverResponse(cover.id, { id: 'artist', role: 'member' }).arrayBuffer(),
    );
    const meta = await sharp(bytes).metadata();
    const scale = Math.min(1, 1600 / width, 1600 / height);
    assert.equal(meta.width, Math.round(width * scale));
    assert.equal(meta.height, Math.round(height * scale));
  }
});

test('local art submissions accept only a title and owned image, remain private, and can be reviewed', async () => {
  const bytes = await sharp({
    create: { width: 400, height: 800, channels: 3, background: '#faf5ad' },
  })
    .png()
    .toBuffer();
  const cover = await storeCover(bytes, 'artist', 'upload');
  const foreign = await storeCover(bytes, 'other', 'upload');
  const body = { kind: 'art', name: 'My first painting', ownership: true };
  assert.equal((await post('submit', body)).status, 400);
  assert.equal((await post('submit', { ...body, coverId: foreign.id })).status, 400);
  assert.equal(
    (await post('submit', { ...body, coverId: cover.id, url: 'javascript:alert(1)' })).status,
    400,
  );
  const response = await post('submit', { ...body, coverId: cover.id });
  assert.equal(response.status, 200);
  const { slug } = await response.json();
  const p = get('SELECT * FROM products WHERE slug=?', slug);
  assert.equal(p.url, '');
  assert.equal(p.source, '');
  assert.equal(p.status, 'pending');
  assert.equal(JSON.parse(p.submission_details).kind, 'art');
  assert.throws(() => coverResponse(cover.id, null), { status: 404 });
  assert.equal(
    (await post('studio/product', { id: p.id, action: 'verify', confirmed: true }, 'admin')).status,
    200,
  );
  assert.equal(coverResponse(cover.id, null).status, 200);
  assert.equal(
    (await post('studio/product', { id: p.id, action: 'cover', coverId: null }, 'admin')).status,
    400,
  );
});
