/**
 * Dover source (v1.253.0 parent parity) — CI-isolated suite.
 * Ported from the parent's dover provider cases: board resolution (UUID
 * regex, https + host pin, decoded company segment), the DRF page parse
 * (is_published/is_sample drops, primary-first locations, "Remote
 * (International)" rendering, surrogate-safe id segment, hasNext), the
 * max_pages cap, and the pagination stop rules (first-page failure throws;
 * later-page failure keeps partials; cap tags doverTruncated; a short page
 * or a missing `next` ends the sweep). No network — parseDoverPage is pure;
 * fetchDover runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDoverPage,
  resolveBoard,
  resolveMaxPages,
  apiUrlFor,
  assertDoverUrl,
  fetchDover,
  PAGE_SIZE,
  DEFAULT_MAX_PAGES,
  MAX_PAGES_CAP,
  HOST,
} from '../server/lib/sources/dover.mjs';
import { doverAdapter } from '../server/lib/portals/adapters/dover.mjs';
import { atlassianAdapter } from '../server/lib/portals/adapters/atlassian.mjs';

const UUID = '0f0e9d8c-7b6a-5432-1098-76543210fedc';
const CAREERS_URL = `https://app.dover.com/Acme/careers/${UUID}`;
const ENTRY = { name: 'Acme', provider: 'dover', careers_url: CAREERS_URL };

const result = (i, extra = {}) => ({ id: `job-${i}`, title: `Role ${i}`, locations: [], ...extra });
const page = (results, next = '') => ({ count: results.length, next, previous: null, results });
const fullPage = (offset, withNext = true) => page(
  Array.from({ length: PAGE_SIZE }, (_, i) => result(offset + i)),
  withNext ? `https://${HOST}/api/v1/careers-page/${UUID}/jobs?limit=${PAGE_SIZE}&offset=${offset + PAGE_SIZE}` : '',
);

test('dover: resolveBoard — https + host + <company>/careers/<uuid> only', () => {
  assert.deepEqual(resolveBoard(ENTRY), { company: 'Acme', board: UUID });
  assert.deepEqual(
    resolveBoard({ careers_url: `https://app.dover.com/Acme/careers/${UUID.toUpperCase()}` }),
    { company: 'Acme', board: UUID },
    'the board is normalised to lowercase');
  assert.deepEqual(
    resolveBoard({ careers_url: `https://app.dover.com/Acme%20Corp/careers/${UUID}` }),
    { company: 'Acme Corp', board: UUID },
    'the company segment is decoded');
  assert.equal(resolveBoard({ careers_url: `http://app.dover.com/Acme/careers/${UUID}` }), null, 'http is refused');
  assert.equal(resolveBoard({ careers_url: `https://evil.com/Acme/careers/${UUID}` }), null, 'foreign host refused');
  assert.equal(resolveBoard({ careers_url: `https://app.dover.com/Acme/jobs/${UUID}` }), null, 'wrong path marker');
  assert.equal(resolveBoard({ careers_url: 'https://app.dover.com/Acme/careers/not-a-uuid' }), null);
  assert.equal(resolveBoard({ careers_url: 'https://app.dover.com/careers' }), null);
  assert.equal(resolveBoard({ careers_url: 'not a url' }), null);
  assert.equal(resolveBoard({}), null);
  assert.equal(resolveBoard(null), null);
});

test('dover: resolveMaxPages — positive integer, capped at 20', () => {
  assert.equal(resolveMaxPages({}), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 3 }), 3);
  assert.equal(resolveMaxPages({ max_pages: 9999 }), MAX_PAGES_CAP);
  assert.equal(resolveMaxPages({ max_pages: -1 }), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 0 }), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: '5' }), DEFAULT_MAX_PAGES, 'a non-integer is ignored, not trusted');
});

test('dover: apiUrlFor — limit/offset pagination on the pinned host', () => {
  assert.equal(
    apiUrlFor(UUID, 0),
    `https://${HOST}/api/v1/careers-page/${UUID}/jobs?limit=${PAGE_SIZE}&offset=0`);
  assert.equal(
    apiUrlFor(UUID, 2),
    `https://${HOST}/api/v1/careers-page/${UUID}/jobs?limit=${PAGE_SIZE}&offset=${PAGE_SIZE * 2}`);
});

test('dover: parseDoverPage — valid rows build the apply URL from the careers_url company', () => {
  const { jobs, rawCount, hasNext } = parseDoverPage(
    page([result(1), result(2)]),
    { companyName: 'Acme', companySegment: 'Acme' });
  assert.equal(rawCount, 2);
  assert.equal(hasNext, false);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Role 1');
  assert.equal(jobs[0].url, `https://${HOST}/apply/Acme/job-1`);
  assert.equal(jobs[0].company, 'Acme');
});

test('dover: parseDoverPage — a percent-encoded id stays in the URL, a lone surrogate drops the row', () => {
  const { jobs } = parseDoverPage(
    page([result(1, { id: 'a/b c' }), result(2, { id: '\uD800lone' }), result(3, { id: 42 })]),
    { companyName: 'Acme', companySegment: 'Acme' });
  assert.equal(jobs.length, 1, 'surrogate and non-string ids drop just their row');
  assert.equal(jobs[0].url, `https://${HOST}/apply/Acme/a%2Fb%20c`);
});

test('dover: parseDoverPage — unpublished and sample rows are dropped', () => {
  const { jobs } = parseDoverPage(
    page([
      result(1, { is_published: false }),
      result(2, { is_sample: true }),
      result(3),
    ]),
    { companyName: 'Acme', companySegment: 'Acme' });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Role 3');
});

test('dover: parseDoverPage — locations render primary-first, deduped, " · "-joined', () => {
  const { jobs } = parseDoverPage(
    page([result(1, {
      locations: [
        { location_type: 'ONSITE', name: 'Berlin Office', is_primary: false },
        { location_type: 'ONSITE', location_option: { display_name: 'Berlin, Germany' }, is_primary: true },
        { location_type: 'ONSITE', location_option: { display_name: 'Berlin, Germany' }, is_primary: false },
        'garbage',
      ],
    })]),
    { companyName: 'Acme', companySegment: 'Acme' });
  assert.equal(jobs[0].location, 'Berlin, Germany · Berlin Office');
});

test('dover: parseDoverPage — worldwide remote renders "Remote (International)", never a US city', () => {
  const { jobs } = parseDoverPage(
    page([result(1, {
      locations: [{ location_type: 'REMOTE', location_option: { display_name: 'International', country: 'US' } }],
    })]),
    { companyName: 'Acme', companySegment: 'Acme' });
  assert.equal(jobs[0].location, 'Remote (International)');
});

test('dover: parseDoverPage — hybrid and workplace_type fallbacks', () => {
  const { jobs } = parseDoverPage(
    page([
      result(1, { locations: [{ location_type: 'HYBRID', location_option: { display_name: 'London, UK' } }] }),
      result(2, { workplace_type: 'REMOTE' }),
      result(3, { locations: [{ location_type: 'REMOTE' }], workplace_type: 'REMOTE' }),
    ]),
    { companyName: 'Acme', companySegment: 'Acme' });
  assert.equal(jobs[0].location, 'London, UK (Hybrid)');
  assert.equal(jobs[1].location, 'Remote', 'no locations + workplace REMOTE reads as Remote');
  assert.equal(jobs[2].location, 'Remote', 'a placeless REMOTE location renders bare Remote');
});

test('dover: parseDoverPage — a non-DRF envelope throws naming what arrived', () => {
  assert.throws(
    () => parseDoverPage({ count: 5 }, { companyName: 'Acme', companySegment: 'Acme' }),
    /expected results\[\], got: \[count\]/);
  assert.throws(
    () => parseDoverPage('login page', { companyName: 'Acme', companySegment: 'Acme' }),
    /got: \[string\]/);
  assert.throws(
    () => parseDoverPage(null, { companyName: 'Acme', companySegment: 'Acme' }),
    /dover: unexpected response/);
});

test('dover: hasNext follows json.next', () => {
  assert.equal(parseDoverPage(page([], 'https://x'), { companyName: 'A', companySegment: 'A' }).hasNext, true);
  assert.equal(parseDoverPage(page([], ''), { companyName: 'A', companySegment: 'A' }).hasNext, false);
  assert.equal(parseDoverPage(page([result(1)]), { companyName: 'A', companySegment: 'A' }).hasNext, false);
});

test('dover: assertDoverUrl — HTTPS on the API host only', () => {
  assert.equal(assertDoverUrl(apiUrlFor(UUID, 0)), apiUrlFor(UUID, 0));
  assert.throws(() => assertDoverUrl(`http://${HOST}/api/v1/careers-page/x/jobs`), /must use HTTPS/);
  assert.throws(() => assertDoverUrl('https://evil.example/jobs'), /untrusted hostname/);
  assert.throws(() => assertDoverUrl('not a url'), /invalid URL/);
});

test('dover: fetchDover — the first page failing means there is no board', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}) }; };
  await assert.rejects(
    () => fetchDover(apiUrlFor(UUID, 0), { fetchImpl, company: ENTRY, delayMs: 0 }),
    /HTTP 404/);
  assert.equal(calls, 1, 'a permanent 4xx is not retried');
});

test('dover: fetchDover — a later page failing keeps the collected jobs (partials, not a flag)', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return { ok: true, status: 200, json: async () => fullPage(0) };
    return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) };
  };
  const jobs = await fetchDover(apiUrlFor(UUID, 0), { fetchImpl, company: ENTRY, delayMs: 0, retries: 0 });
  assert.equal(calls, 2);
  assert.equal(jobs.length, PAGE_SIZE, 'page-1 jobs kept');
  assert.equal(jobs.doverTruncated, undefined, 'an error stop is not a cap truncation');
});

test('dover: fetchDover — a short page (raw count, before filtering) ends the sweep', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => page(Array.from({ length: 12 }, (_, i) => result(i)), 'https://next'),
    };
  };
  const jobs = await fetchDover(apiUrlFor(UUID, 0), { fetchImpl, company: ENTRY, delayMs: 0 });
  assert.equal(calls, 1);
  assert.equal(jobs.length, 12);
  assert.equal(jobs.doverTruncated, undefined);
});

test('dover: fetchDover — a missing `next` ends the sweep on a full page', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => fullPage(0, false) };
  };
  const jobs = await fetchDover(apiUrlFor(UUID, 0), { fetchImpl, company: ENTRY, delayMs: 0 });
  assert.equal(calls, 1);
  assert.equal(jobs.length, PAGE_SIZE);
});

test('dover: fetchDover — exhausting max_pages tags the array doverTruncated (partial board)', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => fullPage((calls - 1) * PAGE_SIZE) };
  };
  const jobs = await fetchDover(apiUrlFor(UUID, 0), {
    fetchImpl, company: { ...ENTRY, max_pages: 2 }, delayMs: 0,
  });
  assert.equal(calls, 2);
  assert.equal(jobs.length, PAGE_SIZE * 2);
  assert.equal(jobs.doverTruncated, true, 'the cap stopped the sweep — the board is partial');
});

test('dover: fetchDover — a short last-allowed page is a natural end, not a cap stop', async () => {
  // Page 2 (the last allowed) is short → the natural-end break fires without
  // incrementing page, so the sweep must NOT read as a ceiling stop.
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => (calls === 1 ? fullPage(0) : page([result(999)])) };
  };
  const jobs = await fetchDover(apiUrlFor(UUID, 0), {
    fetchImpl, company: { ...ENTRY, max_pages: 2 }, delayMs: 0,
  });
  assert.equal(calls, 2);
  assert.equal(jobs.length, PAGE_SIZE + 1);
  assert.equal(jobs.doverTruncated, undefined);
});

test('dover: fetchDover — normalized rows carry the web-ui shape', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => page([result(1, { title: 'Remote Platform Engineer' })]),
  });
  const jobs = await fetchDover(apiUrlFor(UUID, 0), { fetchImpl, company: ENTRY, delayMs: 0 });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, `dover-https://${HOST}/apply/Acme/job-1`);
  assert.equal(jobs[0].source, 'dover');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].date, '');
});

test('dover: fetchDover — an entry without a resolvable board rejects before any request', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  await assert.rejects(
    () => fetchDover(apiUrlFor(UUID, 0), { fetchImpl, company: { name: 'Acme', careers_url: 'https://app.dover.com/Acme' }, delayMs: 0 }),
    /cannot derive the app\.dover\.com board/);
});

test('dover adapter: buildEndpoint resolves the board URL, else null', () => {
  assert.equal(doverAdapter.buildEndpoint(ENTRY), apiUrlFor(UUID, 0));
  assert.equal(doverAdapter.buildEndpoint({ provider: 'dover', careers_url: 'https://app.dover.com/Acme' }), null);
  assert.equal(doverAdapter.buildEndpoint({ provider: 'dover' }), null);
  assert.equal(doverAdapter.matches(ENTRY), true);
  assert.equal(doverAdapter.matches({ provider: 'greenhouse' }), false);
});

test('atlassian adapter: fixed feed endpoint, provider-selected only', () => {
  assert.equal(atlassianAdapter.matches({ provider: 'atlassian' }), true);
  assert.equal(atlassianAdapter.matches({ provider: 'dover' }), false);
  assert.equal(atlassianAdapter.buildEndpoint({}), 'https://www.atlassian.com/endpoint/careers/listings');
});
