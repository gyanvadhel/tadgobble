import test from 'node:test';
import assert from 'node:assert/strict';
import { scenes, pinMode, sceneIndexAt } from '../lib/intro-story.mjs';

const fine = { reduceMotion: false, motion: true, coarsePointer: false };

test('scenes has the five spec titles in order', () => {
  assert.deepEqual(
    scenes.map((s) => s.title),
    [
      'A better rabbit hole.',
      'Feed Gobble. Get a find.',
      'Peek. Save. Say something nice.',
      'Made a thing? Let it loose.',
      'Pehli baar? Perfect.',
    ],
  );
  assert.deepEqual(
    scenes.map((s) => s.id),
    ['rabbit-hole', 'feed', 'stash', 'post', 'first-time'],
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
test('pinMode is static for a coarse pointer with 4 cores', () => {
  assert.equal(pinMode({ ...fine, coarsePointer: true, cores: 4 }), 'static');
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
  assert.equal(sceneIndexAt(0.999), 4);
  assert.equal(sceneIndexAt(1), 4);
  assert.equal(sceneIndexAt(2), 4);
});
test('sceneIndexAt splits evenly', () => {
  assert.equal(sceneIndexAt(0.2), 1);
  assert.equal(sceneIndexAt(0.4), 2);
  assert.equal(sceneIndexAt(0.6), 3);
  assert.equal(sceneIndexAt(0.8), 4);
});
