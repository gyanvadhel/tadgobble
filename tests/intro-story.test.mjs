import test from 'node:test';
import assert from 'node:assert/strict';
import { scenes, pinMode, sceneIndexAt } from '../lib/intro-story.mjs';

const fine = { reduceMotion: false, motion: true, coarsePointer: false };

test('scenes has the four spec titles in order', () => {
  assert.deepEqual(
    scenes.map((s) => s.title),
    [
      'A better rabbit hole.',
      'Feed Gobble. Get a find.',
      'Peek. Save. Say something nice.',
      'Made a thing? Let it loose.',
    ],
  );
  assert.deepEqual(
    scenes.map((s) => s.id),
    ['rabbit-hole', 'feed', 'stash', 'post'],
  );
});

test('no scene promises traffic or sales', () => {
  for (const s of scenes) assert.doesNotMatch(`${s.title} ${s.body}`, /traffic|sales|guarantee/i);
});

test('every scene has a mood and a palette colour', () => {
  for (const s of scenes) {
    assert.ok(['calm', 'hungry', 'happy', 'surprised', 'wink'].includes(s.mood), s.id);
    assert.match(s.color, /^#[0-9a-f]{6}$/i, s.id);
  }
});

test('pinMode is static for reduced motion', () => {
  assert.equal(pinMode({ ...fine, reduceMotion: true }), 'static');
});
test('pinMode is static when motion is paused', () => {
  assert.equal(pinMode({ ...fine, motion: false }), 'static');
});
test('pinMode is static for a coarse pointer with fewer than 4 cores', () => {
  assert.equal(pinMode({ ...fine, coarsePointer: true, cores: 2 }), 'static');
});
test('pinMode is pinned for a coarse pointer reporting 4 cores (WebKit reports 4 on every iPhone)', () => {
  assert.equal(pinMode({ ...fine, coarsePointer: true, cores: 4 }), 'pinned');
});
test('pinMode is static when device memory is 2', () => {
  assert.equal(pinMode({ ...fine, memory: 2 }), 'static');
});
test('pinMode is pinned for a fine pointer with motion on', () => {
  assert.equal(pinMode(fine), 'pinned');
});
test('pinMode is pinned for a coarse pointer with 8 cores', () => {
  assert.equal(pinMode({ ...fine, coarsePointer: true, cores: 8 }), 'pinned');
});

test('sceneIndexAt clamps', () => {
  assert.equal(sceneIndexAt(-1), 0);
  assert.equal(sceneIndexAt(0), 0);
  assert.equal(sceneIndexAt(0.999), 3);
  assert.equal(sceneIndexAt(1), 3);
  assert.equal(sceneIndexAt(2), 3);
});
test('sceneIndexAt splits evenly', () => {
  assert.equal(sceneIndexAt(0.24), 0);
  assert.equal(sceneIndexAt(0.25), 1);
  assert.equal(sceneIndexAt(0.5), 2);
  assert.equal(sceneIndexAt(0.75), 3);
});

import { blobPath, expressions } from '../lib/mascot.mjs';

test('blobPath is unchanged', () => {
  assert.equal(
    blobPath,
    'M48 12C65 0 88 13 86 34C103 49 93 76 72 77C61 94 36 90 27 75C7 77-1 59 11 45C0 26 15 8 34 13C38 11 44 10 48 12Z',
  );
});
test('expressions has the five moods', () => {
  assert.deepEqual(Object.keys(expressions).sort(), [
    'calm',
    'happy',
    'hungry',
    'surprised',
    'wink',
  ]);
});
test("calm matches today's smile path", () => {
  assert.equal(expressions.calm.mouth.d, 'M37 63Q50 75 65 61');
});
test("hungry matches today's open mouth", () => {
  assert.deepEqual(expressions.hungry.mouth.ellipse, { cx: 50, cy: 65, rx: 12, ry: 10 });
});
test('every mood has exactly one kind of mouth', () => {
  for (const [name, e] of Object.entries(expressions))
    assert.equal(Boolean(e.mouth.d) !== Boolean(e.mouth.ellipse), true, name);
});
