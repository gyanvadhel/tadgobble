import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import path from 'node:path';
mkdirSync('test-results', { recursive: true });
process.env.DATA_DIR = mkdtempSync(path.resolve('test-results/instant-local-'));
process.env.SEED_CATALOG = 'false';
const { db, get } = await import('../lib/db.mjs');

const edit = {
  name: 'New name',
  tagline: 't2',
  description: 'd2',
  url: 'https://e.test',
  category: 'c',
  audience: 'a',
  pricing: 'p',
  source: 'https://e.test',
  facts: '[]',
  submission_details: '{}',
  cover_id: null,
};
function add(id, status, pending = '') {
  db.prepare(
    `INSERT INTO products (id,slug,name,tagline,description,url,category,audience,pricing,source,facts,created_at,status,pending_edit,verified_at)
     VALUES (?,?,?,'t','d','https://e.test','c','a','p','https://e.test','[]','now',?,?,?)`,
  ).run(id, id, id, status, pending, pending ? 'checked' : null);
}

test('work left in the old review queue goes live the next time the local database opens', async () => {
  add('waiting', 'pending');
  add('changes', 'needs_changes');
  add('down', 'rejected');
  add('edited', 'published', JSON.stringify(edit));
  // A fresh process runs the startup migrations again; importing under a new query does the same.
  await import('../lib/db.mjs?reopen');
  assert.equal(get("SELECT status FROM products WHERE id='waiting'").status, 'published');
  assert.equal(get("SELECT status FROM products WHERE id='changes'").status, 'published');
  assert.equal(get("SELECT status FROM products WHERE id='down'").status, 'rejected');
  const edited = get("SELECT * FROM products WHERE id='edited'");
  assert.equal(edited.name, 'New name');
  assert.equal(edited.pending_edit, '');
  assert.equal(edited.verified_at, null);
});
