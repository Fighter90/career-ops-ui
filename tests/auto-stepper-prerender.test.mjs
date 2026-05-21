/**
 * v1.55.1 — F-V55-E / UX-1 (senior obs S-4, reopened by the
 * 2026-05-18 audit): the `#/auto` 5-stage pipeline outline must be
 * visible on mount, BEFORE the user clicks Run — not only after the
 * first SSE event. Previously `<ol class="auto-stepper">` was
 * `display:none` and `renderStepper()` was only called from setStep()
 * / run(), so a cold-start user never saw the documented pipeline
 * (validate → fetch → evaluate → save report → add tracker).
 *
 * auto.js is browser-only → asserted statically (router.test.mjs
 * style); the 5-step contract is re-derived from the source so it
 * stays locked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const AUTO = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'auto.js'), 'utf8');
const DICT = legacyDictText();

test('STEPS defines exactly the 5 canonical pipeline stages', () => {
  const m = AUTO.match(/const STEPS = \[([\s\S]*?)\];/);
  assert.ok(m, 'STEPS array not found');
  const keys = [...m[1].matchAll(/key: '([^']+)'/g)].map((x) => x[1]);
  assert.deepEqual(keys,
    ['validate', 'fetch', 'evaluate', 'save_report', 'append_tracker'],
    'the 5 documented stages, in order');
});

test('stepperEl is visible on mount (no display:none) + labelled', () => {
  const block = AUTO.match(/const stepperEl = c\('ol', \{[\s\S]*?\}\);/);
  assert.ok(block, 'stepperEl creation not found');
  assert.ok(!/display:\s*'none'/.test(block[0]),
    'stepperEl must NOT be display:none on mount (F-V55-E)');
  assert.match(block[0], /'aria-label':\s*t\('auto\.stepperAria'/,
    'stepper must carry an aria-label via auto.stepperAria');
  assert.match(block[0], /className: 'auto-stepper'/);
});

test('renderStepper() is invoked on mount, not only from setStep/run', () => {
  // The on-mount call sits between renderStepper()'s definition and
  // setStep()'s definition (module/build scope), tagged F-V55-E.
  assert.match(AUTO,
    /\}\s*\n\s*\/\/ v1\.55\.1 — F-V55-E[\s\S]*?\n\s*renderStepper\(\);\s*\n\s*function setStep\(/,
    'a mount-scope renderStepper() call must precede function setStep()');
  // sanity: renderStepper still also drives live updates
  assert.ok((AUTO.match(/renderStepper\(\)/g) || []).length >= 3,
    'renderStepper used on mount + setStep + run reset');
});

test('auto.stepperAria present in all 8 locales', () => {
  const line = DICT.split('\n').find((l) => l.includes("'auto.stepperAria'"));
  assert.ok(line, 'i18n key auto.stepperAria missing');
  for (const loc of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW']) {
    const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
    assert.ok(line.includes(tok), `auto.stepperAria missing locale ${loc}`);
  }
});
