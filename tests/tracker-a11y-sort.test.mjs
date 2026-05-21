/**
 * v1.49.0 (WS2 UX-audit #10/#11/#25/#26) — tracker: labelled action
 * column + per-row Report aria-label, sortable table (scope + aria-sort
 * + keyboard button), localized destructive labels, first-run empty
 * state distinct from "no filter match". Browser-only view → static
 * assertions (router.test.mjs style).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const TRK = readFileSync(R('public', 'js', 'views', 'tracker.js'), 'utf8');
const DICT = legacyDictText();

test('#10: every th has scope=col; action + score + pdf headers are i18n', () => {
  assert.match(TRK, /c\('th',\s*\{ scope: 'col' \},\s*'#'\)/);
  assert.match(TRK, /t\('track\.col\.actions'/);
  assert.match(TRK, /t\('track\.col\.score'/);
  assert.match(TRK, /t\('track\.col\.pdf'/);
  // no empty-string header left
  assert.ok(!/\.map\(\(h\) => c\('th', null, h\)\)/.test(TRK), 'old null-th map must be gone');
});

test('#10: per-row Report button has an aria-label with the company (no trailing dash)', () => {
  assert.match(TRK, /'aria-label':\s*t\('track\.report'\)\s*\+\s*\(\(r\.company \|\| r\.role\) \? ' — ' \+ \(r\.company \|\| r\.role\) : ''\)/);
});

test('#11: aria-sort reset only touches sortable headers (WAI-ARIA)', () => {
  // Must NOT blanket-reset every th — only those that already carry
  // aria-sort (the 3 sortable ones), else 6 plain columns get a
  // misleading aria-sort="none".
  assert.match(TRK, /if \(h\.hasAttribute\('aria-sort'\)\) h\.setAttribute\('aria-sort', 'none'\)/);
  assert.ok(!/for \(const h of th\.parentElement\.children\) h\.setAttribute\('aria-sort', 'none'\);/.test(TRK),
    'old blanket aria-sort reset must be gone');
});

test('#11: sort direction indicator reflects state (▲/▼), aria-hidden', () => {
  assert.match(TRK, /'aria-hidden':\s*'true'[\s\S]{0,40}'⇅'/);
  assert.match(TRK, /ind\.textContent = sortDir === 'asc' \? '▲' : '▼'/);
});

test('#11: sortable headers — button-in-th, aria-sort, dir toggle', () => {
  assert.match(TRK, /function sortableTh\(label, key\)/);
  assert.match(TRK, /'aria-sort':\s*'none'/);
  assert.match(TRK, /th\.setAttribute\('aria-sort',\s*sortDir === 'asc' \? 'ascending' : 'descending'\)/);
  assert.match(TRK, /sortableTh\(t\('track\.col\.date'\),\s*'date'\)/);
  assert.match(TRK, /sortableTh\(t\('track\.col\.score',\s*'Score'\),\s*'score'\)/);
  assert.match(TRK, /sortableTh\(t\('track\.col\.status'\),\s*'status'\)/);
  assert.match(TRK, /function sorted\(arr\)/);
  assert.match(TRK, /const all = sorted\(filtered\(\)\)/);
});

test('#25: destructive buttons have a title hint; labels localized', () => {
  // v1.58.30 (U-10) — the destructive title now branches on `empty`:
  // when populated, the tooltip is t('track.fixHint'); when empty, it
  // becomes t('track.fixEmpty'). Both must be present in tracker.js.
  assert.match(TRK, /t\('track\.fixHint'/);
  assert.match(TRK, /t\('track\.fixEmpty'/);
  for (const k of ['track.normalize', 'track.dedup', 'track.merge']) {
    const line = DICT.split('\n').find((l) => l.includes(`'${k}'`));
    assert.ok(line, `${k} missing`);
    // must NOT be identical English across locales anymore
    const ru = (line.match(/ru:\s*'([^']*)'/) || [])[1];
    const en = (line.match(/en:\s*'([^']*)'/) || [])[1];
    assert.ok(ru && ru !== en, `${k} ru still identical to en ("${en}") — #25 unfixed`);
  }
});

test('#26: first-run empty state is distinct from no-filter-match', () => {
  assert.match(TRK, /rows\.length === 0/);
  assert.match(TRK, /t\('track\.emptyTitle'/);
  assert.match(TRK, /t\('track\.emptyBody'/);
  assert.match(TRK, /href:\s*'#\/pipeline'[\s\S]{0,80}t\('track\.emptyCta'/);
  // the noMatch path still exists for the filtered-to-zero case
  assert.match(TRK, /t\('track\.noMatch'\)/);
});

test('i18n: 7 new track keys present with all 8 locales', () => {
  for (const k of [
    'track.col.score', 'track.col.pdf', 'track.col.actions', 'track.fixHint',
    'track.emptyTitle', 'track.emptyBody', 'track.emptyCta',
  ]) {
    const line = DICT.split('\n').find((l) => l.includes(`'${k}'`));
    assert.ok(line, `missing i18n key ${k}`);
    for (const loc of ['en', 'es', "'pt-BR'", 'ko', 'ja', 'ru', "'zh-CN'", "'zh-TW'"]) {
      assert.ok(line.includes(loc + ':'), `${k} missing locale ${loc}`);
    }
  }
});
