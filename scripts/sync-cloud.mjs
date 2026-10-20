import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cloudSession } from './cloud-session.mjs';
import { all, run, dataDir, transaction } from '../lib/db.mjs';
const { client, rpc } = await cloudSession();
const { products } = await rpc('studio');
const coverDir = path.join(dataDir, 'covers');
mkdirSync(coverDir, { recursive: true });
for (const p of products) {
  let coverId = null;
  if (p.cover?.status === 'ready') {
    const { data, error } = await client.storage.from('covers').download(p.cover.path);
    if (error) throw new Error('Could not sync a product cover.');
    const filename = `${p.cover.id}.webp`;
    writeFileSync(path.join(coverDir, filename), Buffer.from(await data.arrayBuffer()));
    run('INSERT OR IGNORE INTO product_covers(id,owner_id,filename,kind,source_url,created_at) VALUES (?,NULL,?,?,?,?)', p.cover.id, filename, p.cover.kind, p.url, p.cover.created_at);
    coverId = p.cover.id;
  }
  transaction(() => {
    run(`INSERT INTO products(id,slug,name,tagline,description,url,category,audience,pricing,color,icon,source,facts,status,featured,sponsored,editorial,created_at,verified_at,submission_details,cover_id)
      VALUES (${Array(21).fill('?').join(',')}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,tagline=excluded.tagline,description=excluded.description,url=excluded.url,category=excluded.category,audience=excluded.audience,pricing=excluded.pricing,color=excluded.color,source=excluded.source,facts=excluded.facts,status=excluded.status,sponsored=excluded.sponsored,verified_at=excluded.verified_at,submission_details=excluded.submission_details,cover_id=excluded.cover_id`,
      p.id,p.slug,p.name,p.tagline,p.description,p.url,p.category,p.audience,p.pricing,p.color,p.icon,p.source,JSON.stringify(p.facts),p.status,+p.featured,+p.sponsored,+p.editorial,p.created_at,p.verified_at,JSON.stringify(p.submission),coverId);
    // Never let a stale desktop video approval bypass a cloud review or disclosure change.
    run("UPDATE jobs SET status='draft',approved_at=NULL,scheduled_at=NULL WHERE product_id=? AND status IN ('approved','queued')",p.id);
  });
}
console.log(`Synced ${products.length} cloud products to the desktop studio. Existing video approvals were cleared for review.`);
await client.auth.signOut();
