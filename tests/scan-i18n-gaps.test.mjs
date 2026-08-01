/**
 * #29 / v1.69.4 — close the i18n gaps in the Scan view. The source-summary
 * pills ("N new / M matching"), the "N new offers" toasts, and the "reloc"
 * badge were hardcoded English; they now flow through `t()`. Asserted against
 * source (the strings are built inside a browser-only view) + the assembled
 * dict, the same approach as qa-report-fixes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';
import { loadScanSrc } from './helpers/scan-src.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scan = loadScanSrc();

test('scan.js routes the summary/badge strings through t()', () => {
  for (const key of ['scan.pillNew', 'scan.pillMatching', 'scan.newOffers', 'scan.relocBadge']) {
    assert.ok(scan.includes(`t('${key}'`), `scan.js must call t('${key}', …)`);
  }
});

test('scan.js no longer hardcodes the English summary/badge strings', () => {
  // the old pill template literal "0} new / … matching" is gone
  assert.doesNotMatch(scan, /\|\| 0\} new \//, 'hardcoded "N new /" pill must be gone');
  // the old badge-info reloc literal is gone
  assert.doesNotMatch(scan, /badge-info'\s*\},\s*'reloc'\)/, "hardcoded 'reloc' badge must be gone");
  // the raw "${…} new offers`" (no t()) is gone
  assert.doesNotMatch(scan, /\$\{fresh\} new offers/, 'hardcoded "N new offers" toast must be gone');
});

test('the 4 new scan keys exist in every locale', () => {
  const dict = loadAssembledDict();
  for (const key of ['scan.pillNew', 'scan.pillMatching', 'scan.newOffers', 'scan.relocBadge']) {
    const row = dict[key];
    assert.ok(row, `dict missing ${key}`);
    for (const loc of ['en', 'ru', 'ja', 'ar', 'de', 'it', 'tr']) {
      assert.ok(row[loc] && String(row[loc]).trim(), `${key} missing locale ${loc}`);
    }
  }
});
