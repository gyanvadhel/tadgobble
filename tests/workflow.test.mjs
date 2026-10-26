import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
mkdirSync('test-results', { recursive: true });
process.env.DATA_DIR = mkdtempSync(path.resolve('test-results/unit-'));
process.env.SEED_CATALOG = 'false';
process.env.INSTAGRAM_PUBLISH_ENABLED = 'false';
process.env.DAILY_POST_LIMIT = '1';
process.env.APP_URL = 'http://127.0.0.1:3000';
const { db, get, run, now, mediaDir } = await import('../lib/db.mjs');
const {
  createDraft,
  approveJob,
  scheduleJob,
  unscheduleJob,
  updateDraft,
  requestRender,
  resolvePublication,
  connectionStatus,
} = await import('../lib/workflow.mjs');
const { tick } = await import('../lib/worker.mjs');
const { renderReel, command } = await import('../lib/render.mjs');
const { hashPassword, verifyPassword, createSession } = await import('../lib/auth.mjs');
const { handle } = await import('../lib/api.mjs');
beforeEach(() => {
  process.env.DAILY_POST_LIMIT = '1';
  db.exec(
    'DELETE FROM audit; DELETE FROM events; DELETE FROM jobs; DELETE FROM comments; DELETE FROM saves; DELETE FROM products; DELETE FROM sessions; DELETE FROM users; DELETE FROM settings; DELETE FROM rate_limits;',
  );
});
function product(id = 'demo', verified = true) {
  run(
    "INSERT INTO products (id,slug,name,tagline,description,url,category,audience,pricing,color,icon,source,facts,status,created_at,verified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'published',?,?)",
    id,
    id,
    'Test product',
    'A useful test product.',
    'A test fixture for the workflow.',
    'https://example.com',
    'Design',
    'Creators',
    'Test pricing',
    'mint',
    'spark',
    'https://example.com',
    JSON.stringify(['A recorded capability']),
    now(),
    verified ? now() : null,
  );
  return get('SELECT * FROM products WHERE id=?', id);
}
function ready(id = 'demo', verified = true) {
  product(id, verified);
  const j = createDraft(id);
  run(
    "UPDATE jobs SET status='rendered',source_file='00000000-0000-0000-0000-000000000000.mp4',output_file=?,rights_confirmed=1 WHERE id=?",
    `${j.id}-reel.mp4`,
    j.id,
  );
  return j;
}
function due(id = 'demo') {
  const j = ready(id);
  approveJob(j.id);
  scheduleJob(j.id, new Date(Date.now() + 60000).toISOString());
  run('UPDATE jobs SET scheduled_at=? WHERE id=?', new Date(Date.now() - 1000).toISOString(), j.id);
  return j;
}
test('approval requires reviewed product facts and a real rendered clip', () => {
  const j = ready('unverified', false);
  assert.throws(() => approveJob(j.id), /Verify the product facts/);
  run('UPDATE products SET verified_at=? WHERE id=?', now(), 'unverified');
  approveJob(j.id);
  assert.equal(get('SELECT status FROM jobs WHERE id=?', j.id).status, 'approved');
});
test('only approved content is scheduled and the daily cap is transactional', () => {
  const a = ready('a');
  const b = ready('b');
  const when = new Date(Date.now() + 3600000).toISOString();
  assert.throws(() => scheduleJob(a.id, when), /Only approved/);
  approveJob(a.id);
  approveJob(b.id);
  scheduleJob(a.id, when);
  assert.throws(() => scheduleJob(b.id, when), /already reserved/);
  unscheduleJob(a.id);
  scheduleJob(b.id, when);
  assert.equal(get('SELECT status FROM jobs WHERE id=?', b.id).status, 'queued');
});
test('a disabled cap allows multiple approved posts to be scheduled and published on one day', async () => {
  delete process.env.DAILY_POST_LIMIT;
  assert.equal(connectionStatus().dailyLimit, null);
  process.env.DAILY_POST_LIMIT = '0';
  assert.equal(connectionStatus().dailyLimit, null);
  const unapproved = ready('unapproved');
  assert.throws(
    () => scheduleJob(unapproved.id, new Date(Date.now() + 60000).toISOString()),
    /Only approved/,
  );
  const jobs = Array.from({ length: 6 }, (_, i) => due(`uncapped-${i}`));
  let publications = 0;
  const client = {
    create: async (job) => job.id,
    status: async () => 'FINISHED',
    publish: async () => String(++publications),
    permalink: async () => '',
  };
  for (const job of jobs) {
    assert.equal((await tick({ forceConnection: true, client })).action, 'published');
    assert.equal(get('SELECT status FROM jobs WHERE id=?', job.id).status, 'published');
  }
  assert.equal(publications, 6);
  assert.equal((await tick({ forceConnection: true, client })).action, 'idle');
});
test('editing clears approval, and a scheduled post cannot be changed underneath the worker', () => {
  const j = ready();
  approveJob(j.id);
  updateDraft(j.id, { script: 'Edited script', caption: 'Edited caption' });
  assert.equal(get('SELECT status FROM jobs WHERE id=?', j.id).status, 'rendered');
  assert.equal(get('SELECT approved_at FROM jobs WHERE id=?', j.id).approved_at, null);
  approveJob(j.id);
  scheduleJob(j.id, new Date(Date.now() + 3600000).toISOString());
  assert.throws(
    () => updateDraft(j.id, { script: 'Another edit', caption: 'Another caption' }),
    /Unschedule/,
  );
});
test('a disconnected worker never attempts live publication', async () => {
  const j = due();
  let calls = 0;
  const result = await tick({
    client: {
      create() {
        calls++;
      },
    },
  });
  assert.equal(result.action, 'idle');
  assert.equal(calls, 0);
  assert.equal(get('SELECT status FROM jobs WHERE id=?', j.id).status, 'queued');
});
test('concurrent workers publish a due job only once', async () => {
  const j = due();
  let publishes = 0;
  const client = {
    create: async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 'container';
    },
    status: async () => 'FINISHED',
    publish: async () => {
      publishes++;
      return '123';
    },
    permalink: async () => 'https://www.instagram.com/reel/example/',
  };
  await Promise.all([
    tick({ forceConnection: true, client }),
    tick({ forceConnection: true, client }),
  ]);
  assert.equal(publishes, 1);
  assert.equal(get('SELECT status FROM jobs WHERE id=?', j.id).status, 'published');
});
test('an uncertain publish is quarantined and never retried automatically', async () => {
  const j = due();
  let publishes = 0;
  const client = {
    create: async () => 'container',
    status: async () => 'FINISHED',
    publish: async () => {
      publishes++;
      throw new Error('Connection lost after sending.');
    },
  };
  await tick({ forceConnection: true, client });
  assert.equal(get('SELECT status FROM jobs WHERE id=?', j.id).status, 'needs_attention');
  await tick({ forceConnection: true, client });
  assert.equal(publishes, 1);
});
test('permalink failure does not undo a confirmed publication', async () => {
  const j = due();
  await tick({
    forceConnection: true,
    client: {
      create: async () => 'container',
      status: async () => 'FINISHED',
      publish: async () => '123',
      permalink: async () => {
        throw new Error('Read failed');
      },
    },
  });
  assert.equal(get('SELECT status FROM jobs WHERE id=?', j.id).status, 'published');
  assert.equal(get('SELECT media_id FROM jobs WHERE id=?', j.id).media_id, '123');
});
test('in-progress containers are retained for the next worker poll', async () => {
  const j = due();
  await tick({
    forceConnection: true,
    client: { create: async () => 'same-container', status: async () => 'IN_PROGRESS' },
  });
  const row = get('SELECT * FROM jobs WHERE id=?', j.id);
  assert.equal(row.status, 'queued');
  assert.equal(row.container_id, 'same-container');
});
test('render errors become actionable failures without approving the job', async () => {
  const j = ready();
  requestRender(j.id);
  await tick({
    render: async () => {
      throw new Error('Unreadable demo clip');
    },
  });
  const row = get('SELECT * FROM jobs WHERE id=?', j.id);
  assert.equal(row.status, 'failed');
  assert.equal(row.approved_at, null);
  assert.match(row.last_error, /Unreadable/);
});
test('reconciliation requires explicit evidence and clears an unused container', () => {
  const j = due();
  run("UPDATE jobs SET status='needs_attention',container_id='old' WHERE id=?", j.id);
  assert.throws(
    () =>
      resolvePublication(j.id, {
        outcome: 'not_published',
        evidence: 'Checked the account directly.',
      }),
    /Check the Instagram/,
  );
  resolvePublication(j.id, {
    outcome: 'not_published',
    confirmed: true,
    evidence: 'Checked the account directly; the Reel is absent.',
  });
  const row = get('SELECT * FROM jobs WHERE id=?', j.id);
  assert.equal(row.status, 'approved');
  assert.equal(row.container_id, null);
  assert.equal(row.scheduled_at, null);
});
test('editing a previously prepared container forces a fresh container', () => {
  const j = ready();
  run("UPDATE jobs SET container_id='old' WHERE id=?", j.id);
  updateDraft(j.id, { script: 'A corrected factual script.', caption: 'A corrected caption.' });
  assert.equal(get('SELECT container_id FROM jobs WHERE id=?', j.id).container_id, null);
});
test('passwords are salted and studio requires an admin session', async () => {
  const hashed = hashPassword('a long secure password');
  assert.equal(verifyPassword('a long secure password', hashed), true);
  assert.equal(verifyPassword('wrong password', hashed), false);
  assert.notEqual(hashPassword('a long secure password'), hashed);
  const response = await handle(new Request('http://127.0.0.1:3000/api/studio'), ['studio']);
  assert.equal(response.status, 401);
});
test('cross-origin requests are rejected before mutation', async () => {
  const response = await handle(
    new Request('http://127.0.0.1:3000/api/events', {
      method: 'POST',
      headers: { origin: 'https://unrelated.example', 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'visit' }),
    }),
    ['events'],
  );
  assert.equal(response.status, 403);
  assert.equal(get('SELECT count(*) as n FROM events').n, 0);
});

async function makerSubmit(body) {
  if (!get("SELECT id FROM users WHERE id='maker-test'"))
    run(
      'INSERT INTO users VALUES (?,?,?,?,?,?)',
      'maker-test',
      'maker@test.example',
      'A maker',
      hashPassword('a sufficiently long password'),
      'member',
      now(),
    );
  const token = createSession('maker-test');
  return handle(
    new Request('http://127.0.0.1:3000/api/submit', {
      method: 'POST',
      headers: {
        origin: 'http://127.0.0.1:3000',
        'content-type': 'application/json',
        cookie: `ap_session=${token}`,
      },
      body: JSON.stringify(body),
    }),
    ['submit'],
  );
}

test('minimal submission stays pending and uses its website as the review source', async () => {
  const response = await makerSubmit({
    name: 'Tiny Research',
    url: 'https://example.com/research',
    tagline: 'Keep research notes together.',
    category: 'Research',
    audience: 'Students',
    ownership: true,
    platforms: ['Web app', 'API'],
    color: 'blue',
  });
  assert.equal(response.status, 200);
  const product = get("SELECT * FROM products WHERE name='Tiny Research'");
  assert.equal(product.status, 'pending');
  assert.equal(product.category, 'Research');
  assert.equal(product.audience, 'Students');
  assert.equal(product.source, 'https://example.com/research');
  assert.equal(product.description, product.tagline);
  assert.equal(product.pricing, 'See current pricing');
  assert.deepEqual(JSON.parse(product.facts), []);
  assert.deepEqual(JSON.parse(product.submission_details).platforms, ['Web app', 'API']);
  assert.equal(product.color, 'blue');
  assert.equal(get("SELECT count(*) AS n FROM products WHERE status='published'").n, 0);
});

test('submission validates expanded choices, explicit ownership, and optional demo URLs', async () => {
  const valid = {
    name: 'A tool',
    url: 'https://example.com',
    tagline: 'A useful little thing.',
    category: 'AI assistants',
    audience: 'Everyone',
    ownership: true,
  };
  for (const changes of [
    { category: 'Invented category' },
    { audience: 'Invented audience' },
    { platforms: ['Mars'] },
    { pricingModel: 'Invented pricing' },
    { ownership: 'false' },
  ]) {
    const response = await makerSubmit({ ...valid, ...changes });
    assert.equal(response.status, 400);
  }
  run('DELETE FROM rate_limits');
  const badUrl = await makerSubmit({ ...valid, demoUrl: 'javascript:alert(1)' });
  assert.equal(badUrl.status, 400);
  assert.equal(get('SELECT count(*) AS n FROM products').n, 0);
});
test('the renderer produces an actual H.264 MP4 from an uploaded demo', async () => {
  const p = product();
  const j = createDraft(p.id);
  const filename = '00000000-0000-0000-0000-000000000000.mp4';
  await command([
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=640x360:rate=15',
    '-t',
    '3',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    path.join(mediaDir, filename),
  ]);
  const file = await renderReel({ ...j, source_file: filename }, p);
  assert.ok(statSync(path.join(mediaDir, file)).size > 10000);
});
