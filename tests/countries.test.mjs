/**
 * countries.js — geography helper for the #/scan country filter (v1.78.0).
 *
 * Loads the browser classic script in a synthetic window (same pattern as the
 * skills/i18n tests) and exercises detectCountry / countriesIn / rowInCountry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
// eslint-disable-next-line no-new-func
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/countries.js'), 'utf8'))(w);
const C = w.Countries;

test('Countries API surface + every country has code/name/flag', () => {
  assert.ok(C && typeof C.detectCountry === 'function');
  assert.ok(Array.isArray(C.COUNTRIES) && C.COUNTRIES.length >= 40);
  for (const c of C.COUNTRIES) {
    assert.ok(/^[a-z]{2}$/.test(c.code), `bad code ${c.code}`);
    assert.ok(c.name && c.name.length, `${c.code} needs a name`);
    assert.ok(c.flag && /\p{Regional_Indicator}/u.test(c.flag), `${c.code} needs a flag`);
  }
});

test('detectCountry: explicit country names + aliases', () => {
  assert.equal(C.detectCountry('Berlin, Germany').code, 'de');
  assert.equal(C.detectCountry('Remote (Deutschland)').code, 'de');
  assert.equal(C.detectCountry('New York, NY, USA').code, 'us');
  assert.equal(C.detectCountry('London, United Kingdom').code, 'gb');
  assert.equal(C.detectCountry('Москва, Россия').code, 'ru');
});

test('detectCountry: city → country fallback', () => {
  assert.equal(C.detectCountry('London').code, 'gb');
  assert.equal(C.detectCountry('San Francisco, CA').code, 'us');
  assert.equal(C.detectCountry('Amsterdam').code, 'nl');
  assert.equal(C.detectCountry('Toronto').code, 'ca');
  assert.equal(C.detectCountry('Tokyo').code, 'jp');
});

test('detectCountry: conservative — no false positives, remote → null', () => {
  assert.equal(C.detectCountry('Remote'), null);
  assert.equal(C.detectCountry('Anywhere'), null);
  assert.equal(C.detectCountry(''), null);
  assert.equal(C.detectCountry(null), null);
  // word-boundary: "us" must not match inside "Belarus"/"Austin-the-word"
  assert.equal(C.detectCountry('Minsk, Belarus'), null); // Belarus not in list, "us" must not match
  // "uk" must not match inside an unrelated token
  assert.equal(C.detectCountry('Paducah'), null);
});

test('countriesIn: distinct, counted, sorted by name', () => {
  const rows = [
    { location: 'Berlin, Germany' },
    { location: 'Munich' },           // de
    { location: 'London' },           // gb
    { location: 'Remote' },           // none
    { location: 'Paris, France' },    // fr
  ];
  const list = C.countriesIn(rows);
  const names = list.map((c) => c.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  const de = list.find((c) => c.code === 'de');
  assert.equal(de.count, 2);
  assert.ok(list.find((c) => c.code === 'gb'));
  assert.ok(list.find((c) => c.code === 'fr'));
  assert.equal(list.find((c) => c.code === undefined), undefined);
});

test('rowInCountry: empty code passes all; code matches detected country', () => {
  assert.equal(C.rowInCountry({ location: 'Berlin, Germany' }, ''), true);
  assert.equal(C.rowInCountry({ location: 'Berlin, Germany' }, 'de'), true);
  assert.equal(C.rowInCountry({ location: 'Berlin, Germany' }, 'fr'), false);
  assert.equal(C.rowInCountry({ location: 'Remote' }, 'de'), false);
});

test('Danish (da) i18n keys exist for the country filter', () => {
  const da = {};
  // eslint-disable-next-line no-new-func
  new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/locales/i18n-dict.da.js'), 'utf8'))(da);
  assert.ok(da.__I18N_DICT_DA['scan.lblCountry']);
  assert.ok(da.__I18N_DICT_DA['scan.allCountries']);
});
