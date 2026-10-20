import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { starterProducts } from './catalog.mjs';

export const dataDir = path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || './data');
mkdirSync(dataDir, { recursive: true });
export const mediaDir = path.join(dataDir, 'media');
mkdirSync(mediaDir, { recursive: true });
const globalKey = Symbol.for('aplatform.database');
export const db = (globalThis[globalKey] ||= new DatabaseSync(
  path.join(dataDir, 'aplatform.sqlite'),
));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, tagline TEXT NOT NULL, description TEXT NOT NULL, url TEXT NOT NULL, category TEXT NOT NULL, audience TEXT NOT NULL, pricing TEXT NOT NULL, color TEXT NOT NULL DEFAULT 'lilac', icon TEXT NOT NULL DEFAULT 'spark', source TEXT NOT NULL, facts TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', owner_id TEXT REFERENCES users(id), featured INTEGER NOT NULL DEFAULT 0, sponsored INTEGER NOT NULL DEFAULT 0, editorial INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, verified_at TEXT);
  CREATE TABLE IF NOT EXISTS saves (user_id TEXT NOT NULL REFERENCES users(id), product_id TEXT NOT NULL REFERENCES products(id), created_at TEXT NOT NULL, PRIMARY KEY(user_id, product_id));
  CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, kind TEXT NOT NULL, product_id TEXT REFERENCES products(id), visitor TEXT NOT NULL, source TEXT NOT NULL, campaign TEXT, created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS events_date ON events(created_at);
  CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), status TEXT NOT NULL DEFAULT 'draft', script TEXT NOT NULL, caption TEXT NOT NULL, storyboard TEXT NOT NULL, source_file TEXT, output_file TEXT, rights_confirmed INTEGER NOT NULL DEFAULT 0, scheduled_at TEXT, container_id TEXT, media_id TEXT, permalink TEXT, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, approved_at TEXT, published_at TEXT);
  CREATE INDEX IF NOT EXISTS jobs_due ON jobs(status,scheduled_at);
  CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, job_id TEXT, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, product_url TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS product_covers (id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id) ON DELETE SET NULL, filename TEXT NOT NULL, kind TEXT NOT NULL, source_url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
`);
// Additive migration for optional maker-supplied discovery details.
if (
  !db
    .prepare('PRAGMA table_info(products)')
    .all()
    .some((column) => column.name === 'submission_details')
) {
  db.exec("ALTER TABLE products ADD COLUMN submission_details TEXT NOT NULL DEFAULT '{}'");
}
if (
  !db
    .prepare('PRAGMA table_info(products)')
    .all()
    .some((column) => column.name === 'cover_id')
)
  db.exec('ALTER TABLE products ADD COLUMN cover_id TEXT REFERENCES product_covers(id)');
export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = fn();
    db.exec('COMMIT');
    return value;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
export function audit(jobId, action, detail = '') {
  run('INSERT INTO audit VALUES (?,?,?,?,?)', id(), jobId, action, detail, now());
}
export function parseProduct(p) {
  return p
    ? {
        ...Object.fromEntries(Object.entries(p).filter(([key]) => key !== 'submission_details')),
        submission: JSON.parse(p.submission_details || '{}'),
        cover: p.cover_id
          ? {
              ...get('SELECT id,kind,created_at FROM product_covers WHERE id=?', p.cover_id),
              url: `/api/covers/${p.cover_id}`,
            }
          : null,
        facts: JSON.parse(p.facts),
        featured: !!p.featured,
        sponsored: !!p.sponsored,
        editorial: !!p.editorial,
      }
    : null;
}
export function listProducts(userId = '') {
  return all(
    `SELECT p.*, (SELECT count(*) FROM saves WHERE product_id=p.id) as save_count,
    (SELECT count(*) FROM comments WHERE product_id=p.id) as comment_count,
    EXISTS(SELECT 1 FROM saves WHERE product_id=p.id AND user_id=?) as saved,
    u.name as owner_name FROM products p LEFT JOIN users u ON p.owner_id=u.id
    WHERE p.status='published' ORDER BY p.featured DESC,p.created_at DESC`,
    userId,
  ).map(parseProduct);
}
export function listJobs() {
  return all(
    'SELECT j.*, p.name as product_name, p.color, p.slug FROM jobs j JOIN products p ON p.id=j.product_id ORDER BY j.created_at DESC',
  ).map((j) => ({ ...j, storyboard: JSON.parse(j.storyboard) }));
}

if (
  process.env.SEED_CATALOG === 'true' &&
  !get("SELECT value FROM settings WHERE key='catalog_seeded'")
) {
  transaction(() => {
    for (const p of starterProducts)
      run(
        `INSERT OR IGNORE INTO products (id,slug,name,tagline,description,url,category,audience,pricing,color,icon,source,facts,status,featured,editorial,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'published',?,1,?)`,
        p.id,
        p.id,
        p.name,
        p.tagline,
        p.description,
        p.url,
        p.category,
        p.audience,
        p.pricing,
        p.color,
        p.icon,
        p.source,
        JSON.stringify(p.facts),
        p.featured ? 1 : 0,
        now(),
      );
    run('INSERT OR IGNORE INTO settings VALUES (?,?)', 'catalog_seeded', 'true');
  });
}
