/**
 * v1.18.0 parent-parity sources — deutschebahn / tkms. Fetch/parse with a
 * stubbed transport (no network), host-pinning, meta shape for the scan
 * dropdown, and adapter matches()/buildEndpoint(). (echojobs retired in v1.212.0
 * — the feed went behind bot protection.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  meta as dbMeta,
  DEUTSCHEBAHN_HOST_RE,
  resolveConfig as dbConfig,
  parseHits as dbParseHits,
  fetchDeutschebahn,
} from '../server/lib/sources/deutschebahn.mjs';
import { deutschebahnAdapter } from '../server/lib/portals/adapters/deutschebahn.mjs';

import {
  meta as tkMeta,
  TKMS_HOST_RE,
  resolveConfig as tkConfig,
  slugify as tkSlug,
  parseTkmsDate,
  tkmsLocation,
  parseQuery as tkParseQuery,
  fetchTkms,
} from '../server/lib/sources/tkms.mjs';
import { tkmsAdapter } from '../server/lib/portals/adapters/tkms.mjs';

const jsonResponse = (obj) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });
const textResponse = (s) => ({ ok: true, status: 200, text: async () => s, json: async () => JSON.parse(s) });

// ---------------------------------------------------------------------------
// meta
// ---------------------------------------------------------------------------
test('all three sources export a valid meta (scan dropdown auto-discovery)', () => {
  for (const m of [dbMeta, tkMeta]) {
    assert.equal(typeof m.value, 'string');
    assert.equal(typeof m.label, 'string');
    assert.equal(m.region, 'en');
  }
  assert.deepEqual([dbMeta.value, tkMeta.value].sort(), ['deutschebahn', 'tkms']);
  assert.equal(dbMeta.label, 'Deutsche Bahn');
  assert.equal(tkMeta.label, 'TKMS');
});

// ---------------------------------------------------------------------------
// Deutsche Bahn
// ---------------------------------------------------------------------------
const dbHit = (id, title, loc) =>
  `<div class="o-searchpage__item"><a href="/de-de/Suche/${title.replace(/[^A-Za-z]+/g, '-')}-1396${id}?jobId=${id}" aria-label="Zum Stellenangebot" class="m-search-hit" data-job-id="${id}"><header class="m-search-hit__header"><h3 class="m-search-hit__title"><span class="m-search-hit__title-text" > ${title} </span><span class="m-search-hit__badge">neu</span></h3></header><ul class="m-search-hit__items"><li class="m-search-hit__item"><i class="g-ficon" aria-label="Arbeitsort"></i> ${loc} </li><li class="m-search-hit__item"><i aria-label="Arbeitgeber:in"></i> DB InfraGO AG </li></ul></a></div>`;

test('deutschebahn: host-pinning rejects spoofed / http hosts', () => {
  assert.equal(dbConfig({ careers_url: 'https://evil.com/x.db.jobs' }), null);
  assert.equal(dbConfig({ careers_url: 'https://db.jobs.evil.com/x' }), null);
  assert.equal(dbConfig({ api: 'http://db.jobs/service/search/de-de/5441588' }), null); // https only
  assert.equal(DEUTSCHEBAHN_HOST_RE.test('db.jobs'), true);
  assert.equal(DEUTSCHEBAHN_HOST_RE.test('sub.db.jobs'), true);
  assert.equal(DEUTSCHEBAHN_HOST_RE.test('db.jobs.evil.com'), false);

  const cfg = dbConfig({ api: 'https://db.jobs/service/search/de-de/5441588' });
  assert.equal(cfg.searchBase, 'https://db.jobs/service/search/de-de/5441588');
});

test('deutschebahn: parseHits extracts title/location/absolute url + dedups', () => {
  const html = '<html>' + dbHit('630365', 'Teilprojektleiter:in Tunnel / Logistik', 'München, Deutschland')
    + dbHit('631112', 'Bauleiter:in Vegetation', 'Koblenz, Deutschland')
    + dbHit('630365', 'DUP', 'X') + '</html>';
  const rows = dbParseHits(html, 'https://db.jobs', 'Deutsche Bahn');
  assert.equal(rows.length, 2); // dup data-job-id dropped
  assert.equal(rows[0].title, 'Teilprojektleiter:in Tunnel / Logistik');
  assert.equal(rows[0].location, 'München, Deutschland');
  assert.equal(rows[0].url, 'https://db.jobs/de-de/Suche/Teilprojektleiter-in-Tunnel-Logistik-1396630365?jobId=630365');
  assert.equal(rows[0].company, 'Deutsche Bahn');
  assert.equal(rows[0].source, 'deutschebahn');
  assert.equal(rows[0].id, 'deutschebahn-630365');
  // hit-less / non-string input → []
  assert.equal(dbParseHits('<html>no hits</html>', 'https://db.jobs').length, 0);
  assert.equal(dbParseHits(undefined, 'https://db.jobs').length, 0);
});

test('deutschebahn: parseHits tolerates a malformed numeric entity (no RangeError)', () => {
  const html = '<html>' + dbHit('700001', 'Bad&#xD800;Entity', 'Berlin, Deutschland') + '</html>';
  const rows = dbParseHits(html, 'https://db.jobs');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Bad&#xD800;Entity'); // surrogate degrades to literal
});

test('deutschebahn: fetch paginates via pageNum and stops on the first empty page', async () => {
  const pages = [
    '<html>' + dbHit('1', 'A', 'Berlin') + dbHit('2', 'B', 'Kiel') + '</html>',
    '<html>' + dbHit('3', 'C', 'Bonn') + '</html>',
    '<html></html>',
  ];
  let calls = 0;
  const seenUrls = [];
  const fetchImpl = async (url) => { seenUrls.push(url); return textResponse(pages[calls++] ?? '<html></html>'); };
  const jobs = await fetchDeutschebahn('https://db.jobs/service/search/de-de/5441588', { fetchImpl, company: { name: 'Deutsche Bahn' } });
  assert.equal(jobs.length, 3);
  assert.equal(calls, 3);
  assert.match(seenUrls[0], /pageNum=0/);
  assert.match(seenUrls[1], /pageNum=1/);
  assert.equal(jobs[0].company, 'Deutsche Bahn');
});

test('deutschebahn: fetch honors max_pages', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return textResponse('<html>' + dbHit(String(700100 + calls), `Job ${calls}`, 'Berlin') + '</html>'); };
  const jobs = await fetchDeutschebahn('https://db.jobs/service/search/de-de/5441588', { fetchImpl, company: { name: 'DB', max_pages: 3 } });
  assert.equal(calls, 3);
  assert.equal(jobs.length, 3);
});

// ---------------------------------------------------------------------------
// TKMS
// ---------------------------------------------------------------------------
test('tkms: host-pinning rejects spoofed / http hosts; config reads subclient/locale', () => {
  assert.equal(tkConfig({ careers_url: 'https://evil.com/x.jobs.tkmsgroup.com' }), null);
  assert.equal(tkConfig({ careers_url: 'https://jobs.tkmsgroup.com.evil.com/x' }), null);
  assert.equal(tkConfig({ api: 'http://jobs.tkmsgroup.com/en' }), null); // https only
  assert.equal(TKMS_HOST_RE.test('jobs.tkmsgroup.com'), true);
  assert.equal(TKMS_HOST_RE.test('jobs.tkmsgroup.com.evil.com'), false);

  const cfg = tkConfig({ api: 'https://jobs.tkmsgroup.com/en', tkms: { subclient: 'tkms', locale: 'en' } });
  assert.equal(cfg.queryApi, 'https://jobs.tkmsgroup.com/api/filter/query');
  assert.equal(cfg.subclient, 'tkms');
  assert.equal(cfg.locale, 'en');
});

test('tkms: helpers (slugify / parseTkmsDate / tkmsLocation)', () => {
  assert.equal(tkSlug('Systemingenieur IT (m/w/d)'), 'Systemingenieur-IT-m-w-d');
  assert.equal(parseTkmsDate({ postingDate_timestamp: 1783029600 }), 1783029600000);
  assert.equal(parseTkmsDate({ postingDate: '2026-07-02T22:00:00' }), Date.parse('2026-07-02T22:00:00Z'));
  assert.equal(tkmsLocation({ locations: [{ cityState: 'Kiel, Schleswig-Holstein' }, { cityState: 'Emden, Lower Saxony' }] }), 'Kiel, Schleswig-Holstein / Emden, Lower Saxony');
  assert.equal(tkmsLocation({ city: 'Kiel', country: 'Germany' }), 'Kiel, Germany');
});

test('tkms: parseQuery reads total/nextPage, drops id/title-less, builds encoded url', () => {
  const json = { totalHits: 330, nextPage: 1, jobs: [
    { data: { id: '964694', title: 'Schiffbauer (m/w/d)', city: 'Kiel', country: 'Germany', postingDate_timestamp: 1783029600, locations: [{ cityState: 'Kiel, Schleswig-Holstein' }] } },
    { data: { id: '', title: 'No id' } },
    { data: { id: '5', title: '' } },
    { data: { id: '12/34', title: 'Slash Id' } },
  ] };
  const { total, nextPage, rows } = tkParseQuery(json, { origin: 'https://jobs.tkmsgroup.com', locale: 'en', company: 'TKMS' });
  assert.equal(total, 330);
  assert.equal(nextPage, 1);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].url, 'https://jobs.tkmsgroup.com/en/job/Schiffbauer-m-w-d/964694');
  assert.equal(rows[0].location, 'Kiel, Schleswig-Holstein');
  assert.match(rows[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(rows[0].source, 'tkms');
  assert.equal(rows[1].url, 'https://jobs.tkmsgroup.com/en/job/Slash-Id/12%2F34');
});

test('tkms: fetch paginates via page/nextPage, dedups, sends subclient in the POST body', async () => {
  const mkPage = (ids, next) => ({ totalHits: 40, nextPage: next, jobs: ids.map((i) => ({ data: { id: String(i), title: `Job ${i}`, city: 'Kiel', country: 'Germany' } })) });
  const pages = [mkPage([1, 2], 1), mkPage([2, 3], null)];
  let calls = 0;
  let sawSubclient = null;
  const fetchImpl = async (url, opts) => {
    assert.equal(opts.method, 'POST');
    assert.equal(opts.redirect, 'error');
    const body = JSON.parse(opts.body);
    sawSubclient = body.subclient;
    assert.equal(body.page, calls);
    return jsonResponse(pages[calls++] ?? mkPage([], null));
  };
  const jobs = await fetchTkms('https://jobs.tkmsgroup.com/api/filter/query', { fetchImpl, company: { name: 'TKMS', careers_url: 'https://jobs.tkmsgroup.com/en' } });
  assert.equal(jobs.length, 3); // id 2 deduped across pages
  assert.equal(calls, 2);
  assert.equal(sawSubclient, 'tkms');
  assert.equal(jobs[0].company, 'TKMS');
});

// ---------------------------------------------------------------------------
// adapters
// ---------------------------------------------------------------------------
test('adapters: matches() + buildEndpoint() contracts (endpoint is a string or null)', () => {
  // Deutsche Bahn — provider OR host, defaults the search id
  assert.equal(deutschebahnAdapter.matches({ provider: 'deutschebahn' }), true);
  assert.equal(deutschebahnAdapter.matches({ careers_url: 'https://db.jobs/service/search/de-de/5441588' }), true);
  assert.equal(deutschebahnAdapter.matches({ careers_url: 'https://example.com' }), false);
  assert.equal(deutschebahnAdapter.buildEndpoint({ provider: 'deutschebahn' }), 'https://db.jobs/service/search/de-de/5441588');
  assert.equal(deutschebahnAdapter.buildEndpoint({ careers_url: 'https://db.jobs/service/search/de-de/999999' }), 'https://db.jobs/service/search/de-de/999999');
  assert.equal(deutschebahnAdapter.buildEndpoint({ careers_url: 'https://example.com' }), null);

  // TKMS — provider OR host, endpoint is the POST query API string
  assert.equal(tkmsAdapter.matches({ provider: 'tkms' }), true);
  assert.equal(tkmsAdapter.matches({ careers_url: 'https://jobs.tkmsgroup.com/en' }), true);
  assert.equal(tkmsAdapter.matches({ careers_url: 'https://example.com' }), false);
  assert.equal(tkmsAdapter.buildEndpoint({ provider: 'tkms' }), 'https://jobs.tkmsgroup.com/api/filter/query');
  assert.equal(tkmsAdapter.buildEndpoint({ careers_url: 'https://jobs.tkmsgroup.com/en' }), 'https://jobs.tkmsgroup.com/api/filter/query');
  assert.equal(tkmsAdapter.buildEndpoint({ careers_url: 'https://example.com' }), null);

  // both expose id/label/fetch
  for (const a of [deutschebahnAdapter, tkmsAdapter]) {
    assert.equal(typeof a.id, 'string');
    assert.equal(typeof a.label, 'string');
    assert.equal(typeof a.fetch, 'function');
  }
});
