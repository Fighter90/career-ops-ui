/**
 * Language-switch survival (CAR-126 follow-up, owner-reported): the topbar
 * language switcher fires I18n.onChange → Router.render(), which re-creates
 * the whole view. Scan state that used to live INSIDE render() (loaded
 * results, refresh sequence, filter-chip selections) was thrown away on every
 * switch, blanking #/scan for the duration of the heavy /api/scan-results
 * round-trip. Source-static gate: the state must be declared at MODULE level
 * — before the view's DOM construction begins — and never shadowed inside
 * the render function.
 *
 * (Source-static is the honest level here: the behavioral proof is the
 * Playwright language-switch probe — after the fix, a scan page switched
 * en→ru keeps its word count within noise of a direct ru load.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(ROOT, 'public/js/views/scan.js'), 'utf8');

test('scan state lives at module level, above the view DOM construction', () => {
  const stateIdx = src.indexOf('let lastResults = { en: null, ru: null };');
  const domIdx = src.indexOf("const resultsEl = c('div'");
  assert.ok(stateIdx !== -1, 'let lastResults declaration must exist');
  assert.ok(domIdx !== -1, 'resultsEl construction must exist');
  assert.ok(stateIdx < domIdx,
    `lastResults (idx ${stateIdx}) must be declared at module level, before the view DOM construction (idx ${domIdx}) — a render()-local declaration is thrown away on every language switch`);
});

test('scan state is declared exactly once (no render()-local shadowing)', () => {
  for (const needle of [
    'let lastResults',
    'let refreshSeq',
    'let resultsEverLoaded',
    'const activeTech',
    'const activeLevel',
    'const activeDynamic',
  ]) {
    const count = src.split(needle).length - 1;
    assert.equal(count, 1, `${needle} must be declared exactly once (found ${count})`);
  }
});

test('the language-switch rationale is documented at the declaration site', () => {
  assert.ok(src.includes('Language-switch survival'),
    'the module-level state block must carry the rationale comment');
});
