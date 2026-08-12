/**
 * #/stats rebuildable "Build a chart" widget (v1.145.0).
 *
 * The chart is exercised for real by Playwright (metric × dimension re-render on
 * the Target-role trend tab). These node:test canaries lock the wiring + i18n so
 * a refactor can't silently drop it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

test('stats.js wires a rebuildable metric × dimension chart', () => {
  const src = read('public/js/views/stats.js');
  assert.match(src, /function customChart\(/, 'has a customChart() builder');
  // metric + dimension selects with their options
  assert.match(src, /metricSel[\s\S]*'vacancies'[\s\S]*'median'[\s\S]*'avg'/, 'metric select offers vacancies/median/avg');
  assert.match(src, /dimSel[\s\S]*'country'[\s\S]*'role'/, 'dimension select offers country/role');
  // both re-render on change, and the chart is drawn first in draw()
  assert.match(src, /metricSel\.addEventListener\('change'/, 'metric change re-renders');
  assert.match(src, /dimSel\.addEventListener\('change'/, 'dimension change re-renders');
  assert.match(src, /charts\.appendChild\(customChart\(\)\)/, 'draw() renders the custom chart');
  // salary metrics honor the currency + period, vacancies do not
  assert.match(src, /const isSalary = metricState !== 'vacancies'/, 'salary vs count branch');
  assert.match(src, /barChart\(items, isSalary \? money : undefined\)/, 'currency-format only for salary metrics');
});

test('the 8 rebuildable-chart i18n keys are present in the EN dictionary', () => {
  const en = read('public/js/lib/locales/i18n-dict.en.js');
  for (const k of ['stats.customChart', 'stats.metric', 'stats.dimension', 'stats.metricVacancies', 'stats.metricMedian', 'stats.metricAvg', 'stats.dimCountry', 'stats.dimRole']) {
    assert.match(en, new RegExp(`'${k.replace(/\./g, '\\.')}':\\s*"`), `EN dict missing ${k}`);
  }
});
