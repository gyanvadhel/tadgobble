import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
mkdirSync('test-results', { recursive: true });
process.env.DATA_DIR = mkdtempSync(path.resolve('test-results/creators-unit-'));
process.env.APP_URL = 'http://127.0.0.1:3000';
process.env.SEED_CATALOG = 'false';
const { handle } = await import('../lib/api.mjs');
const { run, get, now } = await import('../lib/db.mjs');
const { createSession } = await import('../lib/auth.mjs');
const { storeCover, coverResponse } = await import('../lib/covers.mjs');
for (const [id, role] of [
  ['artist', 'member'],
  ['other', 'member'],
  ['admin', 'admin'],
])
  run('INSERT INTO users VALUES(?,?,?,?,?,?)', id, id + '@example.test', id, 'unused', role, now());
async function api(user, route, body) {
  const result = await handle(
    new Request(process.env.APP_URL + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: {
        origin: process.env.APP_URL,
        'content-type': 'application/json',
        ...(user ? { cookie: 'ap_session=' + createSession(user) } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    route.split('/'),
  );
  const data = await result.json();
  return { status: result.status, ...data };
}
test('local profiles protect identity, owned avatars, editable submissions and correct author credit', async () => {
  const settings = {
    name: 'Ari Draws',
    username: 'aridraws',
    bio: 'Paintings after midnight.',
    visible: true,
    instagram: 'ari.draws',
  };
  assert.equal((await api(null, 'profile/save', settings)).status, 401);
  const photo = await storeCover(
    await sharp({ create: { width: 400, height: 600, channels: 3, background: '#c5b5f5' } })
      .png()
      .toBuffer(),
    'artist',
    'upload',
  );
  assert.equal(
    (await api('other', 'profile/save', { ...settings, avatarId: photo.id })).status,
    400,
  );
  assert.equal(
    (await api('artist', 'profile/save', { ...settings, avatarId: photo.id, role: 'admin' }))
      .status,
    200,
  );
  assert.equal((await api('other', 'profile/save', settings)).status, 400);
  assert.equal((await api('artist', 'bootstrap')).user.role, 'member');
  const profile = await api(null, 'profiles/aridraws');
  assert.equal(profile.profile.email, undefined);
  assert.equal(profile.profile.user_id, undefined);
  assert.equal(coverResponse(photo.id, null).status, 200);
  const body = { kind: 'art', name: 'Quiet hills', coverId: photo.id, ownership: true };
  const response = await api('artist', 'submit', body),
    work = get('SELECT * FROM products WHERE slug=?', response.slug);
  assert.equal((await api('other', 'my-work')).products.length, 0);
  assert.equal((await api('other', 'works/update', { ...body, id: work.id })).status, 404);
  assert.equal((await api(null, 'profiles/aridraws')).products.length, 0);
  await api('admin', 'studio/product', {
    id: work.id,
    action: 'changes',
    feedback: 'Please add the medium.',
  });
  assert.match((await api('artist', 'my-work')).products[0].review_note, /medium/);
  await api('artist', 'works/update', {
    ...body,
    id: work.id,
    description: 'Acrylic on paper.',
    status: 'published',
  });
  assert.equal(get('SELECT status FROM products WHERE id=?', work.id).status, 'pending');
  await api('admin', 'studio/product', { id: work.id, action: 'verify', confirmed: true });
  const live = (await api(null, 'profiles/aridraws')).products[0];
  assert.equal(live.creator_username, 'aridraws');
  assert.equal(live.review_note, undefined);
  assert.equal(live.owner_id, undefined);
  await api('artist', 'works/update', {
    ...body,
    id: work.id,
    onBehalf: true,
    creatorName: 'Mika',
    creatorInstagram: '@mika.draws',
  });
  // The live version stays up, unchanged, while the edit waits for review.
  const during = await api(null, 'products/' + work.slug);
  assert.equal(during.product.owner_name, 'Ari Draws');
  assert.equal(during.product.pendingEdit, undefined);
  assert.equal((await api(null, 'profiles/aridraws')).products.length, 1);
  const mine = (await api('artist', 'my-work')).products[0];
  assert.equal(mine.pendingEdit, true);
  assert.equal(mine.status, 'published');
  assert.equal(mine.owner_name, 'Mika');
  const queued = (await api('admin', 'studio')).products.find((p) => p.id === work.id);
  assert.equal(queued.status, 'pending');
  assert.equal(queued.owner_name, 'Mika');
  await api('admin', 'studio/product', { id: work.id, action: 'verify', confirmed: true });
  assert.equal((await api(null, 'profiles/aridraws')).products.length, 0);
  assert.equal((await api(null, 'products/' + work.slug)).product.owner_name, 'Mika');
  await api('artist', 'profile/save', { ...settings, visible: false, avatarId: photo.id });
  assert.equal((await api(null, 'profiles/aridraws')).status, 404);
  await api('admin', 'studio/product', { id: work.id, action: 'reject' });
  assert.throws(() => coverResponse(photo.id, null));
});

test('local creators can delete their own work, and edits cannot change its kind', async () => {
  const photo = await storeCover(
    await sharp({ create: { width: 300, height: 300, channels: 3, background: '#f5d5b5' } })
      .png()
      .toBuffer(),
    'artist',
    'upload',
  );
  const body = { kind: 'art', name: 'Pizza slice', coverId: photo.id, ownership: true };
  const work = get(
    'SELECT * FROM products WHERE slug=?',
    (await api('artist', 'submit', body)).slug,
  );
  const asApp = await api('artist', 'works/update', {
    ...body,
    id: work.id,
    kind: 'app',
    url: 'https://example.com',
    tagline: 'Now an app',
  });
  assert.equal(asApp.status, 400);
  assert.match(asApp.error, /kind of work/);
  assert.equal(
    (await api('artist', 'works/update', { ...body, id: work.id, name: 'Pizza slice, tidied' }))
      .status,
    200,
  );
  await api('admin', 'studio/product', { id: work.id, action: 'verify', confirmed: true });
  await api('artist', 'works/update', { ...body, id: work.id, name: 'Pizza slice, burnt' });
  await api('admin', 'studio/product', {
    id: work.id,
    action: 'changes',
    feedback: 'Keep the first title.',
  });
  const kept = await api(null, 'products/' + work.slug);
  assert.equal(kept.product.name, 'Pizza slice, tidied');
  assert.equal(get('SELECT status FROM products WHERE id=?', work.id).status, 'published');
  assert.match(
    (await api('artist', 'my-work')).products.find((p) => p.id === work.id).review_note,
    /first title/,
  );
  await api('other', 'save', { productId: work.id });
  await api('other', 'comment', { productId: work.id, body: 'Looks tasty.' });
  assert.equal(get('SELECT count(*) as n FROM comments WHERE product_id=?', work.id).n, 1);
  const thread = async () => (await api(null, 'products/' + work.slug)).comments;
  const top = (await thread())[0];
  await api('artist', 'comment', { productId: work.id, body: 'Thank you!', parentId: top.id });
  const reply = (await thread()).find((c) => c.parent_id === top.id);
  // Answering a reply joins the same thread instead of nesting deeper.
  await api('other', 'comment', {
    productId: work.id,
    body: '@artist anytime',
    parentId: reply.id,
  });
  assert.equal((await thread()).filter((c) => c.parent_id === top.id).length, 2);
  assert.equal(
    (await api('other', 'comment', { productId: work.id, body: 'Lost', parentId: 'missing' }))
      .status,
    404,
  );
  assert.equal((await api('artist', 'comment/delete', { id: top.id })).status, 403);
  assert.equal((await api('other', 'comment/delete', { id: top.id })).status, 200);
  const removed = (await thread()).find((c) => c.id === top.id);
  assert.equal(removed.removed, true);
  assert.equal(removed.body, undefined);
  assert.equal(removed.user_id, undefined);
  assert.equal((await api('other', 'comment/delete', { id: top.id })).status, 403);
  assert.equal(
    (await api(null, 'bootstrap')).products.find((x) => x.id === work.id).comment_count,
    2,
  );
  for (const r of (await thread()).filter((c) => c.parent_id === top.id))
    assert.equal((await api(r.user_id, 'comment/delete', { id: r.id })).status, 200);
  // Once its last reply goes, the placeholder goes too.
  assert.equal(get('SELECT count(*) as n FROM comments WHERE product_id=?', work.id).n, 0);
  await api('other', 'comment', { productId: work.id, body: 'Looks tasty.' });
  assert.equal((await api('other', 'works/delete', { id: work.id })).status, 404);
  assert.equal((await api(null, 'works/delete', { id: work.id })).status, 401);
  assert.equal((await api('artist', 'works/delete', { id: work.id })).status, 200);
  assert.equal(get('SELECT id FROM products WHERE id=?', work.id), undefined);
  assert.equal(get('SELECT count(*) as n FROM comments WHERE product_id=?', work.id).n, 0);
  assert.equal((await api(null, 'products/' + work.slug)).status, 404);
  assert.equal(get('SELECT id FROM product_covers WHERE id=?', photo.id), undefined);
  assert.throws(() => coverResponse(photo.id, 'artist'));
});
