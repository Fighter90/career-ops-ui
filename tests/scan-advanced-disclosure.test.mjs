/**
 * v1.55.6 — UX-4 (cognitive load): #/scan stacked every filter
 * (free-text, remote/hybrid/onsite, scope, source, stack/level/
 * dynamic facet chips) at equal weight. Keep the everyday filters
 * — free-text + Remote/Hybrid/Onsite — and the 🌐 Scan button
 * visible by default; tuck the secondary ones (Scope, Source, and
 * the post-scan facet chips) behind an "Advanced filters"
 * <details> disclosure so the results view isn't a wall of controls.
 *
 * scan.js is browser-only → asserted statically (router.test.mjs /
 * dashboard-hero.test.mjs style); the i18n contract is re-derived
 * from i18n-dict.js so it stays locked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const SCAN = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'scan.js'), 'utf8');
const CSS = readFileSync(resolve(__d, '..', 'public', 'css', 'app.css'), 'utf8');
const DICT = legacyDictText();
const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW'];

test('an Advanced-filters <details> disclosure exists', () => {
  assert.match(SCAN, /c\('details'/, 'scan.js must build a <details> element');
  assert.match(SCAN, /c\('summary'/, '<details> needs a <summary>');
  assert.match(SCAN, /scan-advanced/, 'the disclosure carries the .scan-advanced hook');
  assert.match(SCAN, /t\('scan\.advancedFilters'/,
    'summary label via scan.advancedFilters');
});

test('everyday filters stay OUT of the disclosure (visible by default)', () => {
  // filterText (free-text) and filterRemote (remote/hybrid/onsite)
  // must still be placed directly in the results filter row, not
  // inside the <details>. We assert they appear in an array next to
  // each other (the always-visible group).
  assert.match(SCAN, /\[filterText, filterRemote\]|filterText,\s*filterRemote/,
    'free-text + remote stay in the always-visible filter group');
});

test('secondary filters (scope, source) live inside the disclosure', () => {
  // The details body must reference filterScope and filterSource.
  const det = SCAN.match(/c\('details',[\s\S]*?filterScope[\s\S]*?filterSource[\s\S]*?\)/) ||
              SCAN.match(/scan-advanced[\s\S]*?filterScope[\s\S]*?filterSource/);
  assert.ok(det, 'filterScope + filterSource must be inside the Advanced disclosure');
});

test('post-scan facet chips are wrapped in a disclosure too', () => {
  // chipsContainer (stack/level/dynamic) is a <details>, not a bare div.
  assert.match(SCAN,
    /chipsContainer = c\('details'/,
    'the facet chip cluster must be a collapsible <details>');
});

test('.scan-advanced has a styled summary', () => {
  assert.match(CSS, /\.scan-advanced\b/, '.scan-advanced CSS must exist');
  assert.match(CSS, /\.scan-advanced\s*(>\s*)?summary|\.scan-advanced summary/,
    '.scan-advanced summary must be styled');
});

test('scan.advancedFilters present in all 8 locales', () => {
  const line = DICT.split('\n').find((l) => l.includes("'scan.advancedFilters'"));
  assert.ok(line, 'i18n key scan.advancedFilters missing');
  for (const loc of LOCALES) {
    const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
    assert.ok(line.includes(tok), `scan.advancedFilters missing locale ${loc}`);
  }
});
