/**
 * Titles must be entity-decoded before they reach the scanner's title filter.
 *
 * Not cosmetic: the scanner lowercases and substring-matches titles, so an
 * undecoded "R&amp;D Engineer" fails a user's own positive keyword "r&d" and the
 * posting is silently dropped — it never reaches the pipeline and the user never
 * learns it existed. A negative keyword fails the opposite way (the veto never
 * fires). Zero-token scanning makes this invisible; nothing downstream notices a
 * mangled title. Numeric entities matter as much as &amp;: beesite/tkms point at
 * DACH boards where "Syst&#232;mes" and "&#8211;" are routine.
 *
 * Covers the six sources that gained the shared decoder: beesite, csod, tkms,
 * phenom (title + location), hackernews (whose 7-form local map missed every
 * other numeric/named entity), and habr (title + company — the SSR cards arrive
 * escaped, e.g. "Changellenge &gt;&gt;" / "ООО &quot;М-ТЕХ&quot;", and the raw
 * entities were reaching both the title filter AND the tracker/reports).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSearchResult } from '../server/lib/sources/beesite.mjs';
import { parseRequisitions } from '../server/lib/sources/csod.mjs';
import { parseQuery } from '../server/lib/sources/tkms.mjs';
import { parseRefineSearch, jobLocation } from '../server/lib/sources/phenom.mjs';
import { extractPost } from '../server/lib/sources/hackernews.mjs';
import { parseHabrCards } from '../server/lib/sources/habr.mjs';

test('beesite: decodes &amp; in the title', () => {
  const json = { SearchResult: { SearchResultCount: 1, SearchResultCountAll: 1, SearchResultItems: [{
    MatchedObjectId: '1',
    MatchedObjectDescriptor: {
      PositionID: 'x1', PositionTitle: 'R&amp;D Engineer',
      PositionURI: 'https://jobs.example.com/a-1',
      PositionLocation: [{ CityName: 'Bremen' }], PublicationStartDate: '2026-07-04',
    },
  }] } };
  const { jobs } = parseSearchResult(json, 'X');
  assert.equal(jobs[0].title, 'R&D Engineer');
});

test('csod: decodes &amp; in the title', () => {
  const json = { data: { totalCount: 1, requisitions: [
    { requisitionId: 8410, postingEffectiveDate: '7/3/2026', displayJobTitle: 'R&amp;D Engineer', locations: [{ city: 'Bremen', country: 'DE' }] },
  ] } };
  const { jobs } = parseRequisitions(json, { origin: 'https://career-ohb.csod.com', siteId: 4, corpName: 'career-ohb' }, 'OHB');
  assert.equal(jobs[0].title, 'R&D Engineer');
});

test('tkms: decodes &amp; in the title', () => {
  const json = { totalHits: 1, nextPage: null, jobs: [
    { data: { id: '964694', title: 'R&amp;D Engineer', city: 'Kiel', country: 'Germany' } },
  ] };
  const { rows } = parseQuery(json, { origin: 'https://jobs.tkmsgroup.com', locale: 'en' });
  assert.equal(rows[0].title, 'R&D Engineer');
});

test('phenom: decodes &amp; in the title and a numeric entity in the location', () => {
  const json = { refineSearch: { status: 200, totalHits: 1, data: { jobs: [
    { jobId: '98098', title: 'R&amp;D Engineer', location: 'M&#252;nchen', postedDate: '2026-05-07T18:25:30.000+0000' },
  ] } } };
  const { jobs } = parseRefineSearch(json, { origin: 'https://careers.exampleco.com', urlPrefix: 'global/en' }, 'ExampleCo');
  assert.equal(jobs[0].title, 'R&D Engineer');
  assert.equal(jobLocation({ location: 'M&#252;nchen' }), 'München');
});

test('hackernews: decodes numeric entities its old 7-form map missed', () => {
  const out = extractPost({
    text: '<p>Acme GmbH | Softwareentwickler &#8211; R&amp;D | https://acme.example/jobs</p>',
  });
  assert.ok(out, 'expected a parsed post');
  assert.ok(out.title.includes('–'), `en-dash should decode: ${JSON.stringify(out.title)}`);
  assert.ok(out.title.includes('R&D'), `&amp; should decode: ${JSON.stringify(out.title)}`);
});

test('habr: decodes entities in BOTH the title and the company name', () => {
  // A single vacancy-card block shaped exactly like the SSR search HTML the
  // regex parser walks — with an escaped ampersand in the title and escaped
  // quotes in the company, the two fields that arrived raw in a live 1.210.0 scan.
  const html =
    '<section>' +
    '<div class="vacancy-card">' +
    '<a class="vacancy-card__title-link" href="/vacancies/12345">Demand Forecasting &amp; Inventory Optimization</a>' +
    '<div class="vacancy-card__company"><a href="/companies/mtech">ООО &quot;М-ТЕХ&quot;</a></div>' +
    '</div></section>';
  const jobs = parseHabrCards(html);
  assert.equal(jobs.length, 1, 'expected one parsed card');
  assert.equal(jobs[0].title, 'Demand Forecasting & Inventory Optimization');
  assert.equal(jobs[0].company, 'ООО "М-ТЕХ"');
});
