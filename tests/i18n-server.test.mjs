import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadLocaleDict, loadI18nAliases, localeLabel } from '../server/lib/i18n-server.mjs';

// import.meta.dirname needs Node >= 20.11 — CI still gates node 18.
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

// One canonical module instance only: query-busted re-imports of the same
// file fragment the V8 coverage report into per-instance rows (the CI
// coverage ratchet means every row must clear the floor). The caches are
// keyed safely (dict by code, aliases by resolved dir), so sharing one
// instance across tests is deterministic.

test('loadI18nAliases: a checkout without the alias file degrades to {} (injectable dir)', () => {
  const emptyDir = mkdtempSync(resolve(tmpdir(), 'i18n-server-empty-'));
  const a = loadI18nAliases(emptyDir);
  assert.deepEqual(a, {}, 'missing alias file → empty map, never a throw');
  assert.equal(loadI18nAliases(emptyDir), a, 'degraded map is cached per dir');
});

test('loadLocaleDict: empty / junk / unknown locales resolve null', () => {
  assert.equal(loadLocaleDict(''), null, 'empty lang → null');
  assert.equal(loadLocaleDict(null), null, 'null lang → null');
  assert.equal(loadLocaleDict('///'), null, 'sanitizes to nothing → null (no file read)');
  assert.equal(loadLocaleDict('no-such-locale'), null, 'missing locale file → null');
  // A file that exists but defines no __I18N_DICT_<NAME> global → null
  // (i18n-dict.aliases.js defines __I18N_ALIASES instead).
  assert.equal(loadLocaleDict('aliases'), null, 'a locale file without its global → null');
});

test('loadLocaleDict: reads the shipped per-locale table and caches it', () => {
  const ru = loadLocaleDict('ru');
  assert.ok(ru && typeof ru === 'object', 'ru dict is an object');
  assert.equal(typeof ru['nav.scan'], 'string', 'ru nav.scan is a string');
  assert.equal(loadLocaleDict('ru'), ru, 'second call returns the cached table (same reference)');
  // pt-BR proves the global-name derivation (PT_BR uppercase fold).
  const pt = loadLocaleDict('pt-BR');
  assert.ok(pt && typeof pt['nav.scan'] === 'string', 'pt-BR dict loads');
});

test('loadI18nAliases: the shipped alias map loads and caches per dir', () => {
  const a1 = loadI18nAliases();
  assert.ok(a1 && typeof a1 === 'object');
  assert.equal(typeof a1['nav.apply'], 'string', 'nav.apply alias exists');
  assert.equal(loadI18nAliases(), a1, 'same dir → cached map');
  const emptyDir = mkdtempSync(resolve(tmpdir(), 'i18n-server-empty2-'));
  assert.deepEqual(loadI18nAliases(emptyDir), {}, 'another dir → its own (degraded) map');
  assert.equal(loadI18nAliases(), a1, 'the shipped dir cache is untouched by the fixture dir');
});

test('localeLabel: own key, alias hop, en fallback, prototype guard', () => {
  // Own-key lookup in the request locale.
  const ruScan = localeLabel('ru', 'nav.scan');
  assert.equal(typeof ruScan, 'string');
  assert.ok(ruScan.length > 0 && !ruScan.includes('Scan'), `ru label localized: ${ruScan}`);
  // Alias hop: nav.apply has no own entry — resolves through apply.title.
  assert.equal(localeLabel('ru', 'nav.apply'), localeLabel('ru', 'apply.title'),
    'nav.apply resolves to its alias target');
  // Unknown key → '' (caller keeps its label).
  assert.equal(localeLabel('ru', 'no.such.key'), '');
  // Unknown locale → en fallback.
  assert.equal(localeLabel('xx', 'nav.scan'), localeLabel('en', 'nav.scan'));
  // lang === 'en' never double-resolves (short-circuit branch).
  assert.equal(localeLabel('en', 'nav.scan'), localeLabel('en', 'nav.scan'));
  // Prototype chain must NOT resolve ('constructor' has no own property).
  assert.equal(localeLabel('ru', 'constructor'), '');
  assert.equal(localeLabel('ru', 'toString'), '');
  // Junk key / junk lang.
  assert.equal(localeLabel('ru', ''), '');
  assert.equal(localeLabel('ru', null), '');
  assert.equal(localeLabel(null, 'nav.scan'), localeLabel('en', 'nav.scan'), 'null lang → en');
});

test('v1.268.0 wiring: docs-assistant imports the loader and rewrites deep-link labels', async () => {
  const src = await (await import('node:fs/promises')).readFile(resolve(ROOT, 'server', 'lib', 'routes', 'docs-assistant.mjs'), 'utf8');
  assert.ok(src.includes("from '../i18n-server.mjs'"), 'docs-assistant uses the shared server loader');
  assert.ok(src.includes('localizeDeepLinks'), 'the deep-link rewriter is wired');
});
