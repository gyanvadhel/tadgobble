import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
let db;
const owner = '11111111-1111-4111-8111-111111111111',
  maker = '22222222-2222-4222-8222-222222222222',
  other = '33333333-3333-4333-8333-333333333333';
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant select,insert on storage.objects to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  for (const migration of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const source = readFileSync('supabase/migrations/' + migration, 'utf8');
    try {
      await db.exec(source);
    } catch (error) {
      console.error(
        migration,
        error.message,
        error.position,
        error.internalPosition,
        error.internalQuery?.slice(0, 300),
        error.where,
      );
      if (error.position)
        console.error(source.slice(Number(error.position) - 150, Number(error.position) + 150));
      throw error;
    }
  }
  await db.query(
    'insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3),($4,$5,$6),($7,$8,$9)',
    [
      owner,
      'owner@example.test',
      { name: 'Owner' },
      maker,
      'maker@example.test',
      { name: 'Maker', role: 'admin' },
      other,
      'other@example.test',
      { name: 'Other' },
    ],
  );
  await db.query("update tg_profiles set role='admin' where id=$1", [owner]);
});
after(async () => db?.close());
async function api(user, route, payload = {}) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']);
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
  try {
    return (await db.query('select public.tg_api($1,$2) as data', [route, payload])).rows[0].data;
  } finally {
    await db.exec('reset role');
  }
}
const product = {
  name: 'Cloud check',
  tagline: 'A real test discovery',
  description: 'Useful product details.',
  url: 'https://example.com',
  category: 'Developer tools',
  audience: 'Everyone',
  pricing: 'Free',
  color: 'lilac',
  ownership: true,
  platforms: ['Web app'],
  facts: 'A useful thing',
};
let pending, cover;
test('member metadata cannot grant studio access; raw tables are closed', async () => {
  assert.equal((await api(owner, 'studio')).connection.dailyLimit, null);
  assert.equal((await api(maker, 'bootstrap')).user.role, 'member');
  await assert.rejects(() => api(maker, 'studio'), /Studio access/);
  await db.exec('set role authenticated');
  await assert.rejects(() => db.query('select * from public.tg_profiles'), /permission denied/);
  await db.exec('reset role');
});
test('pending submission stays private and only admin can approve it', async () => {
  pending = await api(maker, 'submit', product);
  assert.equal((await api(null, 'bootstrap')).products.length, 0);
  await assert.rejects(() => api(null, 'products/' + pending.slug), /not found/);
  const { products } = await api(owner, 'studio');
  pending.id = products[0].id;
  await assert.rejects(
    () => api(maker, 'studio/product', { id: pending.id, action: 'verify', confirmed: true }),
    /Studio access/,
  );
  await assert.rejects(
    () => api(owner, 'studio/product', { id: pending.id, action: 'verify' }),
    /Confirm/,
  );
  await api(owner, 'studio/product', { id: pending.id, action: 'verify', confirmed: true });
  assert.equal((await api(null, 'bootstrap')).products.length, 1);
});
test('saves and comments enforce account ownership', async () => {
  assert.equal((await api(maker, 'save', { productId: pending.id })).saved, true);
  assert.equal((await api(maker, 'bootstrap')).products[0].saved, true);
  assert.equal((await api(other, 'bootstrap')).products[0].saved, false);
  await api(maker, 'comment', { productId: pending.id, body: 'This is useful.' });
  const { comments } = await api(null, 'products/' + pending.slug);
  await assert.rejects(() => api(other, 'comment/delete', { id: comments[0].id }), /cannot remove/);
  await api(maker, 'comment/delete', { id: comments[0].id });
  assert.equal((await api(null, 'products/' + pending.slug)).comments.length, 0);
  const thread = async () => (await api(null, 'products/' + pending.slug)).comments;
  await api(other, 'comment', { productId: pending.id, body: 'How was this made?' });
  const top = (await thread())[0];
  await api(maker, 'comment', { productId: pending.id, body: 'By hand.', parentId: top.id });
  const reply = (await thread()).find((c) => c.parent_id === top.id);
  await api(other, 'comment', { productId: pending.id, body: '@maker nice', parentId: reply.id });
  assert.equal((await thread()).filter((c) => c.parent_id === top.id).length, 2);
  for (const parentId of ['not-a-uuid', '44444444-4444-4444-8444-444444444444'])
    await assert.rejects(
      () => api(other, 'comment', { productId: pending.id, body: 'Lost', parentId }),
      /no longer here/,
    );
  await assert.rejects(() => api(maker, 'comment/delete', { id: top.id }), /cannot remove/);
  await api(other, 'comment/delete', { id: top.id });
  const removed = (await thread()).find((c) => c.id === top.id);
  assert.equal(removed.removed, true);
  assert.equal(removed.body, undefined);
  assert.equal(removed.user_id, undefined);
  await assert.rejects(() => api(other, 'comment/delete', { id: top.id }), /cannot remove/);
  assert.equal(
    (await api(null, 'bootstrap')).products.find((x) => x.id === pending.id).comment_count,
    2,
  );
  for (const r of (await thread()).filter((c) => c.parent_id === top.id))
    await api(r.user_id, 'comment/delete', { id: r.id });
  assert.equal((await thread()).length, 0);
});
test('covers remain private until attached to an approved listing', async () => {
  ({ cover } = await api(maker, 'covers/prepare'));
  await db.query("insert into storage.objects(bucket_id,name) values('covers',$1)", [cover.path]);
  await api(maker, 'covers/complete', { id: cover.id });
  await assert.rejects(() => api(other, 'covers/status', { id: cover.id }), /not found/);
  await api(null, 'health');
  assert.equal(
    (await db.query('select tg_cover_read($1) as readable', [cover.path])).rows[0].readable,
    false,
  );
  await assert.rejects(() => api(other, 'submit', { ...product, coverId: cover.id }), /belonging/);
  const x = await api(maker, 'submit', { ...product, coverId: cover.id });
  const p = (await api(owner, 'studio')).products.find((p) => p.slug === x.slug);
  await api(owner, 'studio/product', { id: p.id, action: 'verify', confirmed: true });
  await api(null, 'health');
  assert.equal(
    (await db.query('select tg_cover_read($1) as readable', [cover.path])).rows[0].readable,
    true,
  );
  await api(owner, 'studio/product', { id: p.id, action: 'reject' });
  await api(null, 'health');
  assert.equal(
    (await db.query('select tg_cover_read($1) as readable', [cover.path])).rows[0].readable,
    false,
  );
});
test('worker claims are exclusive and require an admin and matching lease', async () => {
  await api(maker, 'covers/capture', { url: 'https://example.com' });
  await assert.rejects(() => api(maker, 'worker/claim'), /Studio access/);
  const { cover: c } = await api(owner, 'worker/claim');
  assert.ok(c.lease);
  assert.equal((await api(owner, 'worker/claim')).cover, null);
  await assert.rejects(() => api(owner, 'worker/complete', { id: c.id, lease: maker }), /lease/);
  await api(owner, 'worker/complete', { id: c.id, lease: c.lease, error: 'failed' });
  assert.equal((await api(maker, 'covers/status', { id: c.id })).cover.status, 'failed');
});
test('invalid URLs, categories and forged publishing fields are rejected or ignored', async () => {
  await assert.rejects(
    () => api(maker, 'submit', { ...product, url: 'javascript:alert(1)' }),
    /http/,
  );
  await assert.rejects(() => api(maker, 'submit', { ...product, category: 'made up' }), /category/);
  const x = await api(other, 'submit', {
    ...product,
    status: 'published',
    featured: true,
    sponsored: true,
  });
  const p = (await api(owner, 'studio')).products.find((p) => p.slug === x.slug);
  assert.equal(p.status, 'pending');
  assert.equal(p.featured, false);
  assert.equal(p.sponsored, false);
});
test('creative work needs an owned ready upload, but no website, tagline, or price', async () => {
  const art = { kind: 'art', name: 'Sunday sketch', ownership: true };
  await assert.rejects(() => api(null, 'submit', art), /sign in/i);
  await assert.rejects(() => api(other, 'submit', art), /photo/);
  await assert.rejects(() => api(other, 'submit', { ...art, coverId: cover.id }), /belonging/);
  const { cover: image } = await api(other, 'covers/prepare');
  await assert.rejects(() => api(other, 'submit', { ...art, coverId: image.id }), /belonging/);
  await db.query("insert into storage.objects(bucket_id,name) values('covers',$1)", [image.path]);
  await api(other, 'covers/complete', { id: image.id });
  await assert.rejects(
    () => api(other, 'submit', { ...art, coverId: image.id, url: 'javascript:alert(1)' }),
    /http/,
  );
  await assert.rejects(
    () => api(other, 'submit', { ...art, coverId: image.id, imageDescription: 'x'.repeat(401) }),
    /Image description/,
  );
  const { slug } = await api(other, 'submit', {
    ...art,
    coverId: image.id,
    imageDescription: 'Blue ink drawing of a tree.',
  });
  assert.ok(!(await api(null, 'bootstrap')).products.some((p) => p.slug === slug));
  const p = (await api(owner, 'studio')).products.find((p) => p.slug === slug);
  assert.equal(p.status, 'pending');
  assert.equal(p.url, '');
  assert.equal(p.source, '');
  assert.equal(p.submission.kind, 'art');
  assert.equal(p.submission.imageDescription, 'Blue ink drawing of a tree.');
  assert.equal(p.category, 'Art & design');
  await assert.rejects(
    () => api(other, 'studio/product', { id: p.id, action: 'verify', confirmed: true }),
    /Studio access/,
  );
  await api(owner, 'studio/product', { id: p.id, action: 'verify', confirmed: true });
  assert.equal((await api(null, 'products/' + slug)).product.cover.id, image.id);
  await assert.rejects(
    () => api(owner, 'studio/product', { id: p.id, action: 'cover', coverId: null }),
    /uploaded image/,
  );
  await api(owner, 'studio/product', { id: p.id, action: 'reject' });
  const { cover: capture } = await api(other, 'covers/capture', { url: 'https://example.com/art' });
  await assert.rejects(() => api(other, 'submit', { ...art, coverId: capture.id }), /photo/);
  const linked = await api(other, 'submit', {
    ...art,
    coverId: image.id,
    category: 'Painting',
    url: 'https://example.com/artist',
  });
  const linkedWork = (await api(owner, 'studio')).products.find((p) => p.slug === linked.slug);
  assert.equal(linkedWork.url, 'https://example.com/artist');
});

test('profiles, avatars, review feedback and edits preserve privacy and attribution', async () => {
  const creator = '44444444-4444-4444-8444-444444444444';
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [
    creator,
    'private@example.test',
    { name: 'Ari' },
  ]);
  const settings = {
    name: 'Ari Draws',
    username: 'aridraws',
    bio: 'Paintings after midnight.',
    specialty: 'Watercolour',
    instagram: '@ari.draws',
    website: 'https://example.com',
    color: 'pond',
    visible: true,
  };
  await assert.rejects(() => api(null, 'profile/save', settings), /Sign in/);
  const { cover: photo } = await api(creator, 'covers/prepare');
  await db.query("insert into storage.objects(bucket_id,name) values('covers',$1)", [photo.path]);
  await api(creator, 'covers/complete', { id: photo.id });
  await assert.rejects(
    () => api(other, 'profile/save', { ...settings, avatarId: photo.id }),
    /own uploaded/,
  );
  const saved = await api(creator, 'profile/save', {
    ...settings,
    avatarId: photo.id,
    role: 'admin',
  });
  assert.equal(saved.profile.instagram, 'ari.draws');
  assert.equal((await api(creator, 'bootstrap')).user.role, 'member');
  await assert.rejects(() => api(other, 'profile/save', settings), /taken/);
  await assert.rejects(
    () => api(creator, 'profile/save', { ...settings, username: 'ADMIN' }),
    /username/,
  );
  await assert.rejects(
    () => api(creator, 'profile/save', { ...settings, website: 'javascript:alert(1)' }),
    /http/,
  );
  const guest = await api(null, 'profiles/aridraws');
  assert.equal(JSON.stringify(guest).includes('private@example.test'), false);
  assert.equal(guest.profile.id, undefined);
  assert.equal(guest.profile.role, undefined);
  assert.equal((await db.query('select tg_cover_read($1) as ok', [photo.path])).rows[0].ok, true);
  const submitted = await api(creator, 'submit', { ...product, name: 'Ari’s app' });
  const work = (await api(creator, 'my-work')).products.find((p) => p.slug === submitted.slug);
  assert.equal(
    (await api(other, 'my-work')).products.some((p) => p.id === work.id),
    false,
  );
  await assert.rejects(() => api(other, 'works/update', { ...product, id: work.id }), /not found/);
  assert.equal((await api(null, 'profiles/aridraws')).products.length, 0);
  await assert.rejects(
    () => api(owner, 'studio/product', { id: work.id, action: 'changes' }),
    /Feedback/,
  );
  await api(owner, 'studio/product', {
    id: work.id,
    action: 'changes',
    feedback: 'Please explain what the app does.',
  });
  const revised = (await api(creator, 'my-work')).products.find((p) => p.id === work.id);
  assert.equal(revised.status, 'needs_changes');
  assert.match(revised.review_note, /Please explain/);
  await api(creator, 'works/update', {
    ...product,
    id: work.id,
    name: 'Ari’s app updated',
    status: 'published',
  });
  assert.equal(
    (await api(creator, 'my-work')).products.find((p) => p.id === work.id).status,
    'pending',
  );
  await api(owner, 'studio/product', { id: work.id, action: 'verify', confirmed: true });
  const published = await api(null, 'profiles/aridraws');
  assert.equal(published.products.length, 1);
  assert.equal(published.products[0].creator_username, 'aridraws');
  assert.equal(published.products[0].review_note, undefined);
  // Edits to live work wait for review while the live version stays up.
  const edit = await api(creator, 'works/update', {
    ...product,
    id: work.id,
    name: 'Ari’s app v2',
  });
  assert.equal(edit.live, true);
  const stillLive = (await api(null, 'products/' + work.slug)).product;
  assert.equal(stillLive.name, 'Ari’s app updated');
  assert.equal(stillLive.pendingEdit, undefined);
  assert.equal(JSON.stringify(stillLive).includes('v2'), false);
  assert.equal((await api(null, 'profiles/aridraws')).products.length, 1);
  const mine = (await api(creator, 'my-work')).products.find((p) => p.id === work.id);
  assert.equal(mine.name, 'Ari’s app v2');
  assert.equal(mine.pendingEdit, true);
  assert.equal(mine.status, 'published');
  const queued = (await api(owner, 'studio')).products.find((p) => p.id === work.id);
  assert.equal(queued.status, 'pending');
  assert.equal(queued.name, 'Ari’s app v2');
  await assert.rejects(
    () => api(creator, 'studio/product', { id: work.id, action: 'verify', confirmed: true }),
    /Studio access/,
  );
  await api(owner, 'studio/product', {
    id: work.id,
    action: 'changes',
    feedback: 'Keep the old name.',
  });
  const kept = (await api(creator, 'my-work')).products.find((p) => p.id === work.id);
  assert.equal(kept.name, 'Ari’s app updated');
  assert.equal(kept.pendingEdit, undefined);
  assert.equal(kept.status, 'published');
  assert.match(kept.review_note, /old name/);
  await api(creator, 'works/update', { ...product, id: work.id, name: 'Ari’s app v3' });
  await api(owner, 'studio/product', { id: work.id, action: 'verify', confirmed: true });
  assert.equal((await api(null, 'products/' + work.slug)).product.name, 'Ari’s app v3');
  const onBehalf = await api(creator, 'submit', {
    ...product,
    name: 'Other artist',
    onBehalf: true,
    creatorName: 'Mika',
    creatorInstagram: '@mika.draws',
  });
  const otherWork = (await api(creator, 'my-work')).products.find((p) => p.slug === onBehalf.slug);
  await api(owner, 'studio/product', { id: otherWork.id, action: 'verify', confirmed: true });
  const credited = (await api(null, 'products/' + otherWork.slug)).product;
  assert.equal(credited.owner_name, 'Mika');
  assert.equal(credited.creator_username, null);
  assert.equal(
    (await api(null, 'profiles/aridraws')).products.some((p) => p.id === otherWork.id),
    false,
  );
  await api(creator, 'profile/save', { ...settings, visible: false, avatarId: photo.id });
  await assert.rejects(() => api(null, 'profiles/aridraws'), /unavailable/);
  assert.equal((await db.query('select tg_cover_read($1) as ok', [photo.path])).rows[0].ok, false);
});

test('video storage and playback inherit review privacy and reject forged attachment or avatar use', async () => {
  const uid = '77777777-7777-4777-8777-777777777777',
    cid = '88888888-8888-4888-8888-888888888888',
    vid = '99999999-9999-4999-8999-999999999999';
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [
    uid,
    'video@example.test',
    { name: 'Video Maker' },
  ]);
  const posterPath = uid + '/' + cid + '.webp',
    videoPath = uid + '/' + vid + '.mp4';
  await db.query("insert into storage.objects(bucket_id,name) values('covers',$1),('videos',$2)", [
    posterPath,
    videoPath,
  ]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec('set role authenticated');
  await assert.rejects(
    () =>
      db.query('select public.tg_video_finalize($1,$2,$3,$4,$5,$6)', [
        uid,
        cid,
        vid,
        posterPath,
        videoPath,
        {},
      ]),
    /permission denied/,
  );
  await assert.rejects(
    () =>
      db.query("insert into storage.objects(bucket_id,name) values('videos',$1)", [
        uid + '/forged.mp4',
      ]),
    /row-level security/,
  );
  await assert.rejects(
    () => db.query("select public.tg_api_before_video('bootstrap','{}')"),
    /permission denied/,
  );
  await db.exec('reset role');
  const meta = { mime: 'video/mp4', duration: 2, width: 360, height: 640, bytes: 50000 };
  const { cover } = (
    await db.query('select public.tg_video_finalize($1,$2,$3,$4,$5,$6) as data', [
      uid,
      cid,
      vid,
      posterPath,
      videoPath,
      meta,
    ])
  ).rows[0].data;
  assert.equal(cover.video.duration, 2);
  const play = async (user) => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']);
    return db.query('select public.tg_video_play($1) as data', [vid]);
  };
  await assert.rejects(() => play(null), /unavailable/);
  await assert.rejects(() => play(maker), /unavailable/);
  assert.equal((await play(uid)).rows[0].data.path, videoPath);
  await assert.rejects(
    () => api(uid, 'profile/save', { name: 'Video Maker', username: 'videomaker', avatarId: cid }),
    /still image/,
  );
  const sent = await api(uid, 'submit', {
    kind: 'art',
    name: 'Video work',
    category: 'Art & design',
    coverId: cid,
    ownership: true,
  });
  const p = (await api(owner, 'studio')).products.find((p) => p.slug === sent.slug);
  await api(owner, 'studio/product', { id: p.id, action: 'verify', confirmed: true });
  assert.equal((await play(null)).rows[0].data.id, vid);
  await api(owner, 'studio/product', {
    id: p.id,
    action: 'reject',
    feedback: 'Please revise the clip.',
  });
  await assert.rejects(() => play(null), /unavailable/);
  assert.equal((await play(owner)).rows[0].data.id, vid);
});

test('new-account setup validates blobs, keeps preferences private and respects account ownership', async () => {
  const uid = '55555555-5555-4555-8555-555555555555';
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [
    uid,
    'intro@example.test',
    { name: 'New friend' },
  ]);
  const before = (await api(uid, 'bootstrap')).user;
  assert.equal(before.onboarding.complete, false);
  const fields = {
    ...before.profile,
    name: 'New Friend',
    username: 'newfriend',
    blob: { shape: 'cloud', color: 'orange', mood: 'wink', seed: 'test-gobble' },
    preferences: { intent: 'share', interests: ['Art & painting', '3D & animation'] },
    role: 'admin',
    userId: owner,
  };
  await assert.rejects(() => api(null, 'onboarding/complete', fields), /Sign in/);
  await assert.rejects(
    () => api(uid, 'onboarding/complete', { ...fields, blob: { ...fields.blob, seed: '<svg>' } }),
    /picker/,
  );
  await assert.rejects(
    () =>
      api(uid, 'onboarding/complete', {
        ...fields,
        preferences: { intent: 'nope', interests: [] },
      }),
    /introduction/,
  );
  await assert.rejects(
    () =>
      api(uid, 'onboarding/complete', {
        ...fields,
        preferences: { intent: 'share', interests: ['Photography', 'Photography'] },
      }),
    /six interests/,
  );
  assert.equal((await api(uid, 'bootstrap')).user.profile.name, before.profile.name);
  const saved = await api(uid, 'onboarding/complete', fields);
  assert.equal(saved.onboarding.complete, true);
  assert.deepEqual(saved.profile.blob, fields.blob);
  assert.deepEqual(saved.onboarding.interests, fields.preferences.interests);
  assert.equal((await api(uid, 'bootstrap')).user.role, 'member');
  const publicProfile = (await api(null, 'profiles/newfriend')).profile;
  assert.deepEqual(publicProfile.blob, fields.blob);
  for (const key of ['email', 'onboarding', 'intent', 'interests', 'setup_completed'])
    assert.equal(publicProfile[key], undefined);
  assert.equal(
    (await api(uid, 'profile/save', { ...fields, blob: undefined, preferences: undefined })).profile
      .blob.seed,
    'test-gobble',
  );
  await api(uid, 'comment', { productId: pending.id, body: 'Love the work here.' });
  const comment = (await api(null, 'products/' + pending.slug)).comments.find(
    (c) => c.user_id === uid,
  );
  assert.deepEqual(comment.profile.blob, fields.blob);
  assert.equal(comment.profile.interests, undefined);
  await api(uid, 'profile/save', { ...fields, visible: false });
  assert.equal(
    (await api(null, 'products/' + pending.slug)).comments.find((c) => c.user_id === uid).profile,
    null,
  );
  assert.equal((await api(other, 'onboarding/skip')).onboarding.complete, true);
  await db.exec('set role authenticated');
  await assert.rejects(
    () => db.query("select public.tg_api_before_onboarding('bootstrap','{}')"),
    /permission denied/,
  );
  await db.exec('reset role');
});
test('account deletion preserves product listings and removes personal activity', async () => {
  await api(maker, 'account/delete');
  await assert.rejects(() => api(maker, 'save', { productId: pending.id }), /Sign in/);
  const p = (await api(null, 'products/' + pending.slug)).product;
  assert.equal(p.owner_name, null);
  assert.equal(p.save_count, 0);
  await assert.rejects(() => api(owner, 'account/delete'), /studio owner/);
});

test('creators can delete their own work, and edits cannot change its kind', async () => {
  const creator = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [
    creator,
    'deleter@example.test',
    { name: 'Deleter' },
  ]);
  const submitted = await api(creator, 'submit', { ...product, name: 'Short-lived' });
  const work = (await api(creator, 'my-work')).products.find((p) => p.slug === submitted.slug);
  await assert.rejects(
    () => api(creator, 'works/update', { ...product, id: work.id, kind: 'art' }),
    /kind of work/,
  );
  await api(creator, 'works/update', { ...product, id: work.id, name: 'Short-lived, tidied' });
  await api(owner, 'studio/product', { id: work.id, action: 'verify', confirmed: true });
  await api(other, 'save', { productId: work.id });
  await api(other, 'comment', { productId: work.id, body: 'Lovely work.' });
  // A pending edit's new cover belongs to the post too, so deleting frees it.
  const { cover } = await api(creator, 'covers/prepare');
  await db.query("insert into storage.objects(bucket_id,name) values('covers',$1)", [cover.path]);
  await api(creator, 'covers/complete', { id: cover.id });
  await api(creator, 'works/update', { ...product, id: work.id, coverId: cover.id });
  const fileVisible = async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [creator]);
    await db.exec('set role authenticated');
    try {
      return (await db.query('select public.tg_orphan_file($1,$2) as ok', ['covers', cover.path]))
        .rows[0].ok;
    } finally {
      await db.exec('reset role');
    }
  };
  assert.equal(await fileVisible(), false);
  await assert.rejects(() => api(other, 'works/delete', { id: work.id }), /not found/);
  await assert.rejects(() => api(null, 'works/delete', { id: work.id }), /Sign in/);
  assert.deepEqual(await api(creator, 'works/delete', { id: work.id }), {
    ok: true,
    removed: { covers: [cover.path], videos: [] },
  });
  assert.equal(await fileVisible(), true);
  assert.equal((await api(creator, 'my-work')).products.length, 0);
  await assert.rejects(() => api(null, 'products/' + work.slug), /not found/);
  const left = await db.query(
    'select (select count(*) from tg_saves where product_id=$1)+(select count(*) from tg_comments where product_id=$1) as n',
    [work.id],
  );
  assert.equal(Number(left.rows[0].n), 0);
});
