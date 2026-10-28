/**
 * CAR-137 — specific error texts for five flows.
 *
 * Five sites kept a GENERIC error fallback ('Error' / 'failed') where a
 * specific, actionable message belongs. Three guards:
 *   (1) each usage site calls t() with its err.* key — no generic fallback;
 *   (2) every one of the 19 per-locale tables declares all five keys with a
 *       non-empty value (raw-source check, so an @alias cannot satisfy it);
 *   (3) the EN values are pinned verbatim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict, localeSource, I18N_LANGS } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CASES = [
  {
    key: 'err.evaluate.failed',
    file: 'public/js/views/evaluate.js',
    en: 'Evaluation failed — check a provider key on #/config, or run again.',
  },
  {
    key: 'err.auto.noTerminal',
    file: 'public/js/lib/auto-pipeline.js',
    en: 'The pipeline stream ended without a result — the server may have restarted mid-run. Run the URL again.',
  },
  {
    key: 'err.scan.pipelineAdd',
    file: 'public/js/views/scan/runner.js',
    en: 'Could not add this posting to the pipeline — try again in a moment.',
  },
  {
    key: 'err.scan.repostsLoad',
    file: 'public/js/views/scan/runner.js',
    en: 'Could not load repost clusters — reopen this panel to retry.',
  },
  {
    key: 'err.pipeline.undo',
    file: 'public/js/views/pipeline.js',
    en: 'Could not complete the undo — the entry was left unchanged.',
  },
];

test('CAR-137: each of the five files calls t() with its err.* key', () => {
  for (const { key, file } of CASES) {
    const src = readFileSync(resolve(ROOT, file), 'utf8');
    assert.ok(
      src.includes(`t('${key}'`),
      `${file} must use the specific key ${key} instead of a generic error fallback`,
    );
  }
});

test('CAR-137: all 19 locale tables declare all five err.* keys non-empty', () => {
  const DICT = loadAssembledDict();
  for (const lang of I18N_LANGS) {
    const table = localeSource(lang);
    for (const { key } of CASES) {
      assert.ok(
        table.includes(`'${key}':`),
        `i18n-dict.${lang}.js must declare '${key}'`,
      );
      assert.ok(
        typeof DICT[key]?.[lang] === 'string' && DICT[key][lang].trim() !== '',
        `'${key}' must have a non-empty ${lang} value`,
      );
    }
  }
});

test('CAR-137: EN values are exact', () => {
  const DICT = loadAssembledDict();
  for (const { key, en } of CASES) {
    assert.equal(DICT[key]?.en, en, `'${key}' EN fallback drifted`);
  }
});
