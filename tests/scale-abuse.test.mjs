// The catalog arrives a page at a time, shared daily limits can't be drained by
// one visitor, comment emails don't flood one inbox, and deleting an account
// takes its work and files with it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openCloudDb } from './helpers/cloud-db.mjs';

let db, api, addUser;
const seeder = 'c0000001-0000-4000-8000-000000000001',
  member = 'c0000002-0000-4000-8000-000000000002',
  fan = 'c0000003-0000-4000-8000-000000000003',
  leaver = 'c0000004-0000-4000-8000-000000000004',
  admin = 'c0000005-0000-4000-8000-000000000005';

before(async () => {
  ({ db, api, addUser } = await openCloudDb());
  for (const [id, name] of [
    [seeder, 'Seeder'],
    [member, 'Member'],
    [fan, 'Fan'],
    [leaver, 'Leaver'],
    [admin, 'Admin'],
  ])
    await addUser(id, name);
  await db.query("update tg_profiles set role='admin' where id=$1", [admin]);
  // 60 published works, one a minute apart; two of them featured.
  await db.query(
    `insert into tg_products(slug,name,tagline,description,url,category,audience,pricing,source,status,owner_id,featured,created_at)
     select 'seed-'||g,'Seed '||g,'A seeded work','Seeded for paging.','https://example.com','Developer tools','Everyone','Free','test',
       'published',$1,g in (50,55),now()-make_interval(mins=>g) from generate_series(1,60) g`,
    [seeder],
  );
});
after(async () => db?.close());

const expectedOrder = async () =>
  (
    await db.query(
      "select slug from tg_products where status='published' order by featured desc, created_at desc, id desc",
    )
  ).rows.map((r) => r.slug);

test('bootstrap sends the first 48 works and a cursor; products/page sends the rest in order', async () => {
  const first = await api(null, 'bootstrap');
  assert.equal(first.products.length, 48);
  assert.ok(first.nextCursor);
  assert.equal(first.user, null);
  const second = await api(null, 'products/page', { cursor: first.nextCursor });
  assert.equal(second.products.length, 12);
  assert.equal(second.nextCursor, null);
  const slugs = [...first.products, ...second.products].map((p) => p.slug);
  assert.deepEqual(slugs, await expectedOrder());
  assert.deepEqual(slugs.slice(0, 2), ['seed-50', 'seed-55']);
});

test('a bad cursor is refused rather than restarting the list', async () => {
  await assert.rejects(() => api(null, 'products/page', { cursor: 'nonsense' }), /cursor/i);
});

test('a signed-in bootstrap brings saved works from beyond the first page, and the full user', async () => {
  await api(member, 'save', { productId: (await db.query("select id from tg_products where slug='seed-60'")).rows[0].id });
  const data = await api(member, 'bootstrap');
  assert.equal(data.products.length, 48);
  assert.ok(!data.products.some((p) => p.slug === 'seed-60'));
  const saved = data.saved.find((p) => p.slug === 'seed-60');
  assert.ok(saved);
  assert.equal(saved.saved, true);
  assert.equal(data.user.id, member);
  assert.equal(data.user.email, 'member@example.test');
  assert.ok(data.user.profile.username);
  assert.ok(data.user.onboarding);
});

test('the shared daily limits for covers and inquiries are far above what one visitor can reach', async () => {
  await db.exec(`insert into tg_rate_limits(key,count,reset_at) values
    ('covers:global',1000,now()+interval '1 day'),('inquiry:global',100,now()+interval '1 day')`);
  assert.ok((await api(member, 'covers/prepare')).cover.id);
  assert.deepEqual(
    await api(null, 'sponsor', {
      name: 'Visitor',
      email: 'visitor@example.test',
      url: 'https://example.com',
      message: 'Hello, I would like to sponsor.',
    }),
    { ok: true },
  );
});

test('each visitor has a daily limit on covers and on inquiries', async () => {
  await db.exec("delete from tg_rate_limits where key like '%:global'");
  await db.query(
    `insert into tg_rate_limits(key,count,reset_at) values($1,60,now()+interval '1 day'),($2,5,now()+interval '1 day')
     on conflict(key) do update set count=excluded.count,reset_at=excluded.reset_at`,
    ['covers-day:' + fan, 'inquiry-day:' + (await db.query("select md5('anonymous') as m")).rows[0].m],
  );
  await assert.rejects(() => api(fan, 'covers/prepare'), /Too many/);
  await assert.rejects(
    () =>
      api(null, 'sponsor', {
        name: 'Visitor',
        email: 'visitor@example.test',
        url: 'https://example.com',
        message: 'Hello again, still keen.',
      }),
    /Too many/,
  );
});

test('one person gets at most 5 comment emails a day; the bell still shows every comment', async () => {
  const id = (await db.query("select id from tg_products where slug='seed-1'")).rows[0].id;
  for (let i = 1; i <= 7; i++) await api(fan, 'comment', { productId: id, body: 'Comment number ' + i });
  const emails = await db.query(
    "select count(*)::int as n from tg_email_outbox where kind='comment' and recipient_id=$1",
    [seeder],
  );
  assert.equal(emails.rows[0].n, 5);
  const bell = (await api(seeder, 'notifications')).items.filter((n) => n.kind === 'comment');
  assert.equal(bell.length, 7);
});

test('deleting an account deletes its works and covers and hands back the file paths', async () => {
  const work = {
    name: 'Leaving soon',
    tagline: 'Gone tomorrow',
    description: 'Will be deleted with the account.',
    url: 'https://example.com',
    category: 'Developer tools',
    audience: 'Everyone',
    pricing: 'Free',
    ownership: true,
    platforms: ['Web app'],
  };
  const { cover } = await api(leaver, 'covers/prepare');
  await db.query("insert into storage.objects(bucket_id,name) values('covers',$1)", [cover.path]);
  await api(leaver, 'covers/complete', { id: cover.id });
  const { slug } = await api(leaver, 'submit', { ...work, coverId: cover.id });
  const { cover: spare } = await api(leaver, 'covers/prepare'); // uploaded but never used
  await api(fan, 'save', { productId: (await db.query('select id from tg_products where slug=$1', [slug])).rows[0].id });

  const result = await api(leaver, 'account/delete');
  assert.equal(result.ok, true);
  assert.deepEqual(result.removed.covers.sort(), [cover.path, spare.path].sort());
  assert.deepEqual(result.removed.videos, []);
  await assert.rejects(() => api(null, 'products/' + slug), /not found/);
  const left = await db.query(
    'select (select count(*) from tg_products where owner_id=$1)+(select count(*) from tg_covers where owner_id=$1 or id=any($2::uuid[]))+(select count(*) from tg_products where slug=$3) as n',
    [leaver, [cover.id, spare.id], slug],
  );
  assert.equal(Number(left.rows[0].n), 0);
  await assert.rejects(() => api(leaver, 'save', { productId: 'x' }), /Sign in/);
  await assert.rejects(() => api(admin, 'account/delete'), /studio owner/);
});
