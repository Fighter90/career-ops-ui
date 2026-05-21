/**
 * v1.51.0 (WS2 UX-audit #13/#14/#18/#19/#20) — feedback/i18n sweep:
 * auto run-button busy state, actionable HTTP-fail message, async
 * Clipboard with real failure handling, evaluate result as a status
 * live region, evaluate button spinner-wrapped against double-submit.
 * Browser-only views → static assertions (router.test.mjs style).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const AUTO = readFileSync(R('public', 'js', 'views', 'auto.js'), 'utf8');
const EVAL = readFileSync(R('public', 'js', 'views', 'evaluate.js'), 'utf8');
const DICT = legacyDictText();

test('#13 auto: run button shows a busy state, restored in finally', () => {
  assert.match(AUTO, /runBtn\.classList\.add\('is-loading'\)/);
  assert.match(AUTO, /runBtn\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(AUTO, /runBtn\.textContent = '⏳ ' \+ t\('auto\.running'/);
  assert.match(AUTO, /runBtn\.classList\.remove\('is-loading'\)/);
  assert.match(AUTO, /runBtn\.removeAttribute\('aria-busy'\)/);
});

test('#14 auto: HTTP failure is actionable + toasted (not a bare code)', () => {
  assert.match(AUTO, /t\('auto\.httpFail'[\s\S]{0,90}\.replace\('\{n\}', String\(resp\.status\)\)/);
  assert.match(AUTO, /setStep\(0, 'failed', msg\);\s*\n\s*UI\.toast\(msg, 'error'\)/);
  assert.ok(!/setStep\(0, 'failed', 'HTTP ' \+ resp\.status\)/.test(AUTO),
    'old bare "HTTP <code>" detail must be gone');
});

test('#18 auto: async Clipboard with fallback + genuine-failure toast', () => {
  assert.match(AUTO, /navigator\.clipboard[\s\S]{0,60}writeText\(ta\.value\)/);
  assert.match(AUTO, /t\('auto\.copyFail'/);
  // a false "Copied" on a silent execCommand no-op must not happen
  assert.match(AUTO, /legacy \? t\('auto\.copied'[\s\S]{0,80}: t\('auto\.copyFail'/);
});

test('#19 evaluate: result container is a polite status live region', () => {
  assert.match(EVAL, /id:\s*'eval-out',\s*role:\s*'status',\s*'aria-live':\s*'polite'/);
});

test('#20 evaluate: Evaluate button is spinner-wrapped (no double-submit)', () => {
  assert.match(EVAL, /onClick:\s*\(e\)\s*=>\s*UI\.withSpinner\(e\.currentTarget,\s*run\)/);
  assert.ok(!/c\('button', \{ className: 'btn btn-primary', onClick: run \}/.test(EVAL),
    'old plain onClick: run must be gone');
});

test('i18n: 3 new auto keys present with all 8 locales (+{n} preserved)', () => {
  for (const k of ['auto.running', 'auto.httpFail', 'auto.copyFail']) {
    const line = DICT.split('\n').find((l) => l.includes(`'${k}'`));
    assert.ok(line, `missing i18n key ${k}`);
    for (const loc of ['en', 'es', "'pt-BR'", 'ko', 'ja', 'ru', "'zh-CN'", "'zh-TW'"]) {
      assert.ok(line.includes(loc + ':'), `${k} missing locale ${loc}`);
    }
  }
  const httpLine = DICT.split('\n').find((l) => l.includes("'auto.httpFail'"));
  assert.ok((httpLine.match(/\{n\}/g) || []).length >= 8, 'auto.httpFail must keep {n} in every locale');
});
