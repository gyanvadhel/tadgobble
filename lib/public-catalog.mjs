// The public catalog, read once at build time so pages carry real text for readers
// that never run JavaScript: search crawlers, link previews and AI assistants.
import { brand } from './brand.mjs';

export async function loadCatalog(call) {
  // Bootstrap brings the first page; follow the cursor so the build lists every work.
  let { products = [], nextCursor } = await call('bootstrap');
  while (nextCursor) {
    const page = await call('products/page', { cursor: nextCursor });
    products = products.concat(page.products || []);
    nextCursor = page.nextCursor;
  }
  const usernames = [...new Set(products.map((p) => p.creator_username).filter(Boolean))];
  const profiles = [];
  for (const username of usernames) {
    try {
      const { profile, products: works = [] } = await call('profiles/' + username);
      if (profile?.username) profiles.push({ ...profile, works: works.map((w) => w.slug) });
    } catch {
      // A maker who hid their profile simply isn't listed.
    }
  }
  return { products, profiles };
}

// Calls the same public route the site uses, signed in as nobody.
export function supabaseCaller(url, key) {
  return async (route, payload = {}) => {
    const response = await fetch(`${url}/rest/v1/rpc/tg_api`, {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify({ route, payload }),
    });
    const data = await response.json();
    if (!response.ok || data?.error) throw new Error(data?.error || data?.message || response.statusText);
    return data;
  };
}

const oneLine = (text) => String(text || '').replace(/\s+/g, ' ').trim();
const sentence = (text) => {
  const line = oneLine(text);
  return line && !/[.!?]$/.test(line) ? line + '.' : line;
};

export function workSummary(p) {
  return [sentence(p.tagline), p.owner_name && `By ${oneLine(p.owner_name)}.`].filter(Boolean).join(' ');
}

export function llmsText({ products, profiles }, site) {
  const lines = [
    `# ${brand.name}`,
    '',
    `> ${oneLine(brand.description)}`,
    '',
    `${brand.name} is a place where first-time makers in India post their work (art, photos, design, apps, games and videos) and people discover, save and comment on it. Each work has its own page; each maker has a public profile.`,
    '',
    '## Pages',
    '',
    `- [Discover](${site}/discover): every published work, newest first.`,
    `- [Privacy](${site}/privacy)`,
    `- [Terms](${site}/terms)`,
    '',
    '## Works',
    '',
    ...products.map(
      (p) => `- [${oneLine(p.name)}](${site}/product/${encodeURIComponent(p.slug)}): ${workSummary(p)}`,
    ),
    '',
    '## Makers',
    '',
    ...profiles.map(
      (m) =>
        `- [${oneLine(m.name || m.username)}](${site}/profile/${encodeURIComponent(m.username)})` +
        (m.specialty || m.bio ? `: ${sentence(m.specialty || m.bio)}` : ''),
    ),
    '',
  ];
  return lines.join('\n');
}

const xml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

export function sitemapXml({ products, profiles }, site, today) {
  const entry = (path, date) =>
    `  <url><loc>${xml(site + path)}</loc><lastmod>${date}</lastmod></url>`;
  const day = (value) => (value ? String(value).slice(0, 10) : today);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...['/', '/discover', '/privacy', '/terms'].map((path) => entry(path, today)),
    ...products.map((p) => entry(`/product/${p.slug}`, day(p.created_at))),
    ...profiles.map((m) => entry(`/profile/${m.username}`, today)),
    '</urlset>',
    '',
  ].join('\n');
}
