export const cloudMode = process.env.NEXT_PUBLIC_DEPLOYMENT_TARGET === 'firebase';

// Pages remember the last answer to each read so a visit opens at once with the
// account and posts from last time, then refreshes. Kept well under the hour that
// image links stay valid, and wiped on sign-out so nobody sees someone else's.
const CACHE = 'tg_seen:',
  MAX_AGE = 45 * 60 * 1000,
  remembers = (path) => /^(bootstrap|my-work|profiles\/[^/]+|products\/[^/]+)$/.test(path);
export function remembered(path) {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE + path));
    if (saved && Date.now() - saved.at < MAX_AGE) return saved.data;
  } catch {}
  return null;
}
function remember(path, data) {
  try {
    localStorage.setItem(CACHE + path, JSON.stringify({ at: Date.now(), data }));
  } catch {}
}
export function forgetAll() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(CACHE)) localStorage.removeItem(key);
  } catch {}
}

export async function api(path, body, options = {}) {
  if (/^(auth\/(login|logout|register|complete)|account\/delete)$/.test(path)) forgetAll();
  const data = await request(path, body, options);
  if (body === undefined && remembers(path)) remember(path, data);
  return data;
}

async function request(path, body, options) {
  if (path === 'videos/upload' && body instanceof FormData) {
    const { prepareVideo } = await import('./prepare-video.mjs');
    body = await prepareVideo(body.get('file'), options.signal, options.onProgress);
  }
  if (cloudMode) {
    const { cloudApi } = await import('./cloud-api.mjs');
    return cloudApi(path, body, options);
  }
  if (path === 'covers/upload' && body instanceof FormData) {
    const { prepareImage } = await import('./prepare-image.mjs');
    const resized = await prepareImage(body.get('file'), options.signal);
    body = new FormData();
    body.set('file', resized, 'image.webp');
  }
  const { onProgress, ...requestOptions } = options;
  const response = await fetch('/api/' + path, {
    ...requestOptions,
    ...(body === undefined
      ? { cache: 'no-store' }
      : body instanceof FormData
        ? { method: 'POST', body }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
