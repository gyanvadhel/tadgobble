import test from 'node:test';
import assert from 'node:assert/strict';
import { sitePalette, paletteStyle, contrastRatio, productTints } from '../lib/design-tokens.mjs';
import { isNew, freshProducts } from '../lib/fresh.mjs';

const DAY = 86400000,
  NOW = Date.parse('2026-11-03T12:00:00Z');

test('palette is the Highlighter set', () => {
  assert.equal(sitePalette.bg, '#160b26');
  assert.equal(sitePalette.yellow, '#ffe600');
  assert.equal(sitePalette.violet, '#7b4dff');
  assert.equal(paletteStyle['--on-yellow'], '#160b26');
  assert.equal(paletteStyle['--violet-text'], '#a98bff');
  assert.equal(paletteStyle['--on-violet'], '#ffffff');
});

test('text pairs meet WCAG AA', () => {
  const p = sitePalette;
  for (const [fg, bg] of [
    [p.text, p.bg],
    [p.text, p.surface],
    [p.muted, p.bg],
    [p.muted, p.surface],
    [p.onYellow, p.yellow],
    [p.violetText, p.bg],
    [p.violetText, p.surface],
    [p.onViolet, p.violet],
    [p.orange, p.bg],
  ])
    assert.ok(contrastRatio(fg, bg) >= 4.5, `${fg} on ${bg}`);
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
});

test('product tints stay readable under dark text', () => {
  for (const tint of Object.values(productTints))
    assert.ok(contrastRatio(sitePalette.onYellow, tint) >= 4.5, tint);
});

test('isNew', () => {
  assert.equal(isNew(new Date(NOW - 2 * DAY).toISOString(), NOW), true);
  assert.equal(isNew(new Date(NOW - 8 * DAY).toISOString(), NOW), false);
  assert.equal(isNew(new Date(NOW + DAY).toISOString(), NOW), false);
  assert.equal(isNew(undefined, NOW), false);
  assert.equal(isNew('not a date', NOW), false);
});

test('freshProducts sorts newest first and ignores featured', () => {
  const list = [
    { slug: 'a', created_at: '2026-10-01T00:00:00Z', featured: 1 },
    { slug: 'b', created_at: '2026-11-01T00:00:00Z', featured: 0 },
  ];
  assert.deepEqual(
    freshProducts(list).map((p) => p.slug),
    ['b', 'a'],
  );
  assert.equal(list[0].slug, 'a');
});

test('findStrayColors flags raw colours outside :root and art lines', async () => {
  const { findStrayColors } = await import('../scripts/check-colors.mjs');
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const path = await import('node:path');
  const dir = mkdtempSync(path.resolve('test-results/colors-'));
  const file = path.join(dir, 'a.css');
  writeFileSync(
    file,
    'a{color:#fff}\nb{color:var(--text)}\nc{background:#abc /* art */}\nd{white-space:nowrap}\n/* no more\nblinking white */\n',
  );
  const found = findStrayColors([file]);
  assert.equal(found.length, 1);
  assert.equal(found[0].line, 1);
});

test('shared stylesheets use palette variables only', async () => {
  const { findStrayColors } = await import('../scripts/check-colors.mjs');
  assert.deepEqual(
    findStrayColors(['app/globals.css', 'app/motion.css', 'app/dropdown.css', 'app/legal.css']),
    [],
  );
});
