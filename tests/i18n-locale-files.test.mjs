/**
 * I18N-SPLIT (v1.60.0) — structural lock for the per-locale dictionary.
 *
 * The 8-column megafile (public/js/lib/i18n-dict.js) was split into one
 * file per locale plus a shared alias map under public/js/lib/locales/.
 * i18n-dict.js is now an assembler that merges them back into
 * window.__I18N_DICT. These tests guarantee the split stays lossless and
 * the per-locale files stay in parity:
 *
 *   1. the assembled dict is byte-for-byte the captured pre-split snapshot
 *   2. every locale file defines its window global with the SAME key set
 *   3. alias map integrity: targets exist, no chains, no overlap with tables
 *   4. index.html loads every locale + the alias map + the assembler,
 *      in order, before i18n.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOCALES = resolve(ROOT, 'public', 'js', 'lib', 'locales');

const GLOBAL = (lang) => `__I18N_DICT_${lang.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

/** Evaluate one locale file in isolation and return its key→string table. */
function loadTable(lang) {
  const ctx = createContext({ window: {} });
  runInContext(readFileSync(resolve(LOCALES, `i18n-dict.${lang}.js`), 'utf8'), ctx);
  return ctx.window[GLOBAL(lang)];
}

function loadAliases() {
  const ctx = createContext({ window: {} });
  runInContext(readFileSync(resolve(LOCALES, 'i18n-dict.aliases.js'), 'utf8'), ctx);
  return ctx.window.__I18N_ALIASES;
}

test('assembled dict is byte-for-byte the pre-split snapshot (lossless migration)', () => {
  const assembled = JSON.parse(JSON.stringify(loadAssembledDict())); // strip vm-realm prototype
  const snapshot = JSON.parse(readFileSync(resolve(ROOT, 'tests', 'fixtures', 'i18n-dict.snapshot.json'), 'utf8'));
  assert.deepEqual(assembled, snapshot);
});

test('every locale file defines its window global as a non-empty object', () => {
  for (const lang of I18N_LANGS) {
    const table = loadTable(lang);
    assert.equal(typeof table, 'object', `${GLOBAL(lang)} must be an object`);
    assert.ok(table && Object.keys(table).length > 0, `${GLOBAL(lang)} must be non-empty`);
  }
});

test('all locale files share the SAME key set as en (full parity, no drift)', () => {
  const enKeys = Object.keys(loadTable('en')).sort();
  for (const lang of I18N_LANGS) {
    if (lang === 'en') continue;
    const keys = Object.keys(loadTable(lang)).sort();
    const missing = enKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !enKeys.includes(k));
    assert.deepEqual(missing, [], `${lang} is MISSING keys present in en`);
    assert.deepEqual(extra, [], `${lang} has EXTRA keys not in en`);
  }
});

test('locale values are non-empty strings', () => {
  for (const lang of I18N_LANGS) {
    const table = loadTable(lang);
    for (const [key, val] of Object.entries(table)) {
      assert.equal(typeof val, 'string', `${lang}.${key} must be a string`);
      assert.ok(val.length > 0, `${lang}.${key} must be non-empty`);
    }
  }
});

test('alias map: targets exist in en, are not themselves aliases, and never collide with table keys', () => {
  const aliases = loadAliases();
  const enTable = loadTable('en');
  const aliasKeys = Object.keys(aliases);
  assert.ok(aliasKeys.length > 0, 'alias map must not be empty');
  for (const [key, target] of Object.entries(aliases)) {
    assert.equal(typeof target, 'string', `${key} alias target must be a string`);
    assert.ok(enTable[target] !== undefined,
      `${key} → "${target}" but the target is not a real key in en`);
    assert.ok(aliases[target] === undefined,
      `${key} → "${target}" which is itself an alias — chains are forbidden (keeps t() O(1))`);
    // An alias key must NOT also live in the per-locale tables (would double-define).
    assert.ok(enTable[key] === undefined,
      `${key} is both an alias and a real en key — pick one`);
  }
});

test('index.html loads every locale + alias map + assembler, in order, before i18n.js', () => {
  const html = readFileSync(resolve(ROOT, 'public', 'index.html'), 'utf8');
  const expectedOrder = [
    ...I18N_LANGS.map((l) => `/js/lib/locales/i18n-dict.${l}.js`),
    '/js/lib/locales/i18n-dict.aliases.js',
    '/js/lib/i18n-dict.js',
    '/js/lib/i18n.js',
  ];
  let cursor = -1;
  for (const src of expectedOrder) {
    const at = html.indexOf(`src="${src}"`);
    assert.notStrictEqual(at, -1, `index.html must load ${src}`);
    assert.ok(at > cursor, `index.html must load ${src} after the previous i18n script (order matters)`);
    cursor = at;
  }
});
