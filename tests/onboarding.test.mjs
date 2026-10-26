import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { blobChoice, defaultBlob, safeReturn, setupDestination } from '../lib/blob-options.mjs';
mkdirSync('test-results', { recursive: true });
process.env.DATA_DIR = mkdtempSync(path.resolve('test-results/onboarding-unit-'));
process.env.APP_URL = 'http://127.0.0.1:3000';
process.env.SEED_CATALOG = 'false';
const { handle } = await import('../lib/api.mjs');
const { run, now } = await import('../lib/db.mjs');
const { createSession } = await import('../lib/auth.mjs');
for (const uid of ['fresh', 'other'])
  run(
    'INSERT INTO users VALUES (?,?,?,?,?,?)',
    uid,
    uid + '@example.test',
    uid,
    'unused',
    'member',
    now(),
  );
async function api(uid, route, body) {
  const res = await handle(
    new Request(process.env.APP_URL + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: {
        origin: process.env.APP_URL,
        'content-type': 'application/json',
        ...(uid ? { cookie: 'ap_session=' + createSession(uid) } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    route.split('/'),
  );
  return { status: res.status, ...(await res.json()) };
}
test('setup validates choices, preserves ownership, and exposes only the chosen avatar publicly', async () => {
  const user = (await api('fresh', 'bootstrap')).user;
  assert.equal(user.onboarding.complete, false);
  const body = {
    ...user.profile,
    name: 'Fresh creator',
    username: 'freshcreator',
    blob: { shape: 'cloud', color: 'plum', mood: 'wink', seed: 'unique-123' },
    preferences: { intent: 'both', interests: ['Photography', 'Apps & tools'] },
    role: 'admin',
    userId: 'other',
  };
  assert.equal((await api(null, 'onboarding/complete', body)).status, 401);
  assert.equal(
    (
      await api('fresh', 'onboarding/complete', {
        ...body,
        blob: { ...body.blob, seed: '<script>' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api('fresh', 'onboarding/complete', {
        ...body,
        preferences: { intent: 'both', interests: ['secret-injected'] },
      })
    ).status,
    400,
  );
  assert.equal((await api('fresh', 'bootstrap')).user.profile.name, 'fresh');
  const result = await api('fresh', 'onboarding/complete', body);
  assert.equal(result.status, 200);
  assert.equal(result.onboarding.complete, true);
  assert.deepEqual(result.onboarding.interests, body.preferences.interests);
  assert.deepEqual(result.profile.blob, body.blob);
  assert.equal((await api('fresh', 'bootstrap')).user.role, 'member');
  assert.equal((await api('other', 'bootstrap')).user.onboarding.complete, false);
  const publicProfile = (await api(null, 'profiles/freshcreator')).profile;
  assert.deepEqual(publicProfile.blob, body.blob);
  for (const key of ['email', 'onboarding', 'intent', 'interests', 'setup_completed'])
    assert.equal(publicProfile[key], undefined);
  assert.equal((await api('other', 'onboarding/skip', {})).onboarding.complete, true);
  assert.equal(
    (await api('fresh', 'profile/save', { ...body, blob: undefined, preferences: undefined }))
      .profile.blob.seed,
    'unique-123',
  );
});
test('blob inputs and setup return URLs cannot introduce markup or off-site redirects', () => {
  assert.deepEqual(blobChoice(defaultBlob), defaultBlob);
  assert.throws(() => blobChoice({ ...defaultBlob, palette: '<svg/>' }));
  for (const url of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/welcome?next=/welcome',
    '/auth/callback',
    '/unknown',
    '/discover\n',
  ])
    assert.equal(safeReturn(url), '/discover');
  assert.equal(safeReturn('/discover?submit=1'), '/discover?submit=1');
  assert.equal(setupDestination('/my-work'), '/welcome?next=%2Fmy-work');
});
