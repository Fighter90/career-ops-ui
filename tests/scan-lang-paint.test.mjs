/**
 * #534 review follow-up — synchronous language-switch repaint on #/scan.
 *
 * Finding 1 (major): the v1.24x language-switch fix hoisted the results
 * corpus (lastResults) to module level, but the RENDER TAIL of #/scan still
 * unconditionally painted the CAR-112 skeleton and fired a network
 * refreshResults(). A language switch (I18n.onChange → Router.render())
 * therefore sat on a loading skeleton — the OLD language's table was thrown
 * away and the cached module state was NOT repainted until the heavy
 * /api/scan-results round-trip landed. The review verdict: «синхронный paint
 * из module state в render tail НЕ реализован».
 *
 * Finding 3: resetResultsCache() (a new scan wiping the cache) never
 * re-armed resultsEverLoaded, so a LATE FAILED refresh after a partial
 * render skipped the CAR-93 error state and left a perpetual skeleton.
 *
 * Source-static is the honest level here (review finding 2: the browser
 * harness cannot discriminate a tight paint window from a fast refetch);
 * the behavioural proof is tests/playwright-lang-switch-scan.mjs with the
 * post-switch refetch held well past the assertion window.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = readFileSync(resolve(ROOT, 'public/js/views/scan.js'), 'utf8');

// Extract the body of a top-level `function name() { … }` by brace walk
// (the function bodies asserted here contain no braces in strings/comments).
function functionBody(src, marker) {
  const start = src.indexOf(marker);
  assert.ok(start > -1, `${marker} must exist in scan.js`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  return '';
}

test('#534 f1: the render tail paints the cached corpus SYNCHRONOUSLY (no skeleton over live state)', () => {
  const srIdx = SCAN.indexOf('const SR = window.ScanResults.create(');
  assert.ok(srIdx > -1, 'SR must exist');
  const tail = SCAN.slice(srIdx); // everything after the SR factory: the render tail
  const syncIdx = tail.indexOf('if (resultsEverLoaded) {');
  assert.ok(syncIdx > -1,
    'the render tail must guard the first-load skeleton on resultsEverLoaded — a cached corpus must paint synchronously');
  const syncBody = tail.slice(syncIdx, tail.indexOf('}', syncIdx));
  assert.match(syncBody, /SR\.render\(\);/,
    'the sync branch must repaint table + facets from module state via SR.render()');

  // The CAR-112 skeleton stays, but only as the guarded first-load fallback —
  // AFTER the sync branch, never painted over a loaded corpus.
  const skelIdx = tail.indexOf('resultsEl.replaceChildren(window.Skeleton.block(');
  assert.ok(skelIdx > -1, 'the CAR-112 skeleton fallback must remain (first visit has nothing to paint)');
  assert.ok(syncIdx < skelIdx,
    'the skeleton must be the guarded fallback AFTER the sync paint branch, not an unconditional paint');

  // Freshness contract: the background refresh still runs after the paint.
  const after = tail.slice(skelIdx);
  assert.match(after, /refreshResults\(\);/,
    'the background refreshResults() must still fire after the guarded paint');
});

test('#534 f3: resetResultsCache re-arms resultsEverLoaded (no perpetual skeleton after a late failure)', () => {
  const body = functionBody(SCAN, 'function resetResultsCache()');
  assert.match(body, /lastResults = \{ en: null, ru: null \};/, 'the reset clears the corpus');
  const armIdx = body.indexOf('resultsEverLoaded = false;');
  assert.ok(armIdx > -1,
    'resetResultsCache must re-arm resultsEverLoaded=false — a late FAILED refresh after a reset must reach the CAR-93 error state instead of leaving a perpetual skeleton');
  const renderIdx = body.indexOf('SR.render();');
  assert.ok(renderIdx > -1 && armIdx < renderIdx,
    'the re-arm must happen before the repaint');
});

test('#534: the rationale is documented at both fix sites', () => {
  assert.match(SCAN, /#534 review f1/, 'render-tail rationale comment');
  assert.match(SCAN, /#534 review f3/, 'reset-path rationale comment');
});
