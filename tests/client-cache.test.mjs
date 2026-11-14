import test from 'node:test';
import assert from 'node:assert/strict';

// Like the browser's: stored items are the object's own keys, the methods are not.
const fake = {};
Object.defineProperties(fake, {
  getItem: { value: (k) => (Object.hasOwn(fake, k) ? fake[k] : null) },
  setItem: { value: (k, v) => (fake[k] = String(v)) },
  removeItem: { value: (k) => delete fake[k] },
});
Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
const store = { set: (k, v) => fake.setItem(k, v) };
let calls = 0;
globalThis.fetch = async (url) => {
  calls++;
  return { ok: true, json: async () => ({ route: url, n: calls }) };
};
const { api, remembered } = await import('../lib/client-api.mjs');

test('reads are remembered for the next visit and sign-out forgets them', async () => {
  assert.equal(remembered('bootstrap'), null);
  const fresh = await api('bootstrap');
  assert.deepEqual(remembered('bootstrap'), fresh);
  await api('profiles/ari');
  assert.ok(remembered('profiles/ari'));
  await api('save', { productId: 1 });
  assert.equal(remembered('save'), null, 'writes are never remembered');
  await api('auth/logout', {});
  assert.equal(remembered('bootstrap'), null);
  assert.equal(remembered('profiles/ari'), null);
});

test('old copies are ignored once image links could have expired', () => {
  store.set('tg_seen:bootstrap', JSON.stringify({ at: Date.now() - 60 * 60 * 1000, data: { user: null } }));
  assert.equal(remembered('bootstrap'), null);
});
