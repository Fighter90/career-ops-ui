/**
 * Flowxtra source + adapter tests (CI-isolated — fake fetchImpl, no network).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchFlowxtra,
  parseFlowxtra,
  normalizeFlowxtraJob,
  assertFlowxtraUrl,
  JOBS_ENDPOINT,
} from '../server/lib/sources/flowxtra.mjs';
import { flowxtraAdapter } from '../server/lib/portals/adapters/flowxtra.mjs';

// ---------------------------------------------------------------------------
// Fake API rows (real API shape verified live in the parent 2026-07-25)
// ---------------------------------------------------------------------------
const mkRow = (i) => ({
  title: `Role ${i}`,
  urlJobApplay: `https://flowxtra.com/apply/X${i}`,
  name_company: `Co ${i}`,
  city_company: 'Berlin',
  country_company: 'Germany',
  workplace: 'On-site',
  date_share: '2026-07-23T16:22:27.000000Z',
});

// A fake fetchJson-compatible impl: returns a Response-like object whose
// .json() yields the page keyed by ?page=N. `requested` records each call.
function pagedFetchImpl(pages, requested) {
  return async (url, optsArg) => {
    requested.push({ url, redirect: optsArg?.redirect, ua: optsArg?.headers?.['User-Agent'] });
    const u = new URL(url);
    const page = Number(u.searchParams.get('page'));
    return { ok: true, status: 200, json: async () => pages[page] || { success: true, data: { data: [], next_page_url: null } } };
  };
}

// ---------------------------------------------------------------------------
// normalizeFlowxtraJob — field mapping
// ---------------------------------------------------------------------------
test('normalizeFlowxtraJob: maps + trims title/url/company/location and derives date', () => {
  const j = normalizeFlowxtraJob(
    {
      title: '  Staff AI Engineer  ',
      urlJobApplay: '  https://flowxtra.com/apply/AB12C  ',
      name_company: '  Acme Co  ',
      city_company: 'Barcelona',
      state_company: 'Catalonia',
      country_company: 'Spain',
      workplace: 'On-site',
      date_share: '2026-07-23T16:22:27.000000Z',
    },
    'Fallback',
  );
  assert.equal(j.title, 'Staff AI Engineer');
  assert.equal(j.url, 'https://flowxtra.com/apply/AB12C');
  assert.equal(j.company, 'Acme Co');
  assert.equal(j.location, 'Barcelona, Catalonia, Spain');
  assert.equal(j.workplaceType, 'On-site');
  assert.equal(j.isRemote, false);
  assert.equal(j.date, '2026-07-23');
});

test('normalizeFlowxtraJob: 12-field shape', () => {
  const j = normalizeFlowxtraJob(mkRow(1), 'X');
  const fields = ['id', 'title', 'company', 'url', 'salary', 'location',
    'isRemote', 'workplaceType', 'relocates', 'date', 'snippet', 'source'];
  for (const f of fields) {
    assert.ok(Object.prototype.hasOwnProperty.call(j, f), `missing field: ${f}`);
  }
  assert.equal(j.source, 'flowxtra');
  assert.equal(j.relocates, false);
  assert.equal(j.snippet, '');
  assert.equal(j.salary, '');
  assert.equal(j.id, 'flowxtra-https://flowxtra.com/apply/X1');
});

test('normalizeFlowxtraJob: appends "Remote" when workplace is "Remote"', () => {
  const j = normalizeFlowxtraJob(
    { title: 'R', urlJobApplay: 'https://flowxtra.com/apply/R1', city_company: 'Munich', country_company: 'Germany', workplace: 'Remote' },
    'X',
  );
  assert.equal(j.location, 'Munich, Germany, Remote');
  assert.equal(j.isRemote, true);
  assert.equal(j.workplaceType, 'Remote');
});

test('normalizeFlowxtraJob: yields "Remote" when remote and no location fields', () => {
  const j = normalizeFlowxtraJob({ title: 'R', urlJobApplay: 'https://flowxtra.com/apply/R2', workplace: 'Remote' }, 'X');
  assert.equal(j.location, 'Remote');
});

test('normalizeFlowxtraJob: does not append "Remote" for non-remote workplace', () => {
  const j = normalizeFlowxtraJob({ title: 'O', urlJobApplay: 'https://flowxtra.com/apply/O1', city_company: 'Vienna', workplace: 'On-site' }, 'X');
  assert.equal(j.location, 'Vienna');
});

test('normalizeFlowxtraJob: company falls back → entry name → "Flowxtra"', () => {
  const fromEntry = normalizeFlowxtraJob({ title: 'T', urlJobApplay: 'https://flowxtra.com/apply/C1', name_company: '' }, 'Entry Name');
  const dflt = normalizeFlowxtraJob({ title: 'T', urlJobApplay: 'https://flowxtra.com/apply/C2' });
  assert.equal(fromEntry.company, 'Entry Name');
  assert.equal(dflt.company, 'Flowxtra');
});

test('normalizeFlowxtraJob: drops empty-title / no-url / non-https / off-host / relative / non-object', () => {
  const drops = [
    normalizeFlowxtraJob({ title: '', urlJobApplay: 'https://flowxtra.com/apply/D1' }),
    normalizeFlowxtraJob({ title: 'No URL' }),
    normalizeFlowxtraJob({ title: 'Insecure', urlJobApplay: 'http://flowxtra.com/apply/D3' }),
    normalizeFlowxtraJob({ title: 'Off host', urlJobApplay: 'https://evil.example/apply/D4' }),
    normalizeFlowxtraJob({ title: 'Relative', urlJobApplay: '/apply/D5' }),
    normalizeFlowxtraJob(null),
  ];
  assert.ok(drops.every((r) => r === null));
});

test('normalizeFlowxtraJob: empty date when date_share is absent/unparseable', () => {
  const noDate = normalizeFlowxtraJob({ title: 'T', urlJobApplay: 'https://flowxtra.com/apply/ND' });
  assert.equal(noDate.date, '');
});

// ---------------------------------------------------------------------------
// parseFlowxtra — page-level mapping + maxResults cap
// ---------------------------------------------------------------------------
test('parseFlowxtra: maps a page and drops invalid rows', () => {
  const json = { success: true, data: { data: [mkRow(1), mkRow(2), { title: '' }], next_page_url: null } };
  const jobs = parseFlowxtra(json, { fallbackCompany: 'X' });
  assert.equal(jobs.length, 2);
});

test('parseFlowxtra: honors maxResults', () => {
  const json = { success: true, data: { data: [mkRow(1), mkRow(2), mkRow(3)], next_page_url: null } };
  assert.equal(parseFlowxtra(json, { maxResults: 2 }).length, 2);
});

test('parseFlowxtra: empty/malformed page → []', () => {
  assert.deepEqual(parseFlowxtra({ wrong: true }), []);
  assert.deepEqual(parseFlowxtra(null), []);
  assert.deepEqual(parseFlowxtra({ data: { data: 'nope' } }), []);
});

// ---------------------------------------------------------------------------
// fetchFlowxtra — pagination, SSRF opts, caps, fail-soft
// ---------------------------------------------------------------------------
test('fetchFlowxtra: builds ?status=Live&per_page=100&page=N and stops after next_page_url null', async () => {
  const pages = {
    1: { success: true, data: { data: Array.from({ length: 100 }, (_, i) => mkRow(i)), next_page_url: 'https://app.flowxtra.com/api/central/jobs?page=2' } },
    2: { success: true, data: { data: [mkRow(100), mkRow(101), { title: '' }], next_page_url: null } },
  };
  const requested = [];
  const jobs = await fetchFlowxtra(JOBS_ENDPOINT, { fetchImpl: pagedFetchImpl(pages, requested), fallbackCompany: 'Flowxtra' });

  assert.equal(requested.length, 2);
  assert.equal(requested[0].url, 'https://app.flowxtra.com/api/central/jobs?status=Live&per_page=100&page=1');
  assert.equal(requested[1].url, 'https://app.flowxtra.com/api/central/jobs?status=Live&per_page=100&page=2');
  // 100 + 2 valid (empty-title row dropped)
  assert.equal(jobs.length, 102);
});

test('fetchFlowxtra: passes redirect:"error" + browser UA on every page (SSRF guard)', async () => {
  const pages = { 1: { success: true, data: { data: [mkRow(1)], next_page_url: null } } };
  const requested = [];
  await fetchFlowxtra(JOBS_ENDPOINT, { fetchImpl: pagedFetchImpl(pages, requested) });
  assert.ok(requested.every((r) => r.redirect === 'error'));
  assert.ok(requested.every((r) => typeof r.ua === 'string' && r.ua.includes('Mozilla/5.0')));
});

test('fetchFlowxtra: honors maxPages cap (stops even when next_page_url present)', async () => {
  const pages = {
    1: { success: true, data: { data: Array.from({ length: 100 }, (_, i) => mkRow(i)), next_page_url: 'https://app.flowxtra.com/api/central/jobs?page=2' } },
  };
  const requested = [];
  await fetchFlowxtra(JOBS_ENDPOINT, { fetchImpl: pagedFetchImpl(pages, requested), maxPages: 1 });
  assert.equal(requested.length, 1);
  assert.equal(requested[0].url, 'https://app.flowxtra.com/api/central/jobs?status=Live&per_page=100&page=1');
});

test('fetchFlowxtra: malformed page fails soft (stops, returns prior pages, no throw)', async () => {
  const pages = {
    1: { success: true, data: { data: Array.from({ length: 100 }, (_, i) => mkRow(i)), next_page_url: 'https://app.flowxtra.com/api/central/jobs?page=2' } },
    2: { wrong: true }, // malformed → stop gracefully
  };
  const requested = [];
  const jobs = await fetchFlowxtra(JOBS_ENDPOINT, { fetchImpl: pagedFetchImpl(pages, requested) });
  assert.equal(jobs.length, 100);
});

test('fetchFlowxtra: per-page fetch error fails soft (no throw)', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  const jobs = await fetchFlowxtra(JOBS_ENDPOINT, { fetchImpl });
  assert.deepEqual(jobs, []);
});

// ---------------------------------------------------------------------------
// assertFlowxtraUrl — host-lock
// ---------------------------------------------------------------------------
test('assertFlowxtraUrl: accepts a valid app.flowxtra.com URL', () => {
  const url = `${JOBS_ENDPOINT}?page=1`;
  assert.equal(assertFlowxtraUrl(url), url);
});

test('assertFlowxtraUrl: rejects non-HTTPS', () => {
  assert.throws(() => assertFlowxtraUrl('http://app.flowxtra.com/api/central/jobs'), /must use HTTPS/);
});

test('assertFlowxtraUrl: rejects wrong host', () => {
  assert.throws(() => assertFlowxtraUrl('https://evil.example/api/central/jobs'), /untrusted hostname/);
});

test('assertFlowxtraUrl: rejects invalid URL string', () => {
  assert.throws(() => assertFlowxtraUrl('not-a-url'), /invalid URL/);
});

test('fetchFlowxtra: host guard rejects a non-flowxtra base URL', async () => {
  await assert.rejects(
    () => fetchFlowxtra('https://evil.example/api/central/jobs', { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }),
    /untrusted hostname/,
  );
});

// ---------------------------------------------------------------------------
// adapter
// ---------------------------------------------------------------------------
test('adapter: id and label', () => {
  assert.equal(flowxtraAdapter.id, 'flowxtra');
  assert.equal(flowxtraAdapter.label, 'Flowxtra');
});

test('adapter: matches only provider=flowxtra', () => {
  assert.ok(flowxtraAdapter.matches({ provider: 'flowxtra' }));
  assert.equal(flowxtraAdapter.matches({ provider: 'himalayas' }), false);
  assert.equal(flowxtraAdapter.matches({ careers_url: 'https://app.flowxtra.com' }), false);
});

test('adapter: buildEndpoint defaults to JOBS_ENDPOINT', () => {
  assert.equal(flowxtraAdapter.buildEndpoint({ provider: 'flowxtra' }), JOBS_ENDPOINT);
});

test('adapter: buildEndpoint prefers flowxtra: then api: field', () => {
  const custom = 'https://app.flowxtra.com/api/central/jobs?per_page=50';
  assert.equal(flowxtraAdapter.buildEndpoint({ provider: 'flowxtra', flowxtra: custom }), custom);
  assert.equal(flowxtraAdapter.buildEndpoint({ provider: 'flowxtra', api: custom }), custom);
});
