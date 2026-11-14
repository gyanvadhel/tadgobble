// Plain text versions of pages, written into the HTML at build time. Readers that
// don't run JavaScript (crawlers, link previews, AI assistants) see these; in a
// browser the layout's script hides them before the app paints.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brand } from '../lib/brand.mjs';
import { workSummary } from '../lib/public-catalog.mjs';

export function readCatalog() {
  for (const path of ['hosting/catalog.json', 'catalog.json']) {
    try {
      return JSON.parse(readFileSync(join(process.cwd(), path), 'utf8'));
    } catch {}
  }
  return { products: [], profiles: [] };
}

// Static export needs at least one page per dynamic route, even before anything is published.
export const placeholder = '_';

const paragraphs = (text) =>
  String(text || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, i) => <p key={i}>{part}</p>);

function SiteLinks() {
  return (
    <nav aria-label="Site">
      <a href="/">{brand.name}</a> | <a href="/discover">Discover</a> |{' '}
      <a href="/llms.txt">Site summary</a>
    </nav>
  );
}

function WorkList({ products }) {
  if (!products.length) return <p>Nothing is published yet.</p>;
  return (
    <ul>
      {products.map((p) => (
        <li key={p.slug}>
          <a href={`/product/${encodeURIComponent(p.slug)}`}>{p.name}</a>: {workSummary(p)}
        </li>
      ))}
    </ul>
  );
}

export function StaticCatalog({ heading }) {
  const { products } = readCatalog();
  return (
    <section className="crawl-copy">
      <SiteLinks />
      <h1>{heading || brand.searchTitle}</h1>
      <p>{brand.description}</p>
      <h2>Latest work</h2>
      <WorkList products={products} />
    </section>
  );
}

export function StaticWork({ product: p }) {
  return (
    <article className="crawl-copy">
      <SiteLinks />
      <h1>{p.name}</h1>
      {p.tagline && <p>{p.tagline}</p>}
      {p.owner_name && (
        <p>
          By{' '}
          {p.creator_username ? (
            <a href={`/profile/${encodeURIComponent(p.creator_username)}`}>{p.owner_name}</a>
          ) : (
            p.owner_name
          )}
          {p.category && <>, in {p.category}</>}
        </p>
      )}
      {paragraphs(p.description)}
      {p.url && (
        <p>
          <a href={p.url} rel="nofollow ugc">
            Open {p.name}
          </a>
        </p>
      )}
    </article>
  );
}

export function StaticProfile({ profile: m }) {
  const { products } = readCatalog();
  const works = products.filter((p) => m.works?.includes(p.slug));
  return (
    <article className="crawl-copy">
      <SiteLinks />
      <h1>{m.name || m.username}</h1>
      <p>@{m.username} on {brand.name}</p>
      {m.specialty && <p>{m.specialty}</p>}
      {paragraphs(m.bio)}
      {m.website && (
        <p>
          <a href={m.website} rel="nofollow ugc">
            Website
          </a>
        </p>
      )}
      <h2>Work</h2>
      <WorkList products={works} />
    </article>
  );
}
