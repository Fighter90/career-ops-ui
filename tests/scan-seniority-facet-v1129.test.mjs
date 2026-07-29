/**
 * v1.129.0 — the #/scan seniority facet (filter + column) and freshness column,
 * powered by public/js/lib/job-facets.js. Client-view source-pattern checks
 * (the view touches `window`/DOM), matching scan-pipeline-ui-v1109.test.mjs;
 * the facet LOGIC itself is covered by tests/job-facets.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { I18N_LANGS, localeSource } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');

test('scan.js wires a seniority filter via JobFacets into filtering + state', () => {
  const src = read('public', 'js', 'views', 'scan.js');
  // dropdown + auto-populate from results (like the country facet)
  assert.match(src, /const filterSeniority = /);
  assert.match(src, /function paintSeniorityOptions/);
  assert.match(src, /paintSeniorityOptions\(allRows\);/);
  // derives the bucket from job-facets (null bucket always passes)
  assert.match(src, /window\.JobFacets\.seniorityFromTitle/);
  assert.match(src, /if \(fsen && senOf\(r\) !== fsen\) return false;/);
  // round-trips through saved-search state + reset + the change listener
  assert.match(src, /seniority: filterSeniority\.value/);
  assert.match(src, /filterSeniority\.value = s\.seniority/);
  assert.match(src, /filterSeniority\.value = '';/);
  assert.match(src, /filterCountry, filterSeniority, filterScope/);
});

test('scan.js renders a seniority badge column + a freshness (daysSince) column', () => {
  const src = read('public', 'js', 'views', 'scan.js');
  assert.match(src, /const senCell = /);
  assert.match(src, /senLabel\(sen\)/);
  assert.match(src, /window\.JobFacets\.daysSince\(r\.date\)/);
  assert.match(src, /t\('scan\.freshToday', 'today'\)/);
  assert.match(src, /days \+ t\('scan\.dSuffix', 'd'\)/);
  // both new headers present in the table head
  assert.match(src, /t\('scan\.col\.seniority', 'Seniority'\)/);
  assert.match(src, /t\('scan\.col\.age', 'Age'\)/);
});

test('the 12 new scan facet keys exist in all 17 locale dicts', () => {
  const KEYS = [
    'scan.allSeniority', 'scan.lblSeniority', 'scan.col.seniority', 'scan.col.age',
    'scan.freshToday', 'scan.dSuffix',
    'scan.sen.lead', 'scan.sen.staff', 'scan.sen.senior', 'scan.sen.mid', 'scan.sen.junior', 'scan.sen.intern',
  ];
  for (const lang of I18N_LANGS) {
    const src = localeSource(lang);
    for (const k of KEYS) {
      assert.ok(src.includes(`'${k}':`), `${lang} missing i18n key ${k}`);
    }
  }
});
