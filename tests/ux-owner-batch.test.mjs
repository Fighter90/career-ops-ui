/**
 * Owner UX batch — regression pins for the 2026-10-30 owner-reported fixes.
 *
 * 1. The #/scan pagebar "Compact" density toggle is REMOVED (owner decision):
 *    the density model itself stays (scan-results ROW_H / getDensity plumbing
 *    is driven directly by car115-scan-v2) — only the button, its localStorage
 *    read-back and its three i18n keys go.
 * 2. The dashboard hero stacks vertically (column flex, gap) so the greeting
 *    no longer sits on one line with the action buttons.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScanSrc } from './helpers/scan-src.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('ux-owner: #/scan pagebar has no Compact density toggle (owner decision)', () => {
  const src = loadScanSrc();
  assert.ok(!src.includes('v2-scan-density'), 'density button class must be gone from the scan view');
  assert.ok(!src.includes('scan:density'), 'density localStorage read-back must be gone');
  assert.ok(!src.includes('scan.v2.density'), 'density i18n key reference must be gone');
  // The density MODEL stays: scan-results still resolves the row height.
  assert.ok(src.includes('getDensity'), 'density plumbing (getDensity) must survive for car115');
});

test('ux-owner: density i18n keys removed from every locale', () => {
  const locales = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
  for (const loc of locales) {
    const src = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'locales', `i18n-dict.${loc}.js`), 'utf8');
    for (const key of ["'scan.v2.compact'", "'scan.v2.comfortable'", "'scan.v2.density'"]) {
      assert.ok(!src.includes(key), `${key} must be gone from i18n-dict.${loc}.js`);
    }
  }
});

test('ux-owner: dashboard hero stacks vertically (column flex + gap)', () => {
  const src = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'dashboard.js'), 'utf8');
  const m = src.match(/v2-dash-hero-inner[\s\S]{0,600}?style:\s*\{([^}]*)\}/);
  assert.ok(m, 'v2-dash-hero-inner style block found');
  const style = m[1];
  assert.ok(style.includes("flexDirection: 'column'"), 'hero inner must be a column flex container');
  assert.ok(style.includes('gap:'), 'hero inner must space children via gap');
  assert.ok(style.includes("alignItems: 'flex-start'"), 'hero children align to the start edge');
});
