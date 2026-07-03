/**
 * v1.85.0 — explicit coverage for the three locales added in this release:
 * German (de), Italian (it), Turkish (tr). The broad parity gates
 * (i18n-locale-files, i18n-coverage, lang-switcher-rtl) already iterate
 * I18N_LANGS and therefore cover these too; this file is a focused,
 * self-documenting proof that the NEW locales load, resolve t(), register
 * in the switcher, stay LTR, and ship their help/README/CHANGELOG bundles.
 *
 * CI-isolated: reads only web-ui's own public/ + docs/ + repo-root files
 * via the vm helpers — no parent career-ops project required.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict, loadI18n, localeSource } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NEW = ['de', 'it', 'tr'];

test('de/it/tr locale tables exist and export their window global', () => {
  for (const l of NEW) {
    const src = localeSource(l);
    assert.match(src, new RegExp(`window\\.__I18N_DICT_${l.toUpperCase()}\\b`),
      `i18n-dict.${l}.js must assign window.__I18N_DICT_${l.toUpperCase()}`);
  }
});

test('de/it/tr have full key parity with en in the assembled dict', () => {
  const dict = loadAssembledDict();
  const enKeys = Object.entries(dict)
    .filter(([, row]) => !row['@alias'] && row.en !== undefined)
    .map(([k]) => k);
  assert.ok(enKeys.length > 500, 'sanity: en should have many keys');
  for (const l of NEW) {
    const missing = enKeys.filter((k) => dict[k][l] === undefined || String(dict[k][l]).trim() === '');
    assert.equal(missing.length, 0,
      `${l} missing/empty for ${missing.length} keys (e.g. ${missing.slice(0, 5).join(', ')})`);
  }
});

test('de/it/tr are registered in the language switcher (getLangs) with label + flag', () => {
  const I18n = loadI18n();
  const byCode = new Map(I18n.getLangs().map((l) => [l.code, l]));
  for (const l of NEW) {
    const entry = byCode.get(l);
    assert.ok(entry, `${l} must be in getLangs()`);
    assert.ok(entry.label && entry.label.length, `${l} needs a label`);
    assert.match(entry.flag, /\p{Regional_Indicator}/u, `${l} needs a flag emoji`);
  }
  assert.equal(I18n.getLangs().length, 16, 'exactly 16 locales registered');
});

test('t() resolves a real translated string for de/it/tr (not the bare key)', () => {
  const I18n = loadI18n();
  for (const l of NEW) {
    I18n.setLang(l);
    const v = I18n.t('nav.dashboard', 'Dashboard');
    assert.ok(v && v !== 'nav.dashboard', `${l}: t('nav.dashboard') must resolve`);
  }
});

test('de/it/tr are LTR (only ar is in the RTL_LANGS set)', () => {
  const src = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'i18n.js'), 'utf8');
  const m = src.match(/RTL_LANGS\s*=\s*new Set\(\[([^\]]*)\]\)/);
  assert.ok(m, 'RTL_LANGS set must exist in i18n.js');
  for (const l of NEW) {
    assert.doesNotMatch(m[1], new RegExp(`'${l}'`), `${l} must not be in RTL_LANGS (it is LTR)`);
  }
});

test('de/it/tr ship help, README and CHANGELOG bundles', () => {
  for (const l of NEW) {
    assert.ok(existsSync(resolve(ROOT, 'docs', 'help', `${l}.md`)), `docs/help/${l}.md must exist`);
    assert.ok(existsSync(resolve(ROOT, `README.${l}.md`)), `README.${l}.md must exist`);
    assert.ok(existsSync(resolve(ROOT, `CHANGELOG.${l}.md`)), `CHANGELOG.${l}.md must exist`);
    // help bundle holds the gated 19 H2 / 75 H3 structure
    const help = readFileSync(resolve(ROOT, 'docs', 'help', `${l}.md`), 'utf8');
    assert.equal((help.match(/^## /gm) || []).length, 19, `docs/help/${l}.md must have 19 H2`);
    assert.equal((help.match(/^### /gm) || []).length, 75, `docs/help/${l}.md must have 75 H3`);
  }
});
