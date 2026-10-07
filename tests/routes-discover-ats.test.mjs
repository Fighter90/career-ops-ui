/**
 * scanners-filters — discover-ats.mjs pure helpers:
 *   - insertIntoTrackedCompanies handles `tracked_companies: []` (flow form), a
 *     trailing comment on the header, and a column-0 list — every result must
 *     still parse with exactly one tracked_companies key.
 *   - deriveSlugs folds Latin accents (Nestlé -> nestle, not nestl).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import yaml from 'js-yaml';
import { insertIntoTrackedCompanies, renderPortalEntry, deriveSlugs } from '../server/lib/discover-ats.mjs';

const SNIP = [renderPortalEntry({ name: 'Acme', careers_url: 'https://boards.greenhouse.io/acme', provider: 'greenhouse' })];
const names = (text) => yaml.load(text).tracked_companies.map((c) => c.name);

test('flow form `tracked_companies: []` becomes a block, not a duplicate key', () => {
  const out = insertIntoTrackedCompanies('tracked_companies: []\n', SNIP);
  assert.equal((out.match(/^tracked_companies:/gm) || []).length, 1);
  assert.deepEqual(names(out), ['Acme']);
});

test('flow form with a comment, between other keys', () => {
  const out = insertIntoTrackedCompanies('x: 1\ntracked_companies: [] # watched\ny: 2\n', SNIP);
  const doc = yaml.load(out);
  assert.deepEqual(doc.tracked_companies.map((c) => c.name), ['Acme']);
  assert.equal(doc.y, 2);
  assert.match(out, /# watched/);
});

test('header with a trailing comment keeps existing entries', () => {
  const src = 'tracked_companies: # mine\n  - name: A\n    careers_url: https://a.example/\nother: 1\n';
  const out = insertIntoTrackedCompanies(src, SNIP);
  assert.deepEqual(names(out), ['A', 'Acme']);
  assert.equal(yaml.load(out).other, 1);
});

test('column-0 list items stay in-block and the new entry matches their indent', () => {
  const src = 'tracked_companies:\n- name: A\n  careers_url: https://a.example/\nother: 1\n';
  const out = insertIntoTrackedCompanies(src, SNIP);
  assert.deepEqual(names(out), ['A', 'Acme']);
  assert.equal(yaml.load(out).other, 1);
});

test('no header at all -> appended block; no snippets -> unchanged', () => {
  assert.deepEqual(names(insertIntoTrackedCompanies('x: 1', SNIP)), ['Acme']);
  assert.equal(insertIntoTrackedCompanies('x: 1\n', []), 'x: 1\n');
});

test('deriveSlugs folds accents', () => {
  assert.deepEqual(deriveSlugs('Nestlé'), ['nestle']);
  assert.deepEqual(deriveSlugs('Société Générale'), ['societe-generale', 'societegenerale']);
});
