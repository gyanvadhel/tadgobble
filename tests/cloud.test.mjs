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
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
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
    'insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values($1,$2,$3,now()),($4,$5,$6,now()),($7,$8,$9,now())',
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
test('a submission is public at once; only an admin can mark it checked or take it down', async () => {
  pending = await api(maker, 'submit', product);
  assert.equal((await api(null, 'bootstrap')).products.length, 1);
  assert.equal((await api(null, 'products/' + pending.slug)).product.status, 'published');
  const { products } = await api(owner, 'studio');
  pending.id = products[0].id;
  assert.equal(products[0].status, 'published');
  assert.equal(products[0].verified_at, null);
  await assert.rejects(
    () => api(maker, 'studio/product', { id: pending.id, action: 'checked', confirmed: true }),
    /Studio access/,
  );
  await assert.rejects(
    () => api(owner, 'studio/product', { id: pending.id, action: 'checked' }),
    /Confirm/,
  );
  await assert.rejects(
    () => api(owner, 'studio/product', { id: pending.id, action: 'verify', confirmed: true }),
    /already live/,
  );
  await assert.rejects(
    () => api(owner, 'studio/product', { id: pending.id, action: 'changes', feedback: 'Fix it.' }),
    /no longer/,
  );
  await api(owner, 'studio/product', { id: pending.id, action: 'checked', confirmed: true });
  const checked = (await api(owner, 'studio')).products.find((p) => p.id === pending.id);
  assert.equal(checked.status, 'published');
  assert.ok(checked.verified_at);
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
test('covers stay private until attached to a live listing, and again once it is taken down', async () => {
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
  assert.equal(p.status, 'published');
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
  assert.ok((await api(null, 'bootstrap')).products.some((p) => p.slug === slug));
  const p = (await api(owner, 'studio')).products.find((p) => p.slug === slug);
  assert.equal(p.status, 'published');
  assert.equal(p.url, '');
  assert.equal(p.source, '');
  assert.equal(p.submission.kind, 'art');
  assert.equal(p.submission.imageDescription, 'Blue ink drawing of a tree.');
  assert.equal(p.category, 'Art & design');
  await assert.rejects(
    () => api(other, 'studio/product', { id: p.id, action: 'verify', confirmed: true }),
    /Studio access/,
  );
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

test('profiles, avatars, take-downs and edits preserve privacy and attribution', async () => {
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
  // Posting is instant: the work is public the moment it is sent.
  assert.equal(work.status, 'published');
  assert.equal((await api(null, 'profiles/aridraws')).products.length, 1);
  // An admin can take a work down; the maker sees why, and editing does not put it back.
  await api(owner, 'studio/product', {
    id: work.id,
    action: 'reject',
    feedback: 'Please explain what the app does.',
  });
  const down = (await api(creator, 'my-work')).products.find((p) => p.id === work.id);
  assert.equal(down.status, 'rejected');
  assert.match(down.review_note, /Please explain/);
  assert.equal((await api(null, 'profiles/aridraws')).products.length, 0);
  const fixed = await api(creator, 'works/update', {
    ...product,
    id: work.id,
    name: 'Ari’s app updated',
    status: 'published',
  });
  assert.equal(fixed.live, undefined);
  const stillDown = (await api(creator, 'my-work')).products.find((p) => p.id === work.id);
  assert.equal(stillDown.status, 'rejected');
  assert.equal(stillDown.name, 'Ari’s app updated');
  assert.match(stillDown.review_note, /Please explain/);
  assert.equal((await api(null, 'profiles/aridraws')).products.length, 0);
  await api(owner, 'studio/product', { id: work.id, action: 'verify', confirmed: true });
  const published = await api(null, 'profiles/aridraws');
  assert.equal(published.products.length, 1);
  assert.equal(published.products[0].creator_username, 'aridraws');
  assert.equal(published.products[0].review_note, undefined);
  // Edits to live work go live straight away.
  const edit = await api(creator, 'works/update', {
    ...product,
    id: work.id,
    name: 'Ari’s app v2',
  });
  assert.equal(edit.live, undefined);
  const nowLive = (await api(null, 'products/' + work.slug)).product;
  assert.equal(nowLive.name, 'Ari’s app v2');
  assert.equal(nowLive.pendingEdit, undefined);
  const mine = (await api(creator, 'my-work')).products.find((p) => p.id === work.id);
  assert.equal(mine.name, 'Ari’s app v2');
  assert.equal(mine.pendingEdit, undefined);
  assert.equal(mine.status, 'published');
  const seen = (await api(owner, 'studio')).products.find((p) => p.id === work.id);
  assert.equal(seen.status, 'published');
  assert.equal(seen.name, 'Ari’s app v2');
  await assert.rejects(
    () => api(creator, 'studio/product', { id: work.id, action: 'verify', confirmed: true }),
    /Studio access/,
  );
  const onBehalf = await api(creator, 'submit', {
    ...product,
    name: 'Other artist',
    onBehalf: true,
    creatorName: 'Mika',
    creatorInstagram: '@mika.draws',
  });
  const otherWork = (await api(creator, 'my-work')).products.find((p) => p.slug === onBehalf.slug);
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

test('video storage and playback follow the post and reject forged attachment or avatar use', async () => {
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
  await api(other, 'save', { productId: work.id });
  await api(other, 'comment', { productId: work.id, body: 'Lovely work.' });
  // A new cover belongs to the post too, so deleting the post frees it.
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

// ---- Notifications: the bell ----
const noteUsers = {
  owner: 'b0000001-0000-4000-8000-000000000001',
  fan: 'b0000002-0000-4000-8000-000000000002',
  fan2: 'b0000003-0000-4000-8000-000000000003',
};
let noteProduct;
async function addNoteUser(id, name) {
  await db.query(
    'insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values($1,$2,$3,now())',
    [id, name.toLowerCase() + '@notes.example.test', { name }],
  );
}
test('notification setup: a published work owned by someone else', async () => {
  await addNoteUser(noteUsers.owner, 'Noteowner');
  await addNoteUser(noteUsers.fan, 'Notefan');
  await addNoteUser(noteUsers.fan2, 'Notefan2');
  const made = await api(noteUsers.owner, 'submit', { ...product, name: 'Bell check' });
  const row = (await api(owner, 'studio')).products.find((p) => p.slug === made.slug);
  noteProduct = { id: row.id, slug: made.slug };
});
test('saves notify the owner anonymously, merge while unread, and never repeat', async () => {
  const id = noteProduct.id;
  await api(noteUsers.owner, 'notifications/read'); // the approval notice is not under test here
  await api(noteUsers.fan, 'save', { productId: id }); // first save
  await api(noteUsers.fan, 'save', { productId: id }); // unsave
  await api(noteUsers.fan, 'save', { productId: id }); // re-save: no new notification
  await api(noteUsers.fan2, 'save', { productId: id }); // second person
  await api(noteUsers.owner, 'save', { productId: id }); // own work: nothing
  const { items, unread } = await api(noteUsers.owner, 'notifications');
  const saves = items.filter((n) => n.kind === 'save');
  assert.equal(saves.length, 1);
  assert.equal(saves[0].count, 2);
  assert.equal(saves[0].actor, null);
  assert.equal(saves[0].product.slug, noteProduct.slug);
  assert.equal(unread, 1);
  await api(noteUsers.owner, 'notifications/read');
  assert.equal((await api(noteUsers.owner, 'notifications')).unread, 0);
  // once read, the same person saving again later stays quiet
  await api(noteUsers.fan, 'save', { productId: id });
  await api(noteUsers.fan, 'save', { productId: id });
  assert.equal((await api(noteUsers.owner, 'notifications')).unread, 0);
});
test('comments notify the owner; replies notify the thread starter and owner once each', async () => {
  const id = noteProduct.id;
  const thread = async () => (await api(null, 'products/' + noteProduct.slug)).comments;
  await api(noteUsers.fan, 'comment', { productId: id, body: 'Lovely colours' });
  const mine = (await api(noteUsers.owner, 'notifications')).items.filter(
    (n) => n.kind === 'comment',
  );
  assert.equal(mine.length, 1);
  assert.match(mine[0].preview, /Lovely colours/);
  assert.equal(mine[0].actor.name, 'Notefan');
  const top = (await thread())[0].id;
  await api(noteUsers.fan2, 'comment', { productId: id, parentId: top, body: 'Agreed!' });
  const replies = async (u) =>
    (await api(u, 'notifications')).items.filter((n) => n.kind === 'reply');
  assert.equal((await replies(noteUsers.fan)).length, 1);
  assert.equal((await replies(noteUsers.owner)).length, 1);
  assert.equal((await replies(noteUsers.fan2)).length, 0);
  await api(noteUsers.fan, 'comment', { productId: id, parentId: top, body: 'Thanks' }); // thread starter replying in own thread
  assert.equal((await replies(noteUsers.fan)).length, 1);
  assert.equal((await replies(noteUsers.fan2)).length, 0);
  // the top comment has replies, so deleting keeps a placeholder; its bell item must still go
  await api(noteUsers.fan, 'comment/delete', { id: top });
  assert.equal(
    (await api(noteUsers.owner, 'notifications')).items.filter((n) => n.kind === 'comment').length,
    0,
  );
});
test('a lone comment that is deleted takes its bell item with it', async () => {
  await api(noteUsers.fan2, 'comment', { productId: noteProduct.id, body: 'Short-lived thought' });
  const before = (await api(noteUsers.owner, 'notifications')).items.filter(
    (n) => n.kind === 'comment',
  );
  assert.equal(before.length, 1);
  const c = (await api(null, 'products/' + noteProduct.slug)).comments.find(
    (x) => !x.removed && x.user_id === noteUsers.fan2 && !x.parent_id,
  );
  await api(noteUsers.fan2, 'comment/delete', { id: c.id });
  assert.equal(
    (await api(noteUsers.owner, 'notifications')).items.filter((n) => n.kind === 'comment').length,
    0,
  );
});
test('notifications are private', async () => {
  await assert.rejects(() => api(null, 'notifications'), /Sign in/);
  await assert.rejects(() => api(null, 'notifications/read'), /Sign in/);
  // other people never see the owner's items
  assert.equal(
    (await api(noteUsers.fan, 'notifications')).items.filter((n) => n.kind === 'comment').length,
    0,
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [noteUsers.fan]);
  await db.exec('set role authenticated');
  try {
    await assert.rejects(
      () => db.query('select * from public.tg_notifications'),
      /permission denied/,
    );
  } finally {
    await db.exec('reset role');
  }
});

// ---- Notifications: the email outbox ----
async function publishWork(user, name) {
  const made = await api(user, 'submit', { ...product, name });
  const row = (await api(owner, 'studio')).products.find((p) => p.slug === made.slug);
  return { id: row.id, slug: made.slug };
}
const outbox = async (where, params = []) =>
  (
    await db.query(
      'select * from tg_email_outbox where ' + where + ' order by created_at, id',
      params,
    )
  ).rows;
const bell = async (user) => (await api(user, 'notifications')).items;
test('first save emails the owner exactly once across all their work', async () => {
  const first = '0b000001-0000-4000-8000-000000000001';
  await addNoteUser(first, 'Firstowner');
  const a = await publishWork(first, 'First work');
  const b = await publishWork(first, 'Second work');
  await api(noteUsers.fan, 'save', { productId: a.id });
  await api(noteUsers.fan, 'save', { productId: b.id });
  await api(noteUsers.fan2, 'save', { productId: a.id });
  await api(first, 'save', { productId: a.id }); // their own work never counts
  const rows = await outbox("kind='first_save' and recipient_id=$1", [first]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].product_id, a.id);
  assert.equal(rows[0].status, 'queued');
});
test('top-level comments queue an email, replies and own comments do not', async () => {
  const who = '0b000002-0000-4000-8000-000000000002';
  await addNoteUser(who, 'Commentowner');
  const w = await publishWork(who, 'Comment work');
  await api(noteUsers.fan, 'comment', { productId: w.id, body: 'Beautifully made' });
  const top = (await api(null, 'products/' + w.slug)).comments[0].id;
  await api(noteUsers.fan2, 'comment', { productId: w.id, parentId: top, body: 'Agreed' });
  await api(who, 'comment', { productId: w.id, body: 'Thanks all, I wrote this myself' });
  const rows = await outbox("kind='comment' and recipient_id=$1", [who]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].comment_id, top);
  assert.equal(rows[0].data.actor, 'Notefan');
  assert.match(rows[0].data.preview, /Beautifully made/);
});
test('takedowns and put-backs reach the maker, a new post tells the admin, edits stay quiet', async () => {
  const maker2 = '0b000003-0000-4000-8000-000000000003';
  await addNoteUser(maker2, 'Reviewmaker');
  const made = await api(maker2, 'submit', { ...product, name: 'Reviewed work' });
  const id = (await api(owner, 'studio')).products.find((p) => p.slug === made.slug).id;
  const queued = async () =>
    (await outbox("kind='admin_queue' and product_id=$1", [id])).map((q) => q.data.what);
  const queue = await outbox("kind='admin_queue' and product_id=$1", [id]);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].recipient_id, null);
  assert.equal(queue[0].data.what, 'new');
  assert.equal(queue[0].data.name, 'Reviewed work');
  assert.equal(queue[0].data.maker, 'Reviewmaker');
  // edits to a live work go live at once and do not email the admin
  await api(maker2, 'works/update', { ...product, id, name: 'Reviewed work v2' });
  assert.deepEqual(await queued(), ['new']);
  assert.equal((await outbox("kind='review' and product_id=$1", [id])).length, 0);
  // a takedown reaches the maker by bell and email
  await api(owner, 'studio/product', {
    id,
    action: 'reject',
    feedback: 'Please add a clearer photo',
  });
  let review = await outbox("kind='review' and product_id=$1", [id]);
  assert.equal(review.length, 1);
  assert.deepEqual(review[0].data, {
    outcome: 'rejected',
    note: 'Please add a clearer photo',
    edit: false,
  });
  // editing a taken-down work stays quiet too, and it stays down
  await api(maker2, 'works/update', { ...product, id, name: 'Reviewed work v3' });
  assert.deepEqual(await queued(), ['new']);
  assert.equal((await api(maker2, 'my-work')).products.find((p) => p.id === id).status, 'rejected');
  // putting it back tells the maker it is live
  await api(owner, 'studio/product', { id, action: 'verify', confirmed: true });
  review = await outbox("kind='review' and product_id=$1", [id]);
  assert.equal(review.length, 2);
  assert.equal(review[1].data.outcome, 'approved');
  assert.deepEqual(
    (await bell(maker2))
      .filter((n) => n.kind === 'review')
      .map((n) => n.outcome)
      .sort(),
    ['approved', 'rejected'],
  );
});
test('email preference is private and defaults on', async () => {
  assert.deepEqual(await api(noteUsers.fan, 'email-prefs'), { emailUpdates: true });
  assert.deepEqual(await api(noteUsers.fan, 'email-prefs/save', { emailUpdates: false }), {
    emailUpdates: false,
  });
  assert.deepEqual(await api(noteUsers.fan, 'email-prefs'), { emailUpdates: false });
  assert.deepEqual(await api(noteUsers.fan2, 'email-prefs'), { emailUpdates: true });
  await assert.rejects(
    () => api(noteUsers.fan, 'email-prefs/save', { emailUpdates: 'maybe' }),
    /on or off/,
  );
  await assert.rejects(() => api(null, 'email-prefs'), /Sign in/);
  await assert.rejects(() => api(null, 'email-prefs/save', { emailUpdates: true }), /Sign in/);
  await api(noteUsers.fan, 'email-prefs/save', { emailUpdates: true });
});
test('a broken email hook never fails the action, and the bell item still lands', async () => {
  const who = '0b000004-0000-4000-8000-000000000004';
  await addNoteUser(who, 'Brokenowner');
  const w = await publishWork(who, 'Broken hook work');
  await db.exec('alter table tg_email_outbox add constraint t_break check (false) not valid');
  try {
    assert.deepEqual(
      await api(noteUsers.fan, 'comment', { productId: w.id, body: 'Still goes through' }),
      { ok: true },
    );
    assert.equal((await api(noteUsers.fan, 'save', { productId: w.id })).saved, true);
  } finally {
    await db.exec('alter table tg_email_outbox drop constraint t_break');
  }
  assert.ok((await bell(who)).some((n) => n.kind === 'comment'));
  assert.equal(
    (await outbox("recipient_id=$1 and kind in ('comment','first_save')", [who])).length,
    0,
  );
});

// ---- Notifications: calls only the email sender may make ----
async function service(sql, params = []) {
  await db.exec('set role service_role');
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}
const claim = async (n = 50) => (await service('select public.tg_outbox_claim($1) as r', [n]))[0].r;
async function addUser(id, name, { confirmed = true } = {}) {
  await db.query(
    'insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values($1,$2,$3,$4)',
    [id, name.toLowerCase() + '@sender.example.test', { name }, confirmed ? new Date() : null],
  );
}
test('outbox claim skips opted-out, unconfirmed and removed-comment rows', async () => {
  await db.exec("update tg_email_outbox set status='sent' where status='queued'");
  const ok = '0c000001-0000-4000-8000-000000000001';
  const off = '0c000002-0000-4000-8000-000000000002';
  const unconfirmed = '0c000003-0000-4000-8000-000000000003';
  await addUser(ok, 'Sendok');
  await addUser(off, 'Sendoff');
  await addUser(unconfirmed, 'Sendnew', { confirmed: false });
  await api(off, 'email-prefs/save', { emailUpdates: false });
  const w = await publishWork(ok, 'Claim work');
  await api(noteUsers.fan, 'comment', { productId: w.id, body: 'Claim me please' });
  await db.exec("update tg_email_outbox set status='sent' where status='queued'"); // only hand-made rows from here
  const seed = async (recipient, kind = 'review', product = w.id, comment = null) =>
    (
      await db.query(
        'insert into tg_email_outbox(kind,recipient_id,product_id,comment_id,data) values($1,$2,$3,$4,\'{"outcome":"approved"}\') returning id',
        [kind, recipient, product, comment],
      )
    ).rows[0].id;
  const idOk = await seed(ok);
  const idOff = await seed(off);
  const idNew = await seed(unconfirmed);
  const idAdmin = await seed(null, 'admin_queue');
  const commentRow = (await db.query('select id from tg_comments where product_id=$1', [w.id]))
    .rows[0];
  const idRemoved = await seed(ok, 'comment', w.id, commentRow.id);
  await db.query('update tg_comments set removed=true,body=$2 where id=$1', [
    commentRow.id,
    '[removed]',
  ]);
  const sent = await claim();
  assert.deepEqual(sent.map((r) => r.id).sort(), [idAdmin, idOk].sort());
  const mine = sent.find((r) => r.id === idOk);
  assert.equal(mine.to, 'sendok@sender.example.test');
  assert.equal(mine.name, 'Sendok');
  assert.equal(mine.user, ok);
  assert.deepEqual(mine.product, { slug: w.slug, name: 'Claim work' });
  assert.equal(mine.data.outcome, 'approved');
  assert.equal(sent.find((r) => r.id === idAdmin).to, null);
  const status = async (id) =>
    (await db.query('select status,attempts from tg_email_outbox where id=$1', [id])).rows[0];
  for (const id of [idOff, idNew, idRemoved]) assert.equal((await status(id)).status, 'skipped');
  assert.equal((await status(idOk)).attempts, 1);
  await service('select public.tg_outbox_done($1)', [idOk]);
  assert.equal((await status(idOk)).status, 'sent');
  await service('select public.tg_outbox_done($1)', [idAdmin]);
  assert.deepEqual(await claim(), []);
});
test('outbox claim and done retry up to five times then fail', async () => {
  await db.exec("update tg_email_outbox set status='sent' where status='queued'");
  const [{ id }] = (
    await db.query(
      'insert into tg_email_outbox(kind,data) values(\'admin_queue\',\'{"what":"new","name":"Retry","maker":"M"}\') returning id',
    )
  ).rows;
  const row = async () =>
    (
      await db.query('select status,attempts,last_error,sent_at from tg_email_outbox where id=$1', [
        id,
      ])
    ).rows[0];
  for (let i = 1; i <= 5; i++) {
    const got = await claim();
    assert.deepEqual(
      got.map((r) => r.id),
      [id],
      'attempt ' + i,
    );
    await service('select public.tg_outbox_done($1,$2)', [id, 'Resend is down']);
    const r = await row();
    assert.equal(r.attempts, i);
    assert.equal(r.last_error, 'Resend is down');
    assert.equal(r.status, i < 5 ? 'queued' : 'failed');
  }
  assert.deepEqual(await claim(), []);
  assert.equal((await row()).sent_at, null);
});
test('roundup queues once per IST week on Sunday morning only', async () => {
  await db.exec("update tg_email_outbox set status='sent' where status='queued'");
  const sunday = '2026-11-08 03:30:00+00'; // Sunday 09:00 in India
  await db.exec(
    "update tg_notifications set created_at = '2026-11-06 00:00:00+00' where kind in ('save','comment','reply')",
  );
  await db.exec("delete from tg_settings where key = 'roundup_week'");
  assert.equal(
    (await service('select public.tg_roundup_queue($1) as n', ['2026-11-07 10:00:00+00']))[0].n,
    0,
  ); // Saturday
  assert.equal(
    (await service('select public.tg_roundup_queue($1) as n', ['2026-11-08 02:00:00+00']))[0].n,
    0,
  ); // Sunday 07:30 IST
  const n = (await service('select public.tg_roundup_queue($1) as n', [sunday]))[0].n;
  assert.ok(n > 0);
  const rows = await outbox("kind='roundup' and status='queued'");
  assert.equal(rows.length, n);
  const mine = rows.find((r) => r.recipient_id === noteUsers.owner);
  assert.ok(mine, 'the owner of the saved and commented work gets one');
  assert.ok(mine.data.saves >= 1);
  assert.ok(mine.data.works.some((w) => w.slug === noteProduct.slug));
  assert.equal((await service('select public.tg_roundup_queue($1) as n', [sunday]))[0].n, 0);
  assert.equal(
    (await service('select public.tg_roundup_queue($1) as n', ['2026-11-08 12:00:00+00']))[0].n,
    0,
  );
});
test('unsubscribe turns the email switch off', async () => {
  await api(noteUsers.fan, 'email-prefs/save', { emailUpdates: true });
  await service('select public.tg_unsubscribe($1)', [noteUsers.fan]);
  assert.equal((await api(noteUsers.fan, 'email-prefs')).emailUpdates, false);
});
test('the service-only calls are closed to browser roles', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role);
    try {
      for (const sql of [
        'select public.tg_outbox_claim(5)',
        "select public.tg_outbox_done('00000000-0000-4000-8000-000000000000')",
        'select public.tg_roundup_queue(now())',
        "select public.tg_unsubscribe('00000000-0000-4000-8000-000000000000')",
        'select * from public.tg_email_outbox',
      ])
        await assert.rejects(() => db.query(sql), /permission denied/, role + ': ' + sql);
    } finally {
      await db.exec('reset role');
    }
  }
});

// ---- Following makers ----
const followUsers = {
  maker: 'f0000001-0000-4000-8000-000000000001',
  fan: 'f0000002-0000-4000-8000-000000000002',
  hidden: 'f0000003-0000-4000-8000-000000000003',
};
const usernameOf = async (id) =>
  (await db.query('select username from tg_profiles where id=$1', [id])).rows[0].username;
const followRows = async () => Number((await db.query('select count(*) as n from tg_follows')).rows[0].n);
test('follow setup: a maker, a fan and a hidden profile', async () => {
  await addNoteUser(followUsers.maker, 'Followmaker');
  await addNoteUser(followUsers.fan, 'Followfan');
  await addNoteUser(followUsers.hidden, 'Followhidden');
  await db.query('update tg_profiles set visible=false where id=$1', [followUsers.hidden]);
});
test('cannot follow yourself, a hidden profile, or while signed out', async () => {
  const makerName = await usernameOf(followUsers.maker);
  await assert.rejects(() => api(null, 'follow', { username: makerName }), /Sign in/);
  await assert.rejects(
    () => api(followUsers.maker, 'follow', { username: makerName }),
    /yourself/,
  );
  const hiddenName = await usernameOf(followUsers.hidden);
  await assert.rejects(
    () => api(followUsers.fan, 'follow', { username: hiddenName }),
    /unavailable/,
  );
  await assert.rejects(
    () => api(followUsers.fan, 'follow', { username: 'nobody-by-this-name' }),
    /unavailable/,
  );
  assert.equal(await followRows(), 0);
});
test('follow toggles and reports the follower count', async () => {
  const username = await usernameOf(followUsers.maker);
  assert.deepEqual(await api(followUsers.fan, 'follow', { username }), {
    following: true,
    followers: 1,
  });
  assert.deepEqual(await api(followUsers.fan, 'follow', { username: username.toUpperCase() }), {
    following: false,
    followers: 0,
  });
});
test('profile shows followers and whether you follow', async () => {
  const username = await usernameOf(followUsers.maker);
  await api(followUsers.fan, 'follow', { username });
  const seen = await api(followUsers.fan, 'profiles/' + username);
  assert.equal(seen.followers, 1);
  assert.equal(seen.following, true);
  const anon = await api(null, 'profiles/' + username);
  assert.equal(anon.followers, 1);
  assert.equal(anon.following, false);
  assert.equal((await api(followUsers.maker, 'profiles/' + username)).following, false);
});
test('the maker hears about a follower once', async () => {
  const username = await usernameOf(followUsers.maker);
  await api(followUsers.fan, 'follow', { username }); // unfollow (followed in the test above)
  await api(followUsers.fan, 'follow', { username }); // follow again: stays quiet
  const follows = (await bell(followUsers.maker)).filter((n) => n.kind === 'follow');
  assert.equal(follows.length, 1);
  assert.equal(follows[0].actor.name, 'Followfan');
  assert.equal(follows[0].actor.username, await usernameOf(followUsers.fan));
  assert.equal(follows[0].product, null);
});
test('followers hear when the maker posts, until the work is taken down', async () => {
  const made = await api(followUsers.maker, 'submit', { ...product, name: 'Moon Garden' });
  const news = async () => (await bell(followUsers.fan)).filter((n) => n.kind === 'new_work');
  const items = await news();
  assert.equal(items.length, 1);
  assert.equal(items[0].product.slug, made.slug);
  assert.equal(items[0].actor.name, 'Followmaker');
  assert.equal((await bell(followUsers.maker)).filter((n) => n.kind === 'new_work').length, 0);
  // a work posted on someone else's behalf is not the maker's own news
  await api(followUsers.maker, 'submit', {
    ...product,
    name: 'Cousin painting',
    onBehalf: true,
    creatorName: 'A cousin',
  });
  assert.equal((await news()).length, 1);
  const id = (await api(owner, 'studio')).products.find((p) => p.slug === made.slug).id;
  await api(owner, 'studio/product', { id, action: 'reject', feedback: 'Taken down' });
  assert.equal((await news()).length, 0);
});
test('saying follow or unfollow outright is safe to repeat', async () => {
  const username = await usernameOf(followUsers.maker);
  for (const want of [true, true, false, false, true]) {
    const result = await api(followUsers.fan, 'follow', { username, follow: want });
    assert.equal(result.following, want);
  }
  assert.equal((await api(followUsers.fan, 'follow', { username, follow: false })).followers, 0);
});
test('who follows whom stays private', async () => {
  await db.exec('set role authenticated');
  try {
    await assert.rejects(() => db.query('select * from public.tg_follows'), /permission denied/);
  } finally {
    await db.exec('reset role');
  }
});
