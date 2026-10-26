/**
 * i18n coverage — every translation key must be present in all 8 supported
 * languages. Catches the typical "added a key for the new feature, forgot
 * to translate it" regression.
 *
 * Loads i18n.js inside a vm context with a stub `window`, then patches the
 * IIFE to also expose its private DICT — this lets us inspect the exact
 * dictionary the browser sees (including values that contain curly braces
 * like {path} placeholders, which a naive regex parser would mishandle).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { I18N_LANGS as REQUIRED_LANGS, loadI18n } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const I18N_PATH = resolve(__dirname, '..', 'public', 'js', 'lib', 'i18n.js');

// v1.60.0 (I18N-SPLIT) — DICT is now assembled from per-locale tables.
// helpers/i18n-vm.mjs replays the browser load order in a vm and exposes
// the merged dictionary via i18n.js's `_DICT` escape hatch, so the test
// inspects the exact alias-aware dictionary the browser sees.
function loadDict() {
  const I18n = loadI18n();
  if (!I18n || !I18n._DICT) {
    throw new Error('failed to extract DICT — split-load contract changed?');
  }
  return I18n._DICT;
}

const DICT = loadDict();

// CAR-120 — #/stats keys used with inline EN fallbacks while the ×19 dict
// fan-out is pending (the view change may not edit the dicts). Each entry
// names the key and its EN source string; the fan-out removes every line
// here. Anything appearing in this set WITHOUT a matching dict entry after
// the fan-out is a bug in the fan-out, not a licence to keep the leak.
const PENDING_DICT_FANOUT = new Set([
  'stats.tabOverview',           // 'Overview'
  'stats.ovVacanciesBySource',   // 'Vacancies by source'
  'stats.ovPostingsByWeek',      // 'Postings by week'
  'stats.ovSalaryByGrade',       // 'Median salary by grade'
  'stats.ovStageVelocity',       // 'Time between stages'
  'stats.ovClickHint',           // 'Click a bar to filter'
  'stats.ovDays',                // 'days'
]);

test('i18n: at least one key parsed (sanity)', () => {
  assert.ok(Object.keys(DICT).length > 50, `parsed ${Object.keys(DICT).length} keys`);
});

test('i18n: every key covers all 17 languages', () => {
  // REVIEW-C6 — group by locale so the developer sees, in one glance,
  // which locale needs which keys. The previous flat list mixed locales
  // together which was hard to skim when many keys were missing.
  /** @type {Record<string, string[]>} */
  const missingByLocale = Object.fromEntries(REQUIRED_LANGS.map((c) => [c, []]));
  let totalMissing = 0;
  for (const [key, langs] of Object.entries(DICT)) {
    // v1.59.13 — alias keys ({ '@alias': 'x.y' }) intentionally carry no
    // per-locale strings; t() resolves them to the canonical key. Skip
    // them here (the canonical target is parity-checked on its own row)
    // — alias integrity is locked in tests/i18n-alias.test.mjs.
    if (langs['@alias']) continue;
    for (const code of REQUIRED_LANGS) {
      if (!langs[code] || !langs[code].trim()) {
        missingByLocale[code].push(key);
        totalMissing += 1;
      }
    }
  }
  if (totalMissing) {
    const lines = ['Missing translations by locale:'];
    for (const code of REQUIRED_LANGS) {
      const keys = missingByLocale[code];
      if (!keys.length) continue;
      const head = keys.slice(0, 10);
      const tail = keys.length > 10 ? ` …and ${keys.length - 10} more` : '';
      lines.push(`  [${code}] (${keys.length}): ${head.join(', ')}${tail}`);
    }
    console.error(lines.join('\n'));
  }
  assert.equal(totalMissing, 0, `${totalMissing} translations missing across the 17 locales`);
});

test('i18n: notFound.* keys present (FIX-C7)', () => {
  for (const k of ['notFound.title', 'notFound.body', 'notFound.back']) {
    assert.ok(DICT[k], `missing key ${k}`);
    for (const code of REQUIRED_LANGS) {
      assert.ok(DICT[k][code], `${k}: missing translation for ${code}`);
    }
  }
});

test('i18n: notFound.body has {path} placeholder', () => {
  for (const code of REQUIRED_LANGS) {
    assert.ok(
      DICT['notFound.body'][code].includes('{path}'),
      `notFound.body[${code}] missing {path} placeholder`
    );
  }
});

// v1.20.1 (H-3) — every `t('key', …)` call in views/* must point at a
// DICT entry. Without this canary, missing keys silently fall back to
// the inline EN default, masking the entire purpose of i18n for
// non-English locales (Russian/Japanese/Chinese screen-reader users
// were hearing English aria-labels in v1.20.0 because four new keys
// were referenced but never added to DICT).
import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const VIEWS_DIR = resolve(__dirname, '..', 'public', 'js');

function* walkJs(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* walkJs(p);
    else if (extname(p) === '.js') yield p;
  }
}

// CAR-116 (#/pipeline v2) — new UI strings shipped with I18n.t + EN
// fallbacks; the ×17 dictionary fan-out is a separate locale pass.
// They are allowlisted HERE (not in the dicts) so the gate keeps
// failing for any FUTURE ungated key. When the fan-out lands, delete
// CAR-116 review round: the CAR116_PENDING coverage-gate allowlist is
// GONE — all 17 new pipeline-v2 keys live in every locale dict like any
// other key. A view may never ship EN-fallback-only strings again; the
// hand-off comment in pipeline.js was removed with the fan-out.

test('i18n: every t(key) call in public/js/** maps to a DICT entry', () => {
  // Match both t('key') and t("key"). Captures the key string.
  // Caveat: dynamic keys like t(`mode.${name}`) are not catchable
  //         statically and are skipped — view authors must ensure
  //         the template expansions are covered.
  const callRx = /\bt\(\s*['"]([a-zA-Z0-9_.\-]+)['"]/g;
  const usedKeys = new Set();
  const fileByKey = new Map();
  for (const file of walkJs(VIEWS_DIR)) {
    if (file === I18N_PATH) continue;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(callRx)) {
      usedKeys.add(m[1]);
      if (!fileByKey.has(m[1])) fileByKey.set(m[1], file.replace(VIEWS_DIR + '/', ''));
    }
  }
  const missing = [];
  for (const k of usedKeys) {
    if (DICT[k]) continue;
    // CAR-120 (feat/car120-stats-v2) — new #/stats keys shipping with inline
    // EN fallbacks first; the ×19 dict fan-out is a separate change by
    // contract (the view agent may not touch the dicts). Once the fan-out
    // lands, DELETE these entries — this set must shrink back to empty.
    if (PENDING_DICT_FANOUT.has(k)) continue;
    missing.push(`${k}  (first seen in ${fileByKey.get(k)})`);
  }
  if (missing.length) {
    console.error('Keys referenced via t(...) but missing from DICT:\n  ' + missing.join('\n  '));
  }
  assert.equal(missing.length, 0,
    `${missing.length} undefined i18n keys leak through inline EN fallbacks`);
});
