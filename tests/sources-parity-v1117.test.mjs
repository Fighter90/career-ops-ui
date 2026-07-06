/**
 * v1.117.0 parent-parity sources — beesite / higheredjobs / jibeapply /
 * softgarden. Fetch/parse with a stubbed transport (no network), host-pinning,
 * meta shape for the scan dropdown, and adapter matches()/buildEndpoint().
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { meta as beesiteMeta, resolveConfig, buildSearchUrl, parseSearchResult, fetchBeesite } from '../server/lib/sources/beesite.mjs';
import { beesiteAdapter } from '../server/lib/portals/adapters/beesite.mjs';
import { meta as hejMeta, feedUrlFor, assertHejUrl, parseHigherEdJobsFeed, fetchHigherEdJobs } from '../server/lib/sources/higheredjobs.mjs';
import { higheredjobsAdapter } from '../server/lib/portals/adapters/higheredjobs.mjs';
import { meta as jibeMeta, toApiUrl, parseJibeapplyResponse, fetchJibeapply } from '../server/lib/sources/jibeapply.mjs';
import { jibeapplyAdapter } from '../server/lib/portals/adapters/jibeapply.mjs';
import { meta as sgMeta, resolveWidgetUrl, parseSoftgardenDate, parseWidget, fetchSoftgarden } from '../server/lib/sources/softgarden.mjs';
import { softgardenAdapter } from '../server/lib/portals/adapters/softgarden.mjs';

const jsonResponse = (obj) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });
const textResponse = (s) => ({ ok: true, status: 200, text: async () => s, json: async () => JSON.parse(s) });

test('all four sources export a valid meta (scan dropdown auto-discovery)', () => {
  for (const m of [beesiteMeta, hejMeta, jibeMeta, sgMeta]) {
    assert.equal(typeof m.value, 'string');
    assert.equal(typeof m.label, 'string');
    assert.equal(m.region, 'en');
  }
  assert.deepEqual([beesiteMeta.value, hejMeta.value, jibeMeta.value, sgMeta.value].sort(),
    ['beesite', 'higheredjobs', 'jibeapply', 'softgarden']);
});

test('beesite: config is host-pinned to *.beesite.de; paged fetch parses + dedups + stops', async () => {
  assert.equal(resolveConfig({ api: 'https://evil.example.com/search' }), null);
  assert.equal(resolveConfig({ api: 'http://global.app.beesite.de/' }), null); // https only
  const cfg = resolveConfig({ api: 'https://global-jobboard-api.app.beesite.de/' });
  assert.equal(cfg.searchApi, 'https://global-jobboard-api.app.beesite.de/search');
  assert.match(buildSearchUrl(cfg, 1), /^https:\/\/global-jobboard-api\.app\.beesite\.de\/search\?data=/);

  const item = (id, title, uri, date) => ({ MatchedObjectId: id, MatchedObjectDescriptor: { PositionTitle: title, PositionURI: uri, PositionLocation: [{ CityName: 'Bremen' }], PublicationStartDate: date } });
  const page = { SearchResult: { SearchResultCountAll: 2, SearchResultItems: [
    item('1', 'ML <b>Engineer</b>', 'https://jobs.mercedes-benz.com/j/1', '2026-07-04'),
    item('1', 'dup', 'https://jobs.mercedes-benz.com/j/1', '2026-07-04'),
    item('2', 'Data Engineer', 'https://jobs.mercedes-benz.com/j/2', 'bogus'),
  ] } };
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return jsonResponse(page); };
  const jobs = await fetchBeesite('https://global-jobboard-api.app.beesite.de/', { fetchImpl, company: { name: 'Mercedes-Benz' } });
  assert.equal(calls.length, 1); // total=2 ≤ page size → one request
  assert.equal(jobs.length, 2);  // dup id dropped
  assert.equal(jobs[0].title, 'ML Engineer'); // tags stripped
  assert.equal(jobs[0].company, 'Mercedes-Benz');
  assert.equal(jobs[0].date, '2026-07-04');
  assert.equal(jobs[1].date, ''); // bogus date → ''
  assert.equal(jobs[0].source, 'beesite');
  const { total } = parseSearchResult(page, 'X');
  assert.equal(total, 2);
});

test('higheredjobs: feed is host-pinned; parse splits "Institution (City, ST)"', async () => {
  assert.equal(feedUrlFor(12), 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=12');
  assert.throws(() => assertHejUrl('https://evil.example.com/rss'), /untrusted hostname/);
  const xml = `<rss><channel>
    <item><title>Assistant Professor, CS</title><link>https://www.higheredjobs.com/details.cfm?JobCode=1</link><description>State University (Austin, TX)</description><pubDate>Mon, 06 Jul 2026 00:00:00 GMT</pubDate></item>
    <item><title>Dropped</title><link>https://phish.example.com/x</link><description>Nope</description></item>
  </channel></rss>`;
  const jobs = parseHigherEdJobsFeed(xml);
  assert.equal(jobs.length, 1); // off-host link dropped
  assert.equal(jobs[0].company, 'State University');
  assert.equal(jobs[0].location, 'Austin, TX');
  assert.equal(jobs[0].date, '2026-07-06');
  const fetched = await fetchHigherEdJobs(feedUrlFor(), { fetchImpl: async () => textResponse(xml) });
  assert.equal(fetched.length, 1);
  assert.equal(fetched[0].source, 'higheredjobs');
});

test('jibeapply: api derivation is host-pinned; paged fetch respects totals + makes URLs absolute', async () => {
  assert.equal(toApiUrl('https://evil.example.com/jobs'), null);
  assert.equal(toApiUrl('https://acme.jibeapply.com/jobs'), 'https://acme.jibeapply.com/api/jobs');
  const mk = (n) => ({ data: { title: `Job ${n}`, slug: `job-${n}`, city: 'Austin', country: 'US' } });
  const pages = {
    1: { totalCount: 4, count: 2, jobs: [mk(1), mk(2)] },
    2: { totalCount: 4, count: 2, jobs: [mk(3), mk(4)] },
  };
  const fetchImpl = async (url) => {
    const page = Number(new URL(url).searchParams.get('page') || 1);
    return jsonResponse(pages[page] || { jobs: [] });
  };
  const company = { name: 'Acme', careers_url: 'https://acme.jibeapply.com/jobs' };
  const jobs = await fetchJibeapply('https://acme.jibeapply.com/api/jobs', { fetchImpl, company });
  assert.equal(jobs.length, 4);
  assert.equal(jobs[0].url, 'https://acme.jibeapply.com/jobs/job-1');
  assert.equal(jobs[0].source, 'jibeapply');
  assert.equal(parseJibeapplyResponse({ jobs: [null, { data: { title: '', slug: 'x' } }] }, company).length, 0);
});

test('softgarden: widget URL is host-pinned; parse extracts blocks, dates, relative hrefs', async () => {
  assert.equal(resolveWidgetUrl({ careers_url: 'https://evil.example.com/de/widgets/jobs' }), null);
  assert.equal(resolveWidgetUrl({ careers_url: 'https://renk-group.softgarden.io/de/vacancies' }), 'https://renk-group.softgarden.io/de/widgets/jobs');
  assert.equal(parseSoftgardenDate('04.07.26'), '2026-07-04'); // de D.M.YY
  assert.equal(parseSoftgardenDate('7/4/26'), '2026-07-04');   // en M/D/YY
  assert.equal(parseSoftgardenDate('junk'), '');
  const html = `
    <div class="matchElement" id="job_id_101"><div class="matchValue date">04.07.26</div>
      <div class="matchValue title"><a href="../../job/101/ml-engineer?l=de">ML&nbsp;Engineer</a></div>
      <div class="matchValue ProjectGeoLocationCity"><span class="location-view-item">Augsburg</span></div></div>
    <div class="matchElement" id="job_id_101"><div class="matchValue title"><a href="../../job/101/dup">dup</a></div></div>`;
  const jobs = parseWidget(html, 'https://renk-group.softgarden.io/de/widgets/jobs', 'RENK');
  assert.equal(jobs.length, 1); // dup id dropped
  assert.equal(jobs[0].url, 'https://renk-group.softgarden.io/job/101/ml-engineer?l=de');
  assert.equal(jobs[0].location, 'Augsburg');
  assert.equal(jobs[0].date, '2026-07-04');
  const fetched = await fetchSoftgarden('https://renk-group.softgarden.io/de/widgets/jobs', { fetchImpl: async () => textResponse(html), company: { name: 'RENK' } });
  assert.equal(fetched.length, 1);
  assert.equal(fetched[0].source, 'softgarden');
});

test('adapters: matches() + buildEndpoint() contracts (endpoint is a string)', () => {
  // board-wide: explicit provider only
  assert.equal(higheredjobsAdapter.matches({ careers_url: 'https://www.higheredjobs.com/x' }), false);
  assert.equal(higheredjobsAdapter.matches({ provider: 'higheredjobs' }), true);
  assert.equal(higheredjobsAdapter.buildEndpoint({ provider: 'higheredjobs', cat_id: 68 }), feedUrlFor(68));
  // per-tenant: provider OR host
  assert.equal(beesiteAdapter.matches({ api: 'https://x.app.beesite.de/' }), true);
  assert.equal(beesiteAdapter.matches({ careers_url: 'https://example.com' }), false);
  assert.equal(typeof beesiteAdapter.buildEndpoint({ api: 'https://x.app.beesite.de/' }), 'string');
  assert.equal(jibeapplyAdapter.matches({ careers_url: 'https://acme.jibeapply.com/jobs' }), true);
  assert.equal(jibeapplyAdapter.buildEndpoint({ careers_url: 'https://acme.jibeapply.com/jobs' }), 'https://acme.jibeapply.com/api/jobs');
  assert.equal(jibeapplyAdapter.buildEndpoint({ api: 'https://careers.branded.com/api/jobs', careers_url: '' }), 'https://careers.branded.com/api/jobs');
  assert.equal(softgardenAdapter.matches({ careers_url: 'https://renk-group.softgarden.io/de/widgets/jobs' }), true);
  assert.equal(softgardenAdapter.buildEndpoint({ careers_url: 'https://renk-group.softgarden.io/de/widgets/jobs' }), 'https://renk-group.softgarden.io/de/widgets/jobs');
  // all four expose id/label/fetch
  for (const a of [beesiteAdapter, higheredjobsAdapter, jibeapplyAdapter, softgardenAdapter]) {
    assert.equal(typeof a.id, 'string');
    assert.equal(typeof a.label, 'string');
    assert.equal(typeof a.fetch, 'function');
  }
});
