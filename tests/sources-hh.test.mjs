/**
 * hh.ru source — v1.242.0 Phase-2 entity decoding. CI-isolated: pure parser
 * tests against fixture HTML, no network. The fetch-path behavior (geo-block,
 * pagination, ads) lives in tests/ru-scanner.test.mjs; this file pins the
 * decode upgrade (shared decodeEntities instead of the old 8-form local map)
 * and the no-angle-bracket invariant that must survive it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHhCards } from '../server/lib/sources/hh.mjs';

const card = (title, company = 'Acme') =>
  '<div data-qa="vacancy-serp__vacancy">'
  + `<a data-qa="serp-item__title" href="https://hh.ru/vacancy/100">${title}</a>`
  + `<a data-qa="vacancy-serp__vacancy-employer-text">${company}</a>`
  + '</div>';

test('parseHhCards decodes named + numeric entities in title and company (shared decoder)', () => {
  const [j] = parseHhCards(
    card('D&eacute;veloppeur S&eacute;nior &#8212; Java', 'Soci&eacute;t&eacute; G&eacute;n&eacute;rale'),
  );
  assert.equal(j.title, 'Développeur Sénior — Java');
  assert.equal(j.company, 'Société Générale');
});

test('parseHhCards: the entities the old local map knew are still decoded', () => {
  const [j] = parseHhCards(card('&laquo;Тест&raquo; &mdash; инженер &amp; QA'));
  assert.equal(j.title, '«Тест» — инженер & QA');
});

test('parseHhCards: entity decoding cannot resurrect markup (no angle brackets out)', () => {
  const j = parseHhCards(card('Dev &lt;script&gt;x&lt;/script&gt; <b>Y</b>', 'A&amp;B &lt;b&gt;'))[0];
  assert.doesNotMatch(j.title, /[<>]/);
  assert.doesNotMatch(j.company, /[<>]/);
});

test('parseHhCards: decodes exactly once (no double-unescape)', () => {
  const [j] = parseHhCards(card('T', 'A&amp;lt;B'));
  assert.equal(j.company, 'A&lt;B', 'a double-encoded entity must survive as its single-decoded form');
});

// CAR-105 — pinned against the LIVE hh.ru card markup (2026-10-25): the
// address span survived the magritte redesign and the parser still reads a
// plain city out of it, so hh rows geocode on #/map. This locks the shape —
// hh.ru losing the span again would resurface as a map full of RU no-location
// rows, exactly the CAR-105 symptom.
test('parseHhCards: the magritte address span yields the city (live markup shape)', () => {
  const html = '<div data-qa="vacancy-serp__vacancy">'
    + '<a data-qa="serp-item__title" href="https://hh.ru/vacancy/100">Dev</a>'
    + '<address class="address--sQo6S3UaqQUt843N">'
    + '<div class="magritte-v-spacing___R3QYf_2-1-32_xhh"></div>'
    + '<span data-qa="vacancy-serp__vacancy-address" class="magritte-text___pbpft_5-3-17_xhh">Новосибирск, р-н Центральный</span>'
    + '</address>'
    + '<span class="metro-station"><span class="metro-point metro-point_redesign" style="color:#CD0505"></span>'
    + '<span data-qa="address-metro-station-name">Гагаринская</span></span>'
    + '</div>';
  const [j] = parseHhCards(html);
  assert.equal(j.location, 'Новосибирск, р-н Центральный');
});
