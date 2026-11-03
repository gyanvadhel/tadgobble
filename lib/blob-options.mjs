export const blobShapes = [
  { id: 'gobble', label: 'The original', note: 'Gobble. The one who started it.' },
  { id: 'cloud', label: 'Cloud', trait: 0.82, note: 'Head in the clouds. Tabs everywhere.' },
  { id: 'pebble', label: 'Pebble', trait: 0.35, note: 'Small blob. Very big ideas.' },
  { id: 'round', label: 'Boba', trait: 0.1, note: 'No thoughts. Just good finds.' },
  { id: 'boxy', label: 'Toast', trait: 0.54, note: 'A little crispy around the edges.' },
  { id: 'sun', label: 'Sunny', trait: 0.965, note: 'Chronically online. Suspiciously cheerful.' },
];
export const blobColors = [
  { id: 'plum', label: 'Gobble purple', hex: '#39245a', eye: '#fffef6' },
  { id: 'lavender', label: 'Lavender', hex: '#b9a3ee', eye: '#39245a' },
  { id: 'butter', label: 'Butter', hex: '#f2df65', eye: '#39245a' },
  { id: 'orange', label: 'Tangerine', hex: '#ff7949', eye: '#39245a' },
  { id: 'pond', label: 'Pond green', hex: '#85b5a3', eye: '#234638' },
];
export const blobMoods = [
  { id: 'chill', label: 'Just vibing' },
  { id: 'happy', label: 'Big win' },
  { id: 'wink', label: 'I know a spot' },
  { id: 'sleepy', label: 'One more scroll' },
  { id: 'wow', label: 'Wait, what?' },
];
export const defaultBlob = Object.freeze({
  shape: 'gobble',
  color: 'plum',
  mood: 'chill',
  seed: 'gobble',
});
export const starterIntents = [
  { id: 'explore', label: 'Find cool things', note: 'Professional rabbit-hole explorer.' },
  { id: 'share', label: 'Share what I make', note: 'The camera roll deserves an audience.' },
  { id: 'both', label: 'A little of both', note: 'Curious person. Occasional creator.' },
];
export const starterInterests = [
  'Art & painting',
  'Illustration',
  'Graphic design',
  'Photography',
  'UI & UX',
  '3D & animation',
  'Video & motion',
  'Apps & tools',
  'Code & experiments',
  'Writing',
  'Music',
  'Craft & objects',
];
export function blobChoice(value = defaultBlob) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !['shape', 'color', 'mood', 'seed'].includes(k)) ||
    !blobShapes.some((x) => x.id === value.shape) ||
    !blobColors.some((x) => x.id === value.color) ||
    !blobMoods.some((x) => x.id === value.mood) ||
    typeof value.seed !== 'string' ||
    !/^[a-zA-Z0-9-]{1,48}$/.test(value.seed)
  )
    throw new Error('Choose a blob from the picker.');
  return { shape: value.shape, color: value.color, mood: value.mood, seed: value.seed };
}
export function starterPreferences(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !starterIntents.some((x) => x.id === value.intent) ||
    !Array.isArray(value.interests) ||
    value.interests.length > 6 ||
    value.interests.some((x) => !starterInterests.includes(x)) ||
    new Set(value.interests).size !== value.interests.length
  )
    throw new Error('Choose an introduction and up to six interests from the list.');
  return { intent: value.intent, interests: value.interests };
}
export function safeReturn(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\r\n]/.test(value)
  )
    return '/discover';
  const url = new URL(value, 'https://tadgobble.web.app');
  if (
    url.origin !== 'https://tadgobble.web.app' ||
    !/^\/(discover|studio|my-work|settings|profile\/[a-zA-Z0-9_]+|product\/[a-zA-Z0-9-]+)\/?$/.test(
      url.pathname,
    )
  )
    return '/discover';
  return url.pathname + url.search;
}
export const setupDestination = (next) => '/welcome?next=' + encodeURIComponent(safeReturn(next));
