#!/usr/bin/env node
/**
 * i18n dictionary hygiene audit (I18N-CL4, v1.59.12).
 *
 * Loads public/js/lib/i18n-dict.js (a classic script that assigns
 * `window.__I18N_DICT`) inside a vm sandbox and runs hygiene checks.
 *
 * The dict shape is KEY-keyed:
 *     'some.key': { en: '…', es: '…', 'pt-BR': '…', ru, ja, ko, 'zh-CN', 'zh-TW' }
 *
 * HARD failures (exit 1) — block a ship:
 *   1. Personal-data leak (maintainer cert / email / LinkedIn)
 *   2. Locale parity gap (a key missing one of the 8 locales)
 *   3. Empty value in any locale
 *   4. Hardcoded calendar date literal (e.g. 2026-04-21) — these rot;
 *      a format hint like YYYY-MM-DD / AAAA-MM-DD / ГГГГ-ММ-ДД is fine.
 *
 * WARNINGS (exit 0) — informational, do NOT block:
 *   5. Duplicate values within a locale. In THIS codebase most dupes
 *      are intentional: `nav.scan` (sidebar) vs `scan.btnRun` (button)
 *      vs `scan.col.company` (table header) share an English word but
 *      are distinct UI roles that non-English locales frequently need
 *      to translate differently. Forcing a single canonical key would
 *      remove that flexibility (see I18N-CL3 decision in the v1.59.12
 *      CHANGELOG). So we REPORT dupes but never fail on them.
 *   6. Trailing/leading whitespace — several keys legitimately end with
 *      ": " (e.g. `config.profileLoadErr`), so this is a warning.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR = resolve(__dirname, '..', 'public', 'js', 'lib');
const LOCALES_DIR = resolve(LIB_DIR, 'locales');
const DICT_PATH = resolve(LIB_DIR, 'i18n-dict.js'); // the assembler

const LOCALES = ['en', 'es', 'pt-BR', 'ru', 'ja', 'ko', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar'];

const PERSONAL = [
  /AWS\s+Solutions\s+Architect/i,
  /Azure\s+(?:Architect|Developer|Engineer)\s+Associate/i,
  /[a-z0-9._%+-]+@(?:gmail|yandex|mail|outlook|proton|protonmail|hotmail)\.[a-z]{2,}/i,
  /linkedin\.com\/in\/[\w-]+/i,
];

// A bare calendar date that IS the whole value (a placeholder that
// rots — the I18N-CL2 defect). We anchor on the full trimmed string so
// a date used as an *example inside* explanatory copy — e.g.
// `followup.lastErr` = "…ISO date: YYYY-MM-DD (e.g. 2026-05-19)." — is
// NOT flagged. Those inline examples are good UX, not rot. Format
// hints (YYYY-MM-DD / AAAA-MM-DD / ГГГГ-ММ-ДД) never match this.
const BARE_CALENDAR_DATE = /^\s*(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\s*$/;

function loadDict() {
  // v1.60.0 (I18N-SPLIT) — replay the browser load order: every per-locale
  // table, then the alias map, then the assembler that builds __I18N_DICT.
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar']) {
    const f = resolve(LOCALES_DIR, `i18n-dict.${lang}.js`);
    vm.runInContext(readFileSync(f, 'utf8'), sandbox, { filename: `i18n-dict.${lang}.js` });
  }
  vm.runInContext(readFileSync(resolve(LOCALES_DIR, 'i18n-dict.aliases.js'), 'utf8'), sandbox, { filename: 'i18n-dict.aliases.js' });
  vm.runInContext(readFileSync(DICT_PATH, 'utf8'), sandbox, { filename: 'i18n-dict.js' });
  return sandbox.window.__I18N_DICT;
}

function main() {
  const dict = loadDict();
  const keys = Object.keys(dict);
  const hardFailures = [];
  const warnings = [];

  // 1. Personal data
  for (const key of keys) {
    for (const loc of LOCALES) {
      const v = dict[key]?.[loc];
      if (typeof v !== 'string') continue;
      for (const re of PERSONAL) {
        if (re.test(v)) hardFailures.push(`[personal-data] ${key}[${loc}] = "${v}"`);
      }
    }
  }

  // 2. Parity + 3. empty values (alias keys are exempt — see below)
  for (const key of keys) {
    const row = dict[key] || {};
    if (row['@alias']) continue; // checked in the alias-integrity pass
    for (const loc of LOCALES) {
      if (!(loc in row)) {
        hardFailures.push(`[parity] ${key} missing locale "${loc}"`);
      } else if (typeof row[loc] !== 'string' || row[loc].length === 0) {
        hardFailures.push(`[empty] ${key}[${loc}] is empty`);
      }
    }
  }

  // 2b. Alias integrity — every @alias target must exist and must NOT
  // itself be an alias (no alias chains, keeps t() resolution O(1)).
  for (const key of keys) {
    const target = dict[key]?.['@alias'];
    if (!target) continue;
    if (!dict[target]) {
      hardFailures.push(`[alias] ${key} → "${target}" but target does not exist`);
    } else if (dict[target]['@alias']) {
      hardFailures.push(`[alias] ${key} → "${target}" which is itself an alias (no chains allowed)`);
    }
  }

  // Resolve a key's value for a locale, following one @alias hop.
  const resolve = (key, loc) => {
    const row = dict[key];
    if (!row) return undefined;
    if (row['@alias']) return dict[row['@alias']]?.[loc];
    return row[loc];
  };

  // 4. Hardcoded calendar dates (resolve aliases first)
  for (const key of keys) {
    for (const loc of LOCALES) {
      const v = resolve(key, loc);
      if (typeof v === 'string' && BARE_CALENDAR_DATE.test(v)) {
        hardFailures.push(`[hardcoded-date] ${key}[${loc}] = "${v}" — a bare date placeholder rots; use a format hint`);
      }
    }
  }

  // 5. Duplicate values per locale (WARNING only). Aliases are resolved
  // first so an alias key never double-counts against its canonical.
  for (const loc of LOCALES) {
    const v2k = {};
    for (const key of keys) {
      if (dict[key]?.['@alias']) continue; // alias resolves to canonical — don't count twice
      const v = resolve(key, loc);
      if (typeof v !== 'string' || v.length < 3) continue;
      (v2k[v] ??= []).push(key);
    }
    const dupes = Object.entries(v2k).filter(([, ks]) => ks.length > 1);
    if (dupes.length) warnings.push(`[dupes] ${loc}: ${dupes.length} duplicate-value groups (intentional — distinct UI roles or per-locale divergence; see I18N-CL3)`);
  }

  // 6. Whitespace (WARNING only — some keys end with ": " by design)
  for (const key of keys) {
    if (dict[key]?.['@alias']) continue;
    for (const loc of LOCALES) {
      const v = dict[key]?.[loc];
      if (typeof v === 'string' && v !== v.trim() && !v.endsWith(': ') && !v.endsWith('— ')) {
        warnings.push(`[whitespace] ${key}[${loc}] = "${v}"`);
      }
    }
  }

  console.log(`\n=== i18n audit · ${keys.length} keys × ${LOCALES.length} locales ===`);
  console.log(`hard failures: ${hardFailures.length} · warnings: ${warnings.length}\n`);
  if (warnings.length) {
    console.log('WARNINGS (informational, non-blocking):');
    warnings.forEach((w) => console.log('  ' + w));
    console.log('');
  }
  if (hardFailures.length) {
    console.log('HARD FAILURES (block the ship):');
    hardFailures.forEach((f) => console.log('  ' + f));
    console.log('');
    process.exit(1);
  }
  console.log('✓ no hard failures — dictionary is clean');
  process.exit(0);
}

main();
