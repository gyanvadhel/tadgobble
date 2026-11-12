import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationText, timeAgo } from '../lib/notifications.mjs';

const product = { slug: 'tiny-moon', name: 'Tiny Moon' };

test('notificationText says what happened, in the app copy', () => {
  assert.equal(notificationText({ kind: 'save', count: 1, product }), 'Someone saved Tiny Moon');
  assert.equal(notificationText({ kind: 'save', count: 3, product }), '3 people saved Tiny Moon');
  assert.equal(
    notificationText({
      kind: 'comment',
      product,
      actor: { name: 'Ravi' },
      preview: 'Lovely colours',
    }),
    'Ravi commented on Tiny Moon: "Lovely colours"',
  );
  assert.equal(
    notificationText({ kind: 'reply', product, actor: { name: 'Asha' } }),
    'Asha replied to your comment on Tiny Moon',
  );
  assert.equal(
    notificationText({ kind: 'review', product, outcome: 'approved' }),
    'Tiny Moon is live again',
  );
  assert.equal(
    notificationText({ kind: 'review', product, outcome: 'changes' }),
    'Tiny Moon needs a small change',
  );
  assert.equal(
    notificationText({ kind: 'review', product, outcome: 'rejected' }),
    'Tiny Moon was taken down',
  );
});

test('notificationText copes with a missing actor', () => {
  assert.equal(
    notificationText({ kind: 'comment', product, actor: null, preview: 'Hi' }),
    'Someone commented on Tiny Moon: "Hi"',
  );
  assert.equal(
    notificationText({ kind: 'reply', product, actor: null }),
    'Someone replied to your comment on Tiny Moon',
  );
});

test('timeAgo is short and human', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  const ago = (ms) => new Date(now - ms).toISOString();
  assert.equal(timeAgo(ago(30 * 1000), now), 'now');
  assert.equal(timeAgo(ago(5 * 60 * 1000), now), '5m');
  assert.equal(timeAgo(ago(3 * 3600 * 1000), now), '3h');
  assert.equal(timeAgo(ago(2 * 86400 * 1000), now), '2d');
  assert.equal(timeAgo(ago(10 * 86400 * 1000), now), '26 Oct');
  assert.equal(timeAgo(new Date(now + 5000).toISOString(), now), 'now');
});

test('notificationText covers follows and new work', async () => {
  const { notificationHref } = await import('../lib/notifications.mjs');
  assert.equal(
    notificationText({ kind: 'follow', actor: { name: 'Asha', username: 'asha' }, product: null }),
    'Asha started following you',
  );
  assert.equal(
    notificationText({ kind: 'new_work', actor: { name: 'Asha' }, product: { name: 'Moon Garden' } }),
    'Asha posted something new: Moon Garden',
  );
  assert.equal(notificationText({ kind: 'follow', actor: null }), 'Someone started following you');
  assert.equal(
    notificationText({ kind: 'new_work', actor: null, product: { name: 'Moon Garden' } }),
    'Someone posted something new: Moon Garden',
  );
  assert.equal(notificationHref({ kind: 'follow', actor: { username: 'a b' } }), '/profile/a%20b');
  assert.equal(notificationHref({ kind: 'follow', actor: { name: 'Hidden', username: null } }), null);
  assert.equal(notificationHref({ kind: 'new_work', product: { slug: 'moon' } }), '/product/moon');
  assert.equal(notificationHref({ kind: 'save', product }), '/product/tiny-moon');
});
