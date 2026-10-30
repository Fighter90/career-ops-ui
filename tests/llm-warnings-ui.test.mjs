/**
 * LLM warnings surface — BACKLOG views-2 / v1.243.0 hand-off.
 *
 * Since v1.239.4 every live-generation route names its problems on the
 * response (`warnings: string[]` — a cut-off answer named as such via
 * evaluationWarnings()/modeWarnings()/cutOff(), plus validation, looping
 * and language notices; the auto-pipeline SSE `done` frame carries the
 * same array). The views dropped them, so a truncated artifact rendered
 * as if it were whole.
 *
 * Source-static pins (ux-owner-batch pattern):
 *   1. each of the six live-generation views reads the server warnings
 *      array and renders a band that leads with the shared
 *      `llm.truncatedNotice` notice;
 *   2. the key exists in all 19 per-locale dictionaries.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

const KEY = 'llm.truncatedNotice';

test('llm-warnings: every live-generation view renders a warnings band', () => {
  const views = {
    // evaluate already listed the strings (CAR-21) — the band must lead
    // with the localized notice now.
    'views/evaluate.js': /\br\.warnings\b/,
    // deep: runLive result card (threaded through showResult opts).
    'views/deep.js': /\br\.warnings\b|opts\.warnings/,
    // auto: the SSE done frame of the #/auto page.
    'views/auto.js': /\bdata\.warnings\b/,
    // career-plan generate preview.
    'views/career-plan.js': /\bres\.warnings\b/,
    // stats market tab.
    'views/stats.js': /\bres\.warnings\b/,
    // cv-studio humanize + tailor result panels.
    'views/cv-studio.js': /\bres\.warnings\b/,
  };
  for (const [file, warningsRe] of Object.entries(views)) {
    const src = read('public', 'js', file);
    assert.ok(warningsRe.test(src), `${file} must read the server's warnings array`);
    assert.ok(src.includes(`'${KEY}'`), `${file} must lead its warnings band with ${KEY}`);
  }
});

test('llm-warnings: truncatedNotice exists in all 19 locales with the EN fallback intact', () => {
  const dict = JSON.parse(JSON.stringify(loadAssembledDict()));
  const row = dict[KEY];
  assert.ok(row && !row['@alias'], `${KEY} must exist in the assembled dict (not an alias)`);
  assert.equal(
    row.en,
    'Model output may be truncated — re-run if the report looks cut off',
    'EN value must match the shared fallback used by every view',
  );
  for (const lang of I18N_LANGS) {
    assert.ok(typeof row[lang] === 'string' && row[lang].length > 0,
      `${KEY} must be translated in i18n-dict.${lang}.js`);
  }
});
