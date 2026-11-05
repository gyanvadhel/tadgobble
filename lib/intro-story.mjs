import { sitePalette } from './design-tokens.mjs';

// The five scenes of the home-page intro story. Copy is checked against the real product:
// posting needs a photo or video, apps add a website link, and every post is reviewed.
export const scenes = [
  {
    id: 'rabbit-hole',
    title: 'A better rabbit hole.',
    body: 'tadgobble is a home for art, design and useful apps, and the people who make them.',
    mood: 'surprised',
    color: sitePalette.purple,
  },
  {
    id: 'feed',
    title: 'Feed Gobble. Get a find.',
    body: 'One tap, one surprise: real work by real first-timers.',
    mood: 'hungry',
    color: sitePalette.acid,
  },
  {
    id: 'stash',
    title: 'Peek. Save. Say something nice.',
    body: 'Open a preview, keep it in your stash, leave a kind comment.',
    mood: 'happy',
    color: sitePalette.pond,
  },
  {
    id: 'post',
    title: 'Made a thing? Let it loose.',
    body: 'Post with a photo or video and a title, or add your app’s website. No portfolio. We review every post before it goes public.',
    mood: 'calm',
    color: sitePalette.accent,
  },
  {
    id: 'first-time',
    title: 'Pehli baar? Perfect.',
    body: 'Fresh picks are right below.',
    mood: 'wink',
    color: sitePalette.cream,
  },
];

// Pin the story only when motion is wanted and the device can likely keep up.
export function pinMode({ reduceMotion, motion, coarsePointer, cores, memory }) {
  if (reduceMotion || !motion) return 'static';
  if (coarsePointer && cores !== undefined && cores < 4) return 'static';
  if (memory !== undefined && memory <= 2) return 'static';
  return 'pinned';
}

export function sceneIndexAt(progress, count = scenes.length) {
  const p = Math.min(Math.max(progress, 0), 1);
  return Math.min(Math.floor(p * count), count - 1);
}
