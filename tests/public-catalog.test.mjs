import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, llmsText, sitemapXml } from '../lib/public-catalog.mjs';

const work = {
  slug: 'paper-moons',
  name: 'Paper Moons',
  tagline: 'A tiny folding puzzle.',
  description: 'Fold the sky until the moons line up.',
  category: 'Games',
  url: 'https://example.com/moons',
  owner_name: 'Sam Example',
  creator_username: 'sam',
  created_at: '2026-11-01T10:00:00Z',
};
const profile = { username: 'sam', name: 'Sam Example', bio: 'Makes small games.', visible: true };

test('loadCatalog collects published works and the profile of each maker once', async () => {
  const asked = [];
  const call = async (route) => {
    asked.push(route);
    if (route === 'bootstrap') return { products: [work, { ...work, slug: 'second' }] };
    if (route === 'profiles/sam') return { profile, products: [work] };
    throw new Error('unexpected ' + route);
  };
  const catalog = await loadCatalog(call);
  assert.deepEqual(asked, ['bootstrap', 'profiles/sam']);
  assert.deepEqual(catalog.products.map((p) => p.slug), ['paper-moons', 'second']);
  assert.equal(catalog.profiles.length, 1);
  assert.equal(catalog.profiles[0].username, 'sam');
  assert.deepEqual(catalog.profiles[0].works, ['paper-moons']);
});

test('loadCatalog follows the page cursor until every published work is in', async () => {
  const asked = [];
  const call = async (route, payload) => {
    asked.push([route, payload?.cursor]);
    if (route === 'bootstrap') return { products: [work], nextCursor: 'c1' };
    if (route === 'products/page' && payload.cursor === 'c1')
      return { products: [{ ...work, slug: 'second' }], nextCursor: 'c2' };
    if (route === 'products/page' && payload.cursor === 'c2')
      return { products: [{ ...work, slug: 'third' }], nextCursor: null };
    if (route === 'profiles/sam') return { profile, products: [work] };
    throw new Error('unexpected ' + route);
  };
  const catalog = await loadCatalog(call);
  assert.deepEqual(catalog.products.map((p) => p.slug), ['paper-moons', 'second', 'third']);
  assert.deepEqual(asked.slice(0, 3), [['bootstrap', undefined], ['products/page', 'c1'], ['products/page', 'c2']]);
});

test('loadCatalog skips a maker whose profile cannot be read', async () => {
  const call = async (route) => {
    if (route === 'bootstrap') return { products: [work] };
    throw new Error('Profile is hidden');
  };
  const catalog = await loadCatalog(call);
  assert.equal(catalog.products.length, 1);
  assert.deepEqual(catalog.profiles, []);
});

test('llms.txt describes the site and lists every work and maker with links', () => {
  const text = llmsText({ products: [work], profiles: [{ ...profile, works: ['paper-moons'] }] }, 'https://tadgobble.in');
  assert.match(text, /^# tadgobble/m);
  assert.match(text, /\[Paper Moons\]\(https:\/\/tadgobble\.in\/product\/paper-moons\): A tiny folding puzzle\. By Sam Example\./);
  assert.match(text, /\[Sam Example\]\(https:\/\/tadgobble\.in\/profile\/sam\)/);
});

test('sitemap lists the fixed pages, every work and every maker', () => {
  const xml = sitemapXml({ products: [work], profiles: [profile] }, 'https://tadgobble.in', '2026-11-15');
  for (const path of ['/', '/discover', '/privacy', '/terms', '/product/paper-moons', '/profile/sam'])
    assert.ok(xml.includes(`<loc>https://tadgobble.in${path === '/' ? '/' : path}</loc>`), path);
  assert.ok(xml.includes('<lastmod>2026-11-01</lastmod>'));
});

test('sitemap escapes characters that would break the XML', () => {
  const xml = sitemapXml({ products: [{ ...work, slug: 'a&b' }], profiles: [] }, 'https://tadgobble.in', '2026-11-15');
  assert.ok(xml.includes('/product/a&amp;b'));
});
