/**
 * scan-prefs.js — saved searches + favorites (v1.80.0). Browser classic script
 * loaded in a synthetic window with a fake localStorage. Covers persistence,
 * validation, and corrupt-cache reset (the behaviour the user asked to be sure of).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'public/js/lib/scan-prefs.js'), 'utf8');

function makeLS() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}
function load(ls = makeLS()) {
  const w = {};
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', SRC)(w, ls);
  return { P: w.ScanPrefs, ls };
}

test('saved searches: save / list / get / remove, de-dupe by name, sorted', () => {
  const { P } = load();
  assert.deepEqual(P.listSearches(), []);
  P.saveSearch('Backend', { text: 'go', remote: 'remote' });
  P.saveSearch('AI', { text: 'ml' });
  P.saveSearch('Backend', { text: 'rust' }); // overwrite, not duplicate
  const list = P.listSearches();
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((s) => s.name), ['AI', 'Backend']); // sorted
  assert.equal(P.getSearch('Backend').filters.text, 'rust');
  P.removeSearch('AI');
  assert.deepEqual(P.listSearches().map((s) => s.name), ['Backend']);
});

test('saveSearch: blank name is a no-op; filters are sanitized to scalars/string-arrays', () => {
  const { P } = load();
  P.saveSearch('   ', { text: 'x' });
  assert.equal(P.listSearches().length, 0);
  P.saveSearch('S', { text: 'go', n: 5, b: true, tech: ['php', 7, 'go'], junk: () => {}, nested: { a: 1 } });
  const f = P.getSearch('S').filters;
  assert.deepEqual(f, { text: 'go', n: 5, b: true, tech: ['php', 'go'] });
});

test('favorites: toggle adds/removes, isFavorite, de-dupe, clear', () => {
  const { P } = load();
  assert.deepEqual(P.listFavorites(), []);
  P.toggleFavorite('https://a/1');
  P.toggleFavorite('https://b/2');
  assert.equal(P.isFavorite('https://a/1'), true);
  assert.equal(P.listFavorites().length, 2);
  P.toggleFavorite('https://a/1'); // remove
  assert.equal(P.isFavorite('https://a/1'), false);
  P.toggleFavorite(''); // ignored
  P.toggleFavorite(null); // ignored
  assert.deepEqual(P.listFavorites(), ['https://b/2']);
  P.clearFavorites();
  assert.deepEqual(P.listFavorites(), []);
});

test('corrupt cache resets to empty (no throw) for both stores', () => {
  const ls = makeLS();
  ls.setItem('career-ops-ui:scan:saved-searches', '{not json');
  ls.setItem('career-ops-ui:scan:favorites', 'also broken');
  const { P } = load(ls);
  assert.deepEqual(P.listSearches(), []);
  assert.deepEqual(P.listFavorites(), []);
  // and it can write fresh values over the corrupt ones
  P.saveSearch('Fresh', { text: 'x' });
  assert.equal(P.listSearches().length, 1);
});

test('validation: junk entries in the arrays are filtered out', () => {
  const ls = makeLS();
  ls.setItem('career-ops-ui:scan:saved-searches', JSON.stringify([
    { name: 'ok', filters: { text: 'a' } },
    { name: '', filters: {} },            // blank name → dropped
    { name: 'bad', filters: [1, 2] },     // filters not an object → dropped
    'nonsense',                            // not an object → dropped
  ]));
  ls.setItem('career-ops-ui:scan:favorites', JSON.stringify(['https://a', 42, '', 'https://a']));
  const { P } = load(ls);
  assert.deepEqual(P.listSearches().map((s) => s.name), ['ok']);
  assert.deepEqual(P.listFavorites(), ['https://a']); // de-duped, junk dropped
});

test('no localStorage available → safe no-ops, never throws', () => {
  const w = {};
  // eslint-disable-next-line no-new-func
  new Function('window', SRC)(w); // localStorage undefined in scope
  assert.doesNotThrow(() => {
    assert.deepEqual(w.ScanPrefs.listSearches(), []);
    assert.deepEqual(w.ScanPrefs.listFavorites(), []);
    w.ScanPrefs.saveSearch('x', { a: 1 });
    w.ScanPrefs.toggleFavorite('https://x');
  });
});
