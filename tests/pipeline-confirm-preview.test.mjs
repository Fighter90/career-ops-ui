/**
 * v1.48.0 (WS2 UX-audit #8/#22) — pipeline.js: focus-trapped
 * UI.confirm() replaces native confirm() on all destructive/nav
 * actions; the preview is a polite live region and a fetch failure is
 * a distinct role=alert block, not disguised as preview body text.
 * Browser-only view → asserted statically (router.test.mjs style).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const PIPE = readFileSync(R('public', 'js', 'views', 'pipeline.js'), 'utf8');
const DICT = legacyDictText();

test('#8: no native confirm() left anywhere in pipeline.js', () => {
  // strip UI.confirm( first, then any remaining `confirm(` is native.
  const stripped = PIPE.replace(/UI\.confirm\(/g, '');
  assert.ok(!/(?:^|[^.\w])confirm\(/m.test(stripped),
    'pipeline.js still calls native confirm()');
});

test('#8: all three actions go through focus-trapped UI.confirm()', () => {
  const calls = PIPE.match(/await UI\.confirm\(/g) || [];
  assert.ok(calls.length >= 3, `expected ≥3 UI.confirm sites, found ${calls.length}`);
  // the two deletes are danger:true; evaluate-all is danger:false
  assert.ok((PIPE.match(/danger:\s*true/g) || []).length >= 2, 'both deletes danger:true');
  assert.match(PIPE, /danger:\s*false/);
  assert.match(PIPE, /t\('pipe\.confirmDelTitle'/);
  assert.match(PIPE, /t\('pipe\.evaluateAllTitle'/);
});

test('#22: previewPane is a labelled polite live region', () => {
  assert.match(PIPE, /id:\s*'pipe-preview'[\s\S]{0,120}role:\s*'region',\s*'aria-live':\s*'polite'/);
  assert.match(PIPE, /'aria-label':\s*t\('pipe\.previewRegion'/);
});

test('#22: fetch failure is a distinct role=alert block, not preview body', () => {
  assert.match(PIPE, /let previewError = ''/);
  // catch sets previewError, NOT previewBody-with-parens
  assert.match(PIPE, /catch \(e\) \{\s*previewError = e\.message \|\| 'fetch failed';/);
  assert.ok(!/previewBody = '\(' \+ \(e\.message/.test(PIPE),
    'old disguised-as-body error string must be gone');
  assert.match(PIPE, /if \(previewError\) \{[\s\S]{0,200}role:\s*'alert'/);
  // cleared on (re)select + on deleting the active row
  assert.match(PIPE, /previewBody = '';\s*\n\s*previewError = '';/);
  assert.match(PIPE, /previewBody = ''; previewError = ''; \}/);
});

test('i18n: 4 new pipe keys present with all 8 locales', () => {
  for (const k of ['pipe.confirmDelTitle', 'pipe.previewError', 'pipe.evaluateAllTitle', 'pipe.previewRegion']) {
    const line = DICT.split('\n').find((l) => l.includes(`'${k}'`));
    assert.ok(line, `missing i18n key ${k}`);
    for (const loc of ['en', 'es', "'pt-BR'", 'ko', 'ja', 'ru', "'zh-CN'", "'zh-TW'"]) {
      assert.ok(line.includes(loc + ':'), `${k} missing locale ${loc}`);
    }
  }
});
