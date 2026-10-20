import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
mkdirSync('test-results', { recursive: true });
process.env.DATA_DIR = mkdtempSync(path.resolve('test-results/covers-unit-'));
process.env.SEED_CATALOG = 'false';
process.env.APP_URL = 'http://127.0.0.1:3000';
const { isPublicAddress, publicTarget, readPublicResource } = await import('../lib/capture.mjs');
const { handle } = await import('../lib/api.mjs');
const { storeCover, coverResponse, ownedCover } = await import('../lib/covers.mjs');
const { run, now, get } = await import('../lib/db.mjs');
const { createSession } = await import('../lib/auth.mjs');
for (const [id, role] of [
  ['maker', 'member'],
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
const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#c5b5f5' } })
  .png()
  .toBuffer();
function post(route, body, user = 'maker', origin = process.env.APP_URL) {
  return handle(
    new Request(`${process.env.APP_URL}/api/${route}`, {
      method: 'POST',
      headers: {
        origin,
        ...(user ? { cookie: `ap_session=${createSession(user)}` } : {}),
        ...(!(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      },
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
    route.split('/'),
  );
}

test('capture rejects private, loopback, metadata, encoded, mapped, and reserved addresses', async () => {
  for (const ip of [
    '0.0.0.0',
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.100.100.200',
    '198.18.0.1',
    '224.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '2002:7f00:1::',
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ['93.184.215.14', '1.1.1.1', '2606:4700:4700::1111'])
    assert.equal(isPublicAddress(ip), true);
  for (const url of [
    'http://127.0.0.1',
    'http://2130706433',
    'http://0x7f000001',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'http://169.254.169.254/latest/meta-data',
    'file:///etc/passwd',
    'https://user:pass@example.com',
    'https://example.com:22',
  ])
    await assert.rejects(publicTarget(url));
  await assert.rejects(
    publicTarget('https://rebind.example', async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]),
  );
  const target = await publicTarget('https://public.example', async () => [
    { address: '93.184.215.14', family: 4 },
  ]);
  assert.equal(target.address, '93.184.215.14');
  await assert.rejects(readPublicResource('http://127.0.0.1:3000/api/studio'));
});

test('uploads decode actual raster data and produce a normalized cover; SVG and fake images fail', async () => {
  const cover = await storeCover(png, 'maker', 'upload');
  const response = coverResponse(cover.id, { id: 'maker', role: 'member' });
  assert.equal(response.headers.get('content-type'), 'image/webp');
  const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.equal(meta.width, 1600);
  assert.equal(meta.height, 1200);
  assert.equal(meta.format, 'webp');
  await assert.rejects(
    storeCover(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"/>'),
      'maker',
      'upload',
    ),
  );
  await assert.rejects(storeCover(Buffer.from('not a real JPEG'), 'maker', 'upload'));
  await assert.rejects(
    storeCover(
      await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } })
        .png()
        .toBuffer(),
      'maker',
      'upload',
    ),
  );
});

test('unpublished covers are private, another maker cannot attach them, and approval exposes only the chosen image', async () => {
  const cover = await storeCover(png, 'maker', 'upload');
  assert.throws(() => coverResponse(cover.id, null), { status: 404 });
  assert.throws(() => coverResponse(cover.id, { id: 'other', role: 'member' }), { status: 404 });
  assert.equal(coverResponse(cover.id, { id: 'admin', role: 'admin' }).status, 200);
  assert.throws(() => ownedCover(cover.id, 'other'));
  const details = {
    name: 'Cover tool',
    url: 'https://example.com',
    tagline: 'A cover test.',
    category: 'Design',
    ownership: true,
    coverId: cover.id,
  };
  assert.equal((await post('submit', details, 'other')).status, 400);
  assert.equal((await post('submit', details)).status, 200);
  const product = get('SELECT * FROM products WHERE cover_id=?', cover.id);
  assert.equal(product.status, 'pending');
  assert.throws(() => coverResponse(cover.id, null));
  assert.equal(
    (await post('studio/product', { id: product.id, action: 'verify', confirmed: true }, 'admin'))
      .status,
    200,
  );
  assert.equal(coverResponse(cover.id, null).status, 200);
  assert.equal(
    (await post('studio/product', { id: product.id, action: 'reject' }, 'admin')).status,
    200,
  );
  assert.throws(() => coverResponse(cover.id, null), { status: 404 });
});

test('cover routes require login/origin, bound upload sizes, and accept valid multipart uploads', async () => {
  assert.equal((await post('covers/capture', { url: 'https://example.com' }, null)).status, 401);
  assert.equal(
    (
      await post(
        'covers/capture',
        { url: 'https://example.com' },
        'maker',
        'https://foreign.example',
      )
    ).status,
    403,
  );
  assert.equal((await post('covers/capture', { url: 'http://127.0.0.1' })).status, 422);
  const form = new FormData();
  form.set('file', new Blob([png], { type: 'image/png' }), 'cover.png');
  const response = await post('covers/upload', form);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cover.kind, 'upload');
  const tooBig = new FormData();
  tooBig.set('file', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)]), 'large.png');
  assert.equal((await post('covers/upload', tooBig)).status, 400);
});
