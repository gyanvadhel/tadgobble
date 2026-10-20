import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { starterProducts } from '../lib/catalog.mjs';

// Explicit maintenance action: archive only untouched editorial starter listings.
process.env.SEED_CATALOG = 'false';
const { get, run, transaction, audit } = await import('../lib/db.mjs');
const archived = [];
transaction(() => {
  for (const { id } of starterProducts) {
    const product = get(
      "SELECT id,name FROM products WHERE id=? AND editorial=1 AND owner_id IS NULL AND status='published'",
      id,
    );
    if (!product) continue;
    run("UPDATE products SET status='archived' WHERE id=?", id);
    archived.push(product.name);
  }
  run('INSERT OR REPLACE INTO settings VALUES (?,?)', 'catalog_seeded', 'true');
  if (archived.length) audit(null, 'starter_catalog_archived', JSON.stringify(archived));
});
const envPath = new URL('../.env.local', import.meta.url);
if (existsSync(envPath)) {
  const previous = readFileSync(envPath, 'utf8');
  const next = /^SEED_CATALOG=.*$/m.test(previous)
    ? previous.replace(/^SEED_CATALOG=.*$/m, 'SEED_CATALOG=false')
    : previous + '\nSEED_CATALOG=false\n';
  writeFileSync(envPath, next);
}
console.log(
  JSON.stringify({
    archived,
    publicProducts: get("SELECT count(*) AS n FROM products WHERE status='published'").n,
    pendingProducts: get("SELECT count(*) AS n FROM products WHERE status='pending'").n,
  }),
);
