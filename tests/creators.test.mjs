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
  // Posting is instant: the work is public the moment it is sent.
  assert.equal(work.status, 'published');
  assert.equal((await api(null, 'profiles/aridraws')).products.length, 1);
  const asked = await api('admin', 'studio/product', {
    id: work.id,
    action: 'changes',
    feedback: 'Please add the medium.',
  });
  assert.equal(asked.status, 400);
  assert.match(asked.error, /no longer/);
  // An admin can still take a work down; it stays down when its maker edits it.
  await api('admin', 'studio/product', {
    id: work.id,
    action: 'reject',
    feedback: 'This is not your own work.',
  });
  assert.equal((await api(null, 'profiles/aridraws')).products.length, 0);
  assert.match((await api('artist', 'my-work')).products[0].review_note, /not your own/);
  await api('artist', 'works/update', {
    ...body,
    id: work.id,
    description: 'Acrylic on paper.',
    status: 'published',
  });
  const stillDown = get('SELECT * FROM products WHERE id=?', work.id);
  assert.equal(stillDown.status, 'rejected');
  assert.equal(stillDown.description, 'Acrylic on paper.');
  assert.match(stillDown.review_note, /not your own/);
  assert.equal((await api('admin', 'studio/product', { id: work.id, action: 'verify' })).ok, true);
  assert.equal(get('SELECT status FROM products WHERE id=?', work.id).status, 'published');
  assert.equal(
    (await api('admin', 'studio/product', { id: work.id, action: 'verify' })).status,
    400,
  );
  const live = (await api(null, 'profiles/aridraws')).products[0];
  assert.equal(live.creator_username, 'aridraws');
  assert.equal(live.review_note, undefined);
  assert.equal(live.owner_id, undefined);
  // "Checked" is a studio note; it needs an admin and a confirmation.
  assert.equal(
    (await api('artist', 'studio/product', { id: work.id, action: 'checked', confirmed: true }))
      .status,
    403,
  );
  assert.equal(
    (await api('admin', 'studio/product', { id: work.id, action: 'checked' })).status,
    400,
  );
  await api('admin', 'studio/product', { id: work.id, action: 'checked', confirmed: true });
  assert.ok(get('SELECT verified_at FROM products WHERE id=?', work.id).verified_at);
  await api('artist', 'works/update', {
    ...body,
    id: work.id,
    onBehalf: true,
    creatorName: 'Mika',
    creatorInstagram: '@mika.draws',
  });
  // An edit to live work is live at once, and it clears the checked note.
  const after = await api(null, 'products/' + work.slug);
  assert.equal(after.product.owner_name, 'Mika');
  assert.equal(after.product.pendingEdit, undefined);
  assert.equal((await api(null, 'profiles/aridraws')).products.length, 0);
  const mine = (await api('artist', 'my-work')).products[0];
  assert.equal(mine.pendingEdit, undefined);
  assert.equal(mine.status, 'published');
  assert.equal(
    get('SELECT pending_edit, verified_at FROM products WHERE id=?', work.id).pending_edit,
    '',
  );
  assert.equal(get('SELECT verified_at FROM products WHERE id=?', work.id).verified_at, null);
  const listed = (await api('admin', 'studio')).products.find((p) => p.id === work.id);
  assert.equal(listed.status, 'published');
  assert.equal(listed.owner_name, 'Mika');
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
  await api('artist', 'works/update', { ...body, id: work.id, name: 'Pizza slice, burnt' });
  const kept = await api(null, 'products/' + work.slug);
  assert.equal(kept.product.name, 'Pizza slice, burnt');
  assert.equal(get('SELECT status FROM products WHERE id=?', work.id).status, 'published');
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

test('local follows toggle, show on profiles, refuse yourself and hidden profiles, and go with the account', async () => {
  for (const id of ['followmaker', 'followfan', 'followhidden'])
    run('INSERT INTO users VALUES(?,?,?,?,?,?)', id, id + '@example.test', id, 'unused', 'member', now());
  await api('followmaker', 'bootstrap');
  await api('followhidden', 'bootstrap');
  const { creatorProfile } = await import('../lib/db.mjs');
  const maker = creatorProfile('followmaker').username;
  const hidden = creatorProfile('followhidden').username;
  run('UPDATE creator_profiles SET visible=0 WHERE user_id=?', 'followhidden');
  assert.equal((await api(null, 'follow', { username: maker })).status, 401);
  assert.equal((await api('followmaker', 'follow', { username: maker })).status, 400);
  assert.equal((await api('followfan', 'follow', { username: hidden })).status, 404);
  assert.equal((await api('followfan', 'follow', { username: 'nobody-here' })).status, 404);
  const on = await api('followfan', 'follow', { username: maker.toUpperCase() });
  assert.equal(on.following, true);
  assert.equal(on.followers, 1);
  const seen = await api('followfan', 'profiles/' + maker);
  assert.equal(seen.followers, 1);
  assert.equal(seen.following, true);
  const anon = await api(null, 'profiles/' + maker);
  assert.equal(anon.followers, 1);
  assert.equal(anon.following, false);
  const off = await api('followfan', 'follow', { username: maker });
  assert.equal(off.following, false);
  assert.equal(off.followers, 0);
  await api('followfan', 'follow', { username: maker });
  assert.equal((await api('followfan', 'account/delete', {})).status, 200);
  assert.equal(get('SELECT count(*) as n FROM follows').n, 0);
  assert.equal((await api(null, 'profiles/' + maker)).followers, 0);
});
