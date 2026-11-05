import assert from 'node:assert/strict';
import test from 'node:test';
import {
  drainOutbox,
  renderEmail,
  signUnsubscribe,
  verifyUnsubscribe,
} from '../supabase/functions/_shared/notify.mjs';

const site = 'https://tadgobble.in';
const opts = { site, unsubscribeUrl: 'https://example.test/unsub?token=abc' };
const product = { slug: 'tiny-moon', name: 'Tiny Moon' };
const mail = (row, o = opts) => renderEmail({ id: 'r1', to: 'a@b.test', name: 'Asha', product, data: {}, ...row }, o);

test('renderEmail escapes user text', () => {
  const m = mail({
    kind: 'comment',
    product: { slug: 'x', name: '<i>Bad</i> & co' },
    data: { actor: '<b>x</b>', preview: '<script>alert(1)</script>' },
  });
  assert.ok(!m.html.includes('<b>x</b>'));
  assert.ok(!m.html.includes('<script>'));
  assert.ok(!m.html.includes('<i>Bad</i>'));
  assert.ok(m.html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(m.html.includes('&amp; co'));
  const n = mail({ kind: 'review', data: { outcome: 'changes', note: '<u>fix</u>' } });
  assert.ok(!n.html.includes('<u>fix</u>'));
  assert.ok(n.html.includes('&lt;u&gt;fix&lt;/u&gt;'));
});

test('subjects match the copy for every kind and outcome', () => {
  const subject = (row) => mail(row).subject;
  assert.equal(subject({ kind: 'first_save' }), 'Someone saved your work 💜');
  assert.equal(subject({ kind: 'comment', data: { actor: 'Ravi' } }), 'Ravi commented on Tiny Moon');
  assert.equal(subject({ kind: 'review', data: { outcome: 'approved' } }), 'Tiny Moon is live on tadgobble');
  assert.equal(subject({ kind: 'review', data: { outcome: 'changes' } }), 'A small change before Tiny Moon goes live');
  assert.equal(subject({ kind: 'review', data: { outcome: 'rejected' } }), 'About Tiny Moon');
  assert.equal(subject({ kind: 'review', data: { outcome: 'approved', edit: true } }), 'Your edit to Tiny Moon is live');
  assert.equal(subject({ kind: 'review', data: { outcome: 'changes', edit: true } }), 'A small change to your edit of Tiny Moon');
  assert.equal(subject({ kind: 'review', data: { outcome: 'rejected', edit: true } }), 'About your edit to Tiny Moon');
  assert.equal(subject({ kind: 'roundup', product: null, data: { saves: 2, comments: 1, replies: 0, works: [] } }), 'Your week on tadgobble');
  assert.equal(
    subject({ kind: 'admin_queue', to: null, data: { what: 'new', name: 'Moon Zine', maker: 'Asha' } }),
    'New in the review queue: Moon Zine',
  );
});

test('a subject can never carry a line break', () => {
  const m = mail({ kind: 'comment', data: { actor: 'Ravi\r\nBcc: x@y.test' } });
  assert.ok(!/[\r\n]/.test(m.subject));
});

test('maker emails link to the work and carry the unsubscribe footer', () => {
  const m = mail({ kind: 'comment', data: { actor: 'Ravi', preview: 'Lovely colours' } });
  assert.ok(m.html.includes('#fdf6e9'));
  assert.ok(m.html.includes(`${site}/product/tiny-moon`));
  assert.ok(m.html.includes('Lovely colours'));
  assert.ok(m.html.includes("You're getting this because you post on tadgobble."));
  assert.ok(m.html.includes('https://example.test/unsub?token=abc'));
  assert.ok(m.html.includes(`${site}/settings`));
  assert.ok(m.text.includes('Turn these off: https://example.test/unsub?token=abc'));
  assert.ok(m.text.includes(`Settings: ${site}/settings`));
  assert.ok(mail({ kind: 'first_save' }).text.includes('Pehli baar? Perfect.'));
});

test('review emails carry the reviewer note for changes and rejections', () => {
  const m = mail({ kind: 'review', data: { outcome: 'changes', note: 'Please add a cover' } });
  assert.ok(m.html.includes('Please add a cover'));
  assert.ok(m.text.includes('Please add a cover'));
});

test('roundup lists the totals and each work', () => {
  const m = mail({
    kind: 'roundup',
    product: null,
    data: {
      saves: 5, comments: 2, replies: 1,
      works: [{ slug: 'tiny-moon', name: 'Tiny Moon', saves: 5, comments: 2, replies: 1 }],
    },
  });
  assert.ok(m.text.includes('5 saves'));
  assert.ok(m.text.includes('2 comments'));
  assert.ok(m.html.includes(`${site}/product/tiny-moon`));
});

test('admin email has no unsubscribe footer', () => {
  const m = mail(
    { kind: 'admin_queue', to: null, data: { what: 'edit', name: 'Moon Zine', maker: 'Asha' } },
    { site, unsubscribeUrl: null },
  );
  assert.ok(m.html.includes(`${site}/studio`));
  assert.ok(!m.html.includes('Turn these off'));
  assert.ok(!m.text.includes('Turn these off'));
});

test('signed token round-trips and tampering fails', async () => {
  const id = '0c000001-0000-4000-8000-000000000001';
  const token = await signUnsubscribe(id, 'secret-one');
  assert.match(token, /^[\w-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(await verifyUnsubscribe(token, 'secret-one'), id);
  assert.equal(await verifyUnsubscribe(token, 'secret-two'), null);
  const [uid, sig] = token.split('.');
  assert.equal(await verifyUnsubscribe('0c000002-0000-4000-8000-000000000002.' + sig, 'secret-one'), null);
  assert.equal(await verifyUnsubscribe(uid + '.' + sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A'), 'secret-one'), null);
  for (const bad of ['', 'nodot', uid + '.', '.' + sig, null, undefined, 42])
    assert.equal(await verifyUnsubscribe(bad, 'secret-one'), null);
});

function drainRows() {
  return [
    { id: 'r1', kind: 'first_save', user: 'u1', to: 'one@x.test', name: 'One', product, data: {} },
    { id: 'r2', kind: 'first_save', user: 'u2', to: 'two@x.test', name: 'Two', product, data: {} },
    { id: 'r3', kind: 'first_save', user: 'u3', to: 'three@x.test', name: 'Three', product, data: {} },
  ];
}
const drainWith = (over = {}) => {
  const calls = [];
  const sent = [];
  return {
    calls,
    sent,
    run: (rows) =>
      drainOutbox({
        claim: async () => rows,
        done: async (id, error) => void calls.push([id, error]),
        send: async (msg) => void sent.push(msg),
        render: (row, o) => renderEmail(row, { site, ...o }),
        unsubscribeUrlFor: async (u) => 'https://example.test/u/' + u,
        adminEmail: 'hello@tadgobble.in',
        ...over,
      }),
  };
};

test('drainOutbox isolates a failing send and marks it', async () => {
  const d = drainWith();
  let n = 0;
  const result = await drainWith({
    send: async () => {
      if (++n === 2) throw new Error('Resend said no');
    },
    done: async (id, error) => void d.calls.push([id, error]),
  }).run(drainRows());
  assert.deepEqual(result, { sent: 2, failed: 1 });
  assert.deepEqual(d.calls, [['r1', null], ['r2', 'Resend said no'], ['r3', null]]);
});

test('a failing done call does not stop the rest of the batch', async () => {
  const seen = [];
  const result = await drainWith({
    done: async (id) => {
      seen.push(id);
      if (id === 'r1') throw new Error('db blip');
    },
  }).run(drainRows());
  assert.deepEqual(seen, ['r1', 'r2', 'r3']);
  assert.equal(result.sent + result.failed, 3);
});

test('maker mail carries List-Unsubscribe headers, admin mail does not', async () => {
  const d = drainWith();
  const rows = [
    ...drainRows().slice(0, 1),
    { id: 'a1', kind: 'admin_queue', user: null, to: null, name: null, product, data: { what: 'new', name: 'Moon Zine', maker: 'Asha' } },
  ];
  const result = await d.run(rows);
  assert.deepEqual(result, { sent: 2, failed: 0 });
  const [maker, admin] = d.sent;
  assert.equal(maker.to, 'one@x.test');
  assert.equal(maker.headers['List-Unsubscribe'], '<https://example.test/u/u1>');
  assert.equal(maker.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.ok(maker.subject && maker.html && maker.text);
  assert.equal(admin.to, 'hello@tadgobble.in');
  assert.equal(admin.headers?.['List-Unsubscribe'], undefined);
  assert.equal(admin.headers?.['List-Unsubscribe-Post'], undefined);
});
