/**
 * v1.118 parent-parity sources (batch A) — csod / phenom / radancy.
 * Fetch/parse with a stubbed transport (no network), host-pinning, meta shape
 * for the scan dropdown, and adapter matches()/buildEndpoint(). Fixtures
 * adapted from the parent career-ops provider tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { meta as csodMeta, CSOD_HOST_RE, resolveConfig as csodConfig, assertCsodUrl, extractToken, parseCsodDate, cleanLocations, parseRequisitions, fetchCsod } from '../server/lib/sources/csod.mjs';
import { csodAdapter } from '../server/lib/portals/adapters/csod.mjs';
import { meta as phenomMeta, PHENOM_HOST_RE, resolveConfig as phenomConfig, assertPhenomUrl, slugify, parsePhenomDate, jobLocation, parseRefineSearch, fetchPhenom } from '../server/lib/sources/phenom.mjs';
import { phenomAdapter } from '../server/lib/portals/adapters/phenom.mjs';
import { meta as radancyMeta, RADANCY_LIST_RE, resolveListUrl, assertRadancyUrl, parseResults, fetchRadancy } from '../server/lib/sources/radancy.mjs';
import { radancyAdapter } from '../server/lib/portals/adapters/radancy.mjs';

const jsonResponse = (obj) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });
const textResponse = (s) => ({ ok: true, status: 200, text: async () => s, json: async () => JSON.parse(s) });

test('all three sources export a valid meta (scan dropdown auto-discovery)', () => {
  for (const m of [csodMeta, phenomMeta, radancyMeta]) {
    assert.equal(typeof m.value, 'string');
    assert.equal(typeof m.label, 'string');
    assert.equal(m.region, 'en');
  }
  assert.deepEqual([csodMeta.value, phenomMeta.value, radancyMeta.value].sort(), ['csod', 'phenom', 'radancy']);
  assert.equal(csodMeta.label, 'Cornerstone');
  assert.equal(phenomMeta.label, 'Phenom');
  assert.equal(radancyMeta.label, 'Radancy');
});

test('csod: config is host-pinned to *.csod.com + careersite path shape', () => {
  const cfg = csodConfig({ api: 'https://career-ohb.csod.com/ux/ats/careersite/4/home?c=career-ohb' });
  assert.equal(cfg.siteId, 4);
  assert.equal(cfg.corpName, 'career-ohb');
  assert.equal(cfg.homeUrl, 'https://career-ohb.csod.com/ux/ats/careersite/4/home?c=career-ohb');
  assert.equal(cfg.searchApi, 'https://career-ohb.csod.com/services/x/career-site/v1/search');
  // Path-spoofed / suffix-spoofed hosts, non-careersite paths, http — all rejected.
  assert.equal(csodConfig({ api: 'https://evil.com/x.csod.com/ux/ats/careersite/4/home' }), null);
  assert.equal(csodConfig({ api: 'https://csod.com.evil.com/ux/ats/careersite/4/home' }), null);
  assert.equal(csodConfig({ api: 'https://career-x.csod.com/other/path' }), null);
  assert.equal(csodConfig({ api: 'http://career-ohb.csod.com/ux/ats/careersite/4/home' }), null);
  assert.throws(() => assertCsodUrl('https://evil.example.com/ux/ats/careersite/4/home'), /untrusted hostname/);
  assert.throws(() => assertCsodUrl('http://x.csod.com/ux/ats/careersite/4/home'), /HTTPS/);
  assert.equal(CSOD_HOST_RE.test('career-ohb.csod.com'), true);
  assert.equal(CSOD_HOST_RE.test('csod.com.evil.com'), false);
});

test('csod: token extraction, M/D/YYYY dates, locations, requisition parse', () => {
  assert.equal(extractToken('x{"token":"eyJab.c-d_e"}y'), 'eyJab.c-d_e');
  assert.equal(extractToken('<html>no token</html>'), '');
  assert.equal(extractToken(undefined), '');
  assert.equal(parseCsodDate('7/3/2026'), '2026-07-03');
  assert.equal(parseCsodDate('13/40/2026'), '');
  assert.equal(parseCsodDate('4/31/2026'), ''); // roll-over dates rejected
  assert.equal(parseCsodDate('garbage'), '');
  assert.equal(parseCsodDate(null), '');
  assert.equal(cleanLocations([{ city: 'Bremen', state: 'Bremen', country: 'DE' }]), 'Bremen, DE');
  assert.equal(cleanLocations([{ city: 'A', country: 'DE' }, { city: 'B', country: 'AT' }]), 'A, DE / B, AT');
  assert.equal(cleanLocations(undefined), '');
  assert.equal(cleanLocations([null]), '');

  const reqJson = { data: { totalCount: 3, requisitions: [
    { requisitionId: 8410, postingEffectiveDate: '7/3/2026', displayJobTitle: 'IT <b>Specialist</b> (m/w/d)', locations: [{ city: 'Bremen', country: 'DE' }] },
    { requisitionId: null, displayJobTitle: 'No id — dropped' },
    { requisitionId: 99, displayJobTitle: '' },
  ] } };
  const { total, jobs } = parseRequisitions(reqJson, { origin: 'https://career-ohb.csod.com', siteId: 4, corpName: 'career-ohb' }, 'OHB');
  assert.equal(total, 3);
  assert.equal(jobs.length, 1); // id-less and title-less rows dropped
  assert.equal(jobs[0].title, 'IT Specialist (m/w/d)'); // tags stripped
  assert.equal(jobs[0].url, 'https://career-ohb.csod.com/ux/ats/careersite/4/home/requisition/8410?c=career-ohb');
  assert.equal(jobs[0].location, 'Bremen, DE');
  assert.equal(jobs[0].date, '2026-07-03');
  assert.equal(jobs[0].company, 'OHB');
  assert.equal(jobs[0].source, 'csod');
  assert.equal(jobs[0].id, 'csod-8410');
});

test('csod: fetch pulls the anonymous token, POST-paginates via totalCount, dedups; missing token throws', async () => {
  const mkReq = (id, title) => ({ requisitionId: id, displayJobTitle: title, postingEffectiveDate: '7/3/2026', locations: [] });
  const fullPage = Array.from({ length: 25 }, (_, i) => mkReq(i + 1, `Job ${i + 1}`));
  const searchPages = [
    { data: { totalCount: 27, requisitions: fullPage } },
    { data: { totalCount: 27, requisitions: [mkReq(25, 'Job 25 dup'), mkReq(26, 'Job 26'), mkReq(27, 'Job 27')] } },
  ];
  let searchCalls = 0;
  let sawAuth = '';
  const fetchImpl = async (url, init = {}) => {
    if (init.method === 'POST') {
      sawAuth = init.headers?.authorization || '';
      const body = JSON.parse(init.body);
      assert.equal(body.pageSize, 25);
      assert.equal(body.pageNumber, searchCalls + 1);
      return jsonResponse(searchPages[searchCalls++] ?? { data: { totalCount: 27, requisitions: [] } });
    }
    return textResponse('{"token":"tok.abc"}'); // bootstrap home page
  };
  const company = { name: 'OHB', api: 'https://career-ohb.csod.com/ux/ats/careersite/4/home?c=career-ohb' };
  const jobs = await fetchCsod(company.api, { fetchImpl, company });
  assert.equal(jobs.length, 27);
  assert.equal(new Set(jobs.map((j) => j.url)).size, 27); // dedup across pages
  assert.equal(searchCalls, 2); // totalCount stops the loop
  assert.equal(sawAuth, 'Bearer tok.abc');
  // Token missing → hard error (never a silent empty scan).
  await assert.rejects(
    () => fetchCsod('https://x.csod.com/ux/ats/careersite/1/home?c=x', { fetchImpl: async () => textResponse('<html/>'), company: { name: 'X' } }),
    /no anonymous token/,
  );
  // Evil endpoint rejected before any request.
  await assert.rejects(() => fetchCsod('https://evil.example.com/ux/ats/careersite/1/home', { fetchImpl }), /untrusted hostname/);
});

test('phenom: config defaults + phenom block; endpoint guard; slugify; refineSearch parse', () => {
  const cfg = phenomConfig({ api: 'https://careers.allianz.com', phenom: { lang: 'en_global', country: 'global', urlPrefix: 'global/en', selectedFields: { country: ['Germany'] } } });
  assert.equal(cfg.widgetsApi, 'https://careers.allianz.com/widgets');
  assert.equal(cfg.urlPrefix, 'global/en');
  assert.equal(cfg.selectedFields.country[0], 'Germany');
  const def = phenomConfig({ careers_url: 'https://x.example.com' });
  assert.equal(def.lang, 'en_global');
  assert.equal(def.country, 'global');
  assert.equal(def.urlPrefix, 'global/en');
  assert.equal(phenomConfig({ api: 'http://careers.allianz.com' }), null); // https only
  assert.throws(() => assertPhenomUrl('http://careers.allianz.com/widgets'), /HTTPS/);
  // Auto-detect regex is hostname-anchored: spoofs never match.
  assert.equal(PHENOM_HOST_RE.test('x.phenompeople.com'), true);
  assert.equal(PHENOM_HOST_RE.test('phenompeople.com.evil.com'), false);

  assert.equal(slugify('Sr Economic & Financial Analyst'), 'Sr-Economic-Financial-Analyst');
  assert.equal(slugify('München HR (m/w/d)'), 'Munchen-HR-m-w-d');
  assert.equal(slugify('###'), 'job');
  assert.equal(parsePhenomDate('2026-05-07T18:25:30.000+0000'), '2026-05-07');
  assert.equal(parsePhenomDate(''), '');
  assert.equal(jobLocation({ location: 'Munich, Germany' }), 'Munich, Germany');
  assert.equal(jobLocation({ city: 'Munich', state: 'Bavaria', country: 'Germany' }), 'Munich, Bavaria, Germany');

  const phJson = { refineSearch: { status: 200, totalHits: 42, data: { jobs: [
    { jobId: '98098', title: 'Sr Analyst', location: 'France', postedDate: '2026-05-07T18:25:30.000+0000' },
    { jobId: '', title: 'No id — dropped' },
    { jobId: '5', title: '' },
    { jobId: '12/34', title: 'Slash Id' },
  ] } } };
  const { total, jobs } = parseRefineSearch(phJson, { origin: 'https://careers.allianz.com', urlPrefix: 'global/en' }, 'Allianz');
  assert.equal(total, 42);
  assert.equal(jobs.length, 2); // id/title-less records dropped
  assert.equal(jobs[0].url, 'https://careers.allianz.com/global/en/job/98098/Sr-Analyst');
  assert.equal(jobs[1].url, 'https://careers.allianz.com/global/en/job/12%2F34/Slash-Id'); // jobId percent-encoded
  assert.equal(jobs[0].date, '2026-05-07');
  assert.equal(jobs[0].company, 'Allianz');
  assert.equal(jobs[0].source, 'phenom');
});

test('phenom: fetch paginates via from/size until totalHits, forwards facets, preserves partial results', async () => {
  const mkJob = (id) => ({ jobId: String(id), title: `Job ${id}`, location: 'Germany', postedDate: '2026-05-07T18:25:30.000+0000' });
  const phPage = (ids) => ({ refineSearch: { status: 200, totalHits: 150, data: { jobs: ids.map(mkJob) } } });
  const pages = [phPage(Array.from({ length: 100 }, (_, i) => i + 1)), phPage([100, 101, 102])];
  let calls = 0;
  let sawFacet = null;
  const fetchImpl = async (url, init = {}) => {
    const b = JSON.parse(init.body);
    sawFacet = b.selected_fields;
    assert.equal(b.from, calls * 100);
    return jsonResponse(pages[calls++] ?? phPage([]));
  };
  const company = { name: 'Allianz', api: 'https://careers.allianz.com', phenom: { selectedFields: { country: ['Germany'] } } };
  const jobs = await fetchPhenom('https://careers.allianz.com/widgets', { fetchImpl, company });
  assert.equal(jobs.length, 102);
  assert.equal(calls, 2); // totalHits stops the loop
  assert.equal(new Set(jobs.map((j) => j.url)).size, 102); // dedup across pages
  assert.equal(sawFacet.country[0], 'Germany');

  // A mid-scan failure preserves jobs already collected, never discards pages.
  let partialCalls = 0;
  const partialImpl = async () => {
    partialCalls++;
    if (partialCalls === 1) return jsonResponse(phPage(Array.from({ length: 100 }, (_, i) => i + 1)));
    throw new Error('network blip on page 2');
  };
  const partial = await fetchPhenom('https://careers.allianz.com/widgets', { fetchImpl: partialImpl, company: { name: 'Allianz', api: 'https://careers.allianz.com' } });
  assert.equal(partial.length, 100);
  assert.equal(partialCalls, 2);
});

test('radancy: list URL resolution + endpoint shape guard; SSR parse decodes entities safely', () => {
  assert.equal(resolveListUrl({ api: 'https://careers.munichre.com/en/search-jobs' }), 'https://careers.munichre.com/en/search-jobs');
  assert.equal(resolveListUrl({ careers_url: 'https://careers.munichre.com/de/some-page' }), 'https://careers.munichre.com/de/search-jobs');
  assert.equal(resolveListUrl({ api: 'http://careers.munichre.com/en/search-jobs' }), null); // https only
  assert.equal(resolveListUrl({ api: 'not a url' }), null);
  assert.throws(() => assertRadancyUrl('https://careers.munichre.com/en/other'), /search-jobs/);
  assert.throws(() => assertRadancyUrl('http://careers.munichre.com/en/search-jobs'), /HTTPS/);
  assert.equal(RADANCY_LIST_RE.test('/en/search-jobs'), true);
  assert.equal(RADANCY_LIST_RE.test('/en/jobs'), false);

  const card = (id, title, loc) =>
    '<li class="search-results-list__item job-list-01-list__item">' +
    '<div class="search-results-list__content">' +
    `<h5 class="search-results-list__job-title"><a class="search-results-list__job-link job-card-brand-hover--x" href="/en/job/city/${id}-slug/3193/${id}" data-job-id="${id}" id="job-${id}">${title}</a></h5>` +
    `<ul class="search-results-list__job-info-list"><li class="search-results-list__job-info job-list-01-list__job-info--location"><i class="icon"></i> <span>${loc}</span> </li></ul>` +
    '</li>';
  const html = '<html>' + card('40548453568', 'Innendienst f&#252;r Versicherungsagentur', 'Bingen am Rhein, Germany') + card('40546200896', 'Category Manager', 'London, United Kingdom') + '</html>';
  const rows = parseResults(html, 'https://careers.munichre.com', 'Munich Re');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, 'Innendienst für Versicherungsagentur'); // entities decoded
  assert.equal(rows[0].url, 'https://careers.munichre.com/en/job/city/40548453568-slug/3193/40548453568');
  assert.equal(rows[0].location, 'Bingen am Rhein, Germany');
  assert.equal(rows[0].id, 'radancy-40548453568');
  assert.equal(rows[0].company, 'Munich Re');
  assert.equal(rows[0].date, ''); // SSR list carries no posting date
  assert.equal(rows[0].source, 'radancy');
  assert.equal(parseResults('<html>no items</html>', 'https://x').length, 0);
  assert.equal(parseResults(undefined, 'https://x').length, 0);
  // A malformed numeric entity (lone surrogate half) degrades to literal text,
  // never throws RangeError and aborts the whole parse.
  const badRows = parseResults('<html>' + card('999', 'Bad&#xD800;Entity', 'Berlin, Germany') + '</html>', 'https://careers.munichre.com');
  assert.equal(badRows.length, 1);
  assert.equal(badRows[0].title, 'Bad&#xD800;Entity');
});

test('radancy: fetch pages ?p=N, stops on empty / all-seen pages, preserves partial results', async () => {
  const card = (id, title, loc) =>
    `<li class="search-results-list__item"><a class="search-results-list__job-link" href="/en/job/city/${id}-slug/3193/${id}" data-job-id="${id}">${title}</a>` +
    `<li class="search-results-list__job-info job-list-01-list__job-info--location"><i></i><span>${loc}</span></li></li>`;
  const html = '<html>' + card('1', 'A', 'Bingen, Germany') + card('2', 'B', 'London, UK') + '</html>';
  const pages = [html, '<html>' + card('111', 'C', 'Kiel, Germany') + '</html>', '<html></html>'];
  let calls = 0;
  const seenUrls = [];
  const fetchImpl = async (url) => { seenUrls.push(url); return textResponse(pages[calls++] ?? '<html></html>'); };
  const endpoint = 'https://careers.munichre.com/en/search-jobs';
  const jobs = await fetchRadancy(endpoint, { fetchImpl, company: { name: 'Munich Re' } });
  assert.equal(jobs.length, 3);
  assert.equal(calls, 3); // stops on the first empty page
  assert.ok(seenUrls[0].endsWith('?p=1'));
  assert.ok(seenUrls[1].endsWith('?p=2'));

  // Mid-scan failure preserves jobs already collected.
  let partialCalls = 0;
  const partialImpl = async () => {
    partialCalls++;
    if (partialCalls === 1) return textResponse(html);
    throw new Error('network blip on page 2');
  };
  const partial = await fetchRadancy(endpoint, { fetchImpl: partialImpl, company: { name: 'Munich Re' } });
  assert.equal(partial.length, 2);
  assert.equal(partialCalls, 2);

  // A page whose ids are all already-seen (server clamped ?p=) halts the walk
  // without appending duplicates — NOT just a literally empty page.
  const dupPages = [html, '<html>' + card('1', 'A', 'Bingen, Germany') + '</html>', '<html>' + card('999', 'Never reached', 'X') + '</html>'];
  let dupCalls = 0;
  const dupImpl = async () => textResponse(dupPages[dupCalls++] ?? '<html></html>');
  const dupJobs = await fetchRadancy(endpoint, { fetchImpl: dupImpl, company: { name: 'Munich Re' } });
  assert.equal(dupJobs.length, 2);
  assert.equal(dupCalls, 2);
});

test('adapters: matches() + buildEndpoint() contracts (endpoint is a string or null)', () => {
  // csod — per-tenant: provider OR *.csod.com careersite host.
  assert.equal(csodAdapter.matches({ api: 'https://career-ohb.csod.com/ux/ats/careersite/4/home?c=career-ohb' }), true);
  assert.equal(csodAdapter.matches({ provider: 'csod' }), true);
  assert.equal(csodAdapter.matches({ careers_url: 'https://evil.com/x.csod.com/ux/ats/careersite/4/home' }), false);
  assert.equal(csodAdapter.buildEndpoint({ api: 'https://career-ohb.csod.com/ux/ats/careersite/4/home?c=career-ohb' }), 'https://career-ohb.csod.com/ux/ats/careersite/4/home?c=career-ohb');
  assert.equal(csodAdapter.buildEndpoint({ careers_url: 'https://example.com' }), null);
  // phenom — auto-claims only literal *.phenompeople.com; branded hosts wire explicitly.
  assert.equal(phenomAdapter.matches({ api: 'https://x.phenompeople.com/y' }), true);
  assert.equal(phenomAdapter.matches({ careers_url: 'https://careers.allianz.com' }), false);
  assert.equal(phenomAdapter.matches({ careers_url: 'https://evil.com/x?y=phenompeople.com' }), false);
  assert.equal(phenomAdapter.matches({ careers_url: 'https://phenompeople.com.evil.com/x' }), false);
  assert.equal(phenomAdapter.matches({ provider: 'phenom', careers_url: 'https://careers.allianz.com' }), true);
  assert.equal(phenomAdapter.buildEndpoint({ provider: 'phenom', careers_url: 'https://careers.allianz.com' }), 'https://careers.allianz.com/widgets');
  assert.equal(phenomAdapter.buildEndpoint({ provider: 'phenom' }), null);
  // radancy — explicit wiring only, never auto-claims.
  assert.equal(radancyAdapter.matches({ careers_url: 'https://careers.munichre.com/en/search-jobs' }), false);
  assert.equal(radancyAdapter.matches({ provider: 'radancy' }), true);
  assert.equal(radancyAdapter.buildEndpoint({ provider: 'radancy', careers_url: 'https://careers.munichre.com/en/search-jobs' }), 'https://careers.munichre.com/en/search-jobs');
  assert.equal(radancyAdapter.buildEndpoint({ provider: 'radancy', careers_url: 'https://careers.munichre.com/de/some-page' }), 'https://careers.munichre.com/de/search-jobs');
  assert.equal(radancyAdapter.buildEndpoint({ provider: 'radancy' }), null);
  // all three expose id/label/fetch.
  for (const a of [csodAdapter, phenomAdapter, radancyAdapter]) {
    assert.equal(typeof a.id, 'string');
    assert.equal(typeof a.label, 'string');
    assert.equal(typeof a.fetch, 'function');
  }
});
