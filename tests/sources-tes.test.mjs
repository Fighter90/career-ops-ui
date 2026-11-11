/**
 * Tes source — UK and international teaching jobs (tes.com/jobs), parent
 * career-ops `providers/tes.mjs` parity (#6685, CAR-257). The board fills from
 * one public, unauthenticated tRPC query on the same host:
 *
 *   GET https://www.tes.com/jobs/api/trpc/jobs.search?batch=1&input=<json>
 *
 * CI-isolated: no network, an injected fetchImpl serves canned pages; the
 * page-spacing sleep is injectable and recorded. Fictional schools and
 * postings only, in the shape the live tRPC search endpoint returned on
 * 2026-11-09.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  tesKeywords,
  buildTesSearchUrl,
  resolveMaxPages,
  tesPayload,
  tesSalary,
  tesVacancyUrl,
  parseTesJobs,
  fetchTes,
  assertTesUrl,
  BOARD_URL,
  meta,
} from '../server/lib/sources/tes.mjs';
import { tesAdapter } from '../server/lib/portals/adapters/tes.mjs';
import { ALL_ADAPTERS } from '../server/lib/portals/registry.mjs';

const PAGE_SIZE = 50;

/** One fictional row, as jobs.search returns it. */
function row(id, over = {}) {
  return {
    id,
    title: `Teacher of Mathematics ${id}`,
    promoted: false,
    shortDescription: 'Acme Academy seeks a teacher of mathematics.',
    displayLocation: 'Springfield, Exampleshire',
    displaySalary: '',
    contractTerms: ['Permanent'],
    contractTypes: ['Full Time'],
    canonicalUrl: `/jobs/vacancy/teacher-of-mathematics-springfield-${id}`,
    employer: { name: 'Acme Academy' },
    salary: { range: '£31,650 - £49,084 per year', description: '' },
    advert: { startDate: '2026-11-08T17:00:00.000Z', endDate: '2026-12-05T05:00:00.000Z' },
    application: { closeDate: '2026-12-05T05:00:00.000Z' },
    ...over,
  };
}

/** A tRPC batch response holding one page. */
function batch(jobs, totalPages = 1) {
  return [{ result: { data: { json: { numFound: jobs.length, jobs, sponsoredJobIds: [], currentPage: 1, totalPages } } } }];
}

const ids = (from, count) => Array.from({ length: count }, (_, i) => from + i);
const fullPage = (from, totalPages) => batch(ids(from, PAGE_SIZE).map((id) => row(id)), totalPages);

/**
 * An opts object whose fetchImpl serves `pages` in order and records every
 * call; every sleep is recorded. A trailing Error keeps being thrown, so a
 * retried 503 or transport error is one that retry cannot clear.
 */
function pagedFetch(pages, extra = {}) {
  const calls = [];
  const sleeps = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    // Beyond the scripted list the LAST element keeps being served (a trailing
    // Error keeps being thrown — a retried 503 stays one; a trailing page
    // feeds the max_pages cap test).
    const next = pages[Math.min(calls.length, pages.length) - 1];
    if (next instanceof Error) throw next;
    if (next === undefined) throw new Error(`unexpected request ${calls.length}: ${url}`);
    return { ok: true, json: async () => next };
  };
  const sleep = async (ms) => { sleeps.push(ms); };
  return { calls, sleeps, opts: { fetchImpl, sleep, ...extra } };
}

/** The decoded `input` of a recorded request. */
const inputOf = (url) => JSON.parse(new URL(url).searchParams.get('input'))['0'].json;

// ── meta / adapter contract ────────────────────────────────────────────────

test('meta: value/label/region; adapter registered in ALL_ADAPTERS', () => {
  assert.equal(meta.value, 'tes');
  assert.equal(meta.label, 'Tes');
  assert.equal(meta.region, 'en');
  assert.equal(tesAdapter.id, 'tes');
  assert.ok(ALL_ADAPTERS.some((a) => a.id === 'tes'), 'tes adapter must be registered in ALL_ADAPTERS');
});

test('adapter: matches ONLY provider=tes; never careers_url', () => {
  assert.ok(tesAdapter.matches({ provider: 'tes' }));
  assert.equal(tesAdapter.matches({ careers_url: 'https://www.tes.com/jobs/' }), false);
  assert.equal(tesAdapter.matches({}), false);
  assert.equal(tesAdapter.matches(null), false);
});

test('adapter.buildEndpoint: BOARD_URL by default; honors an on-host override; falls back off-host', () => {
  assert.equal(tesAdapter.buildEndpoint({ provider: 'tes' }), BOARD_URL);
  const mirror = 'https://www.tes.com/jobs/api/trpc/jobs.search?mirror=1';
  assert.equal(tesAdapter.buildEndpoint({ tes: mirror }), mirror);
  assert.equal(tesAdapter.buildEndpoint({ api: mirror }), mirror);
  // Off-host / non-https garbage never throws — falls back to the canonical board.
  assert.equal(tesAdapter.buildEndpoint({ api: 'https://evil.com/jobs' }), BOARD_URL);
  assert.equal(tesAdapter.buildEndpoint({ tes: 'http://www.tes.com/jobs/' }), BOARD_URL);
  assert.equal(tesAdapter.buildEndpoint({ tes: 'https://sub.tes.com/jobs/' }), BOARD_URL);
});

// ── assertTesUrl (SSRF host pin) ───────────────────────────────────────────

test('assertTesUrl: pins host to www.tes.com over HTTPS', () => {
  assert.equal(assertTesUrl('https://www.tes.com/jobs/'), 'https://www.tes.com/jobs/');
  assert.throws(() => assertTesUrl('https://evil.com/jobs'), /untrusted hostname/);
  assert.throws(() => assertTesUrl('http://www.tes.com/jobs/'), /must use HTTPS/);
  assert.throws(() => assertTesUrl('not a url'), /invalid URL/);
});

// ── keywords ───────────────────────────────────────────────────────────────

test('tesKeywords: trims, empty when unset; rejects bad values with a named error', () => {
  assert.equal(tesKeywords({}), '');
  assert.equal(tesKeywords({ keywords: null }), '');
  assert.equal(tesKeywords({ keywords: '  maths ' }), 'maths');
  for (const bad of [42, ['maths'], '   ', 'x'.repeat(101), 'maths\nphysics']) {
    assert.throws(() => tesKeywords({ name: 'Tes', keywords: bad }), /keywords in entry "Tes"/);
  }
});

// ── the request ────────────────────────────────────────────────────────────

test('buildTesSearchUrl: limit 50, siteCountry gb, sort date, page, every required filter key, batch=1', () => {
  const input = inputOf(buildTesSearchUrl('maths', 3));
  const f = input.filters;
  assert.equal(input.limit, PAGE_SIZE);
  assert.equal(input.siteCountry, 'gb');
  assert.equal(f.keywords, 'maths');
  assert.equal(f.page, 3);
  assert.equal(f.sort, 'date');
  assert.deepEqual(f.locations, []);
  assert.deepEqual(f.excludedLocations, []);
  for (const k of ['contractTerms', 'contractTypes', 'subjects', 'workplaces', 'positions', 'location']) {
    assert.ok(k in f.filters, `filters.filters.${k} required`);
  }
  const u = new URL(buildTesSearchUrl('', 1));
  assert.equal(u.origin, 'https://www.tes.com');
  assert.equal(u.pathname, '/jobs/api/trpc/jobs.search');
  assert.equal(u.searchParams.get('batch'), '1');
});

// ── resolveMaxPages ────────────────────────────────────────────────────────

test('resolveMaxPages: default when unset; honors a positive integer; capped at 400', () => {
  assert.equal(resolveMaxPages({}), 150);
  assert.equal(resolveMaxPages({ max_pages: 40 }), 40);
  assert.equal(resolveMaxPages({ max_pages: 0 }), 150);
  assert.equal(resolveMaxPages({ max_pages: -1 }), 150);
  assert.equal(resolveMaxPages({ max_pages: '40' }), 150);
  assert.equal(resolveMaxPages({ max_pages: 10_000 }), 400);
});

// ── tesPayload (envelope check) ────────────────────────────────────────────

test('tesPayload: reads [{ result: { data: { json } } }]; throws a descriptive error on drift', () => {
  const payload = tesPayload(batch([row(1)], 7));
  assert.equal(payload.jobs.length, 1);
  assert.equal(payload.totalPages, 7);
  // A tRPC error envelope names the problem.
  assert.throws(() => tesPayload([{ error: { json: { message: 'bad input' } } }]), /search endpoint returned an error.*bad input/);
  assert.throws(() => tesPayload({}), /unexpected search response/);
  assert.throws(() => tesPayload([{ result: { data: { json: { noJobs: true } } } }]), /unexpected search response/);
});

// ── salary ─────────────────────────────────────────────────────────────────

test('tesSalary: one currency, sign or ISO code; anything else is left off, never inferred', () => {
  assert.deepEqual(tesSalary('£31,650 - £49,084 per year'), { min: 31650, max: 49084, currency: 'GBP' });
  assert.deepEqual(tesSalary('£42,000 per year'), { min: 42000, max: 42000, currency: 'GBP' });
  assert.deepEqual(tesSalary('AED 9,000 - AED 12,000 per year'), { min: 9000, max: 12000, currency: 'AED' });
  assert.deepEqual(tesSalary('HK$30,000 - HK$40,000 per year'), { min: 30000, max: 40000, currency: 'HKD' });
  assert.deepEqual(tesSalary('€40,000 - €50,000 per annum'), { min: 40000, max: 50000, currency: 'EUR' });
  for (const bad of [
    '$50,000 - $60,000 per year', // a bare $ is USD/AUD/SGD — unknown
    '£25 per hour', '£30,000 - £35,000 pro rata', 'THB 50,000 - THB 80,000 per month',
    'AED 9,000 - USD 12,000 per year', '£49,084 - £31,650 per year', 'Competitive', null, 42,
  ]) {
    assert.equal(tesSalary(bad), undefined, `tesSalary(${JSON.stringify(bad)}) must be undefined`);
  }
});

// ── vacancy URL (SSRF pin on the row URL) ──────────────────────────────────

test('tesVacancyUrl: only a Tes vacancy path resolves; foreign/traversal/other paths are null', () => {
  assert.equal(tesVacancyUrl('/jobs/vacancy/teacher-of-mathematics-springfield-7'), 'https://www.tes.com/jobs/vacancy/teacher-of-mathematics-springfield-7');
  for (const bad of [
    'https://evil.example/jobs/vacancy/x-3',
    '//evil.example/jobs/vacancy/x-4',
    '/jobs/vacancy/../../admin-5',
    '/teaching-resource/x-6',
    null, 42,
  ]) {
    assert.equal(tesVacancyUrl(bad), null, `tesVacancyUrl(${JSON.stringify(bad)}) must be null`);
  }
});

// ── parseTesJobs ───────────────────────────────────────────────────────────

test('parseTesJobs: normalizes title/company/url/location/posted/closes/description into the web-ui job shape', () => {
  const [job] = parseTesJobs([row(7, { title: 'Head of Art &amp; Design', employer: { name: 'St Mary&#39;s School' } })], 'Tes');
  assert.equal(job.id, 'tes-7');
  assert.equal(job.title, 'Head of Art & Design');
  assert.equal(job.company, "St Mary's School");
  assert.equal(job.url, 'https://www.tes.com/jobs/vacancy/teacher-of-mathematics-springfield-7');
  assert.equal(job.location, 'Springfield, Exampleshire');
  assert.equal(job.date, '2026-11-08');
  assert.equal(job.closesAt, '2026-12-05');
  assert.equal(job.snippet, 'Acme Academy seeks a teacher of mathematics.');
  assert.equal(job.salary, '31650–49084 GBP');
  assert.equal(job.source, 'tes');
  assert.equal(job.isRemote, false);
});

test('parseTesJobs: falls back to the entry name and omits fields the row lacks (NaN-safe dates)', () => {
  const [bare] = parseTesJobs([row(8, {
    employer: null, salary: null, advert: { startDate: 'not a date' },
    application: {}, shortDescription: null,
  })], 'Tes');
  assert.equal(bare.company, 'Tes');
  assert.equal(bare.date, '');
  assert.equal(bare.closesAt, undefined);
  assert.equal(bare.salary, '');
  assert.equal(bare.snippet, '');
});

test('parseTesJobs: drops rows without a title or a Tes vacancy path (foreign, traversal, other paths)', () => {
  const kept = parseTesJobs([
    row(1),
    row(2, { title: '   ' }),
    row(3, { canonicalUrl: 'https://evil.example/jobs/vacancy/x-3' }),
    row(4, { canonicalUrl: '//evil.example/jobs/vacancy/x-4' }),
    row(5, { canonicalUrl: '/jobs/vacancy/../../admin-5' }),
    row(6, { canonicalUrl: '/teaching-resource/x-6' }),
    row(9, { canonicalUrl: null }),
    null,
    'row',
  ], 'Tes');
  assert.equal(kept.length, 1);
  assert.equal(kept[0].id, 'tes-1');
});

// ── the walk ───────────────────────────────────────────────────────────────

test('fetchTes: walks pages in date order, dedups by externalId, stops at a reported totalPages boundary', async () => {
  const { calls, sleeps, opts } = pagedFetch([fullPage(1, 2), batch(ids(101, 10).map((id) => row(id)), 2)]);
  const jobs = await fetchTes(BOARD_URL, opts);
  assert.equal(jobs.length, PAGE_SIZE + 10);
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [250]); // the inter-page delay, page 2 only
  // Page 2 request carried page: 2.
  assert.equal(inputOf(calls[1].url).filters.page, 2);
  // Dates descend (sort: date) — the first row is page 1's newest.
  assert.equal(jobs[0].id, 'tes-1');
  // Re-served rows are absorbed by the dedup.
  const dup = await fetchTes(BOARD_URL, pagedFetch([batch([row(1), row(1), row(2)])]).opts);
  assert.equal(dup.length, 2);
});

test('fetchTes: page-1 failure THROWS (dead board ≠ empty board), naming a 400 rejection', async () => {
  const err = new Error('HTTP 400 (url)');
  err.status = 400;
  await assert.rejects(
    () => fetchTes(BOARD_URL, pagedFetch([err]).opts),
    /tes: the search endpoint rejected the request input \(HTTP 400\)/,
  );
  await assert.rejects(
    () => fetchTes(BOARD_URL, pagedFetch([new Error('network down')]).opts),
    /network down/,
  );
});

test('fetchTes: a mid-walk failure keeps the pages already collected and tags the board partial', async () => {
  const { opts } = pagedFetch([fullPage(1, 3), new Error('mid-walk 503')]);
  const jobs = await fetchTes(BOARD_URL, opts);
  assert.equal(jobs.length, PAGE_SIZE);
  assert.ok(jobs.truncated, 'a truncated walk must carry the canonical truncated tag');
  assert.equal(jobs.truncated.reason, 'fetch-error');
  assert.equal(jobs.truncated.fetched, PAGE_SIZE);
});

test('fetchTes: max_pages cap on a full page warns and marks the board truncated with fetched/total', async () => {
  const seen = [];
  const origErr = console.error;
  console.error = (...a) => seen.push(a.join(' '));
  try {
    const { opts } = pagedFetch([fullPage(1, 9), fullPage(101, 9)], { company: { name: 'Tes', max_pages: 2 } });
    // fetchTes reads the entry from opts.company (the scanner threads the
    // portals.yml entry there). Two DISTINCT full pages, then the cap stops
    // the walk on a full page 3rd request never made.
    const jobs = await fetchTes(BOARD_URL, opts);
    assert.equal(jobs.length, 2 * PAGE_SIZE);
    assert.equal(jobs.truncated.reason, 'page-cap');
    assert.equal(jobs.truncated.fetched, 2 * PAGE_SIZE);
    assert.ok(seen.some((l) => /tes: Tes truncated at max_pages=2/.test(l)), `warning line: ${seen.join(' | ')}`);
  } finally {
    console.error = origErr;
  }
});

test('fetchTes: a short page ends the walk without a truncation tag (natural end)', async () => {
  const { opts } = pagedFetch([fullPage(1, 2), batch(ids(101, 10).map((id) => row(id)), 2)]);
  const jobs = await fetchTes(BOARD_URL, opts);
  assert.equal(jobs.length, PAGE_SIZE + 10);
  assert.equal(jobs.truncated, undefined);
});

test('fetchTes: an unrecognised page mid-walk keeps partials and tags the stop reason', async () => {
  const { opts } = pagedFetch([fullPage(1, 3), { totally: 'different' }]);
  const jobs = await fetchTes(BOARD_URL, opts);
  assert.equal(jobs.length, PAGE_SIZE);
  assert.equal(jobs.truncated.reason, 'unrecognised-page');
});

test('fetchTes: a probe budget (opts.maxPages) costs one request and never reads as a cap stop', async () => {
  const seen = [];
  const origErr = console.error;
  console.error = (...a) => seen.push(a.join(' '));
  try {
    const { calls, opts } = pagedFetch([fullPage(1, 9)]);
    const jobs = await fetchTes(BOARD_URL, { ...opts, maxPages: 1 });
    assert.equal(calls.length, 1);
    assert.equal(jobs.length, PAGE_SIZE);
    assert.equal(jobs.truncated, undefined, 'a deliberate probe stop is not a truncation');
    assert.ok(!seen.some((l) => /truncated at max_pages/.test(l)), 'no cap warning for a probe');
  } finally {
    console.error = origErr;
  }
});

test('fetchTes: SSRF — every request refuses a redirect (redirect: error) and the endpoint is host-pinned', async () => {
  const { calls, opts } = pagedFetch([batch([row(1)])]);
  await fetchTes(BOARD_URL, opts);
  assert.equal(calls[0].opts.redirect, 'error');
  await assert.rejects(
    () => fetchTes('https://evil.com/jobs/api/trpc/jobs.search', pagedFetch([batch([row(1)])]).opts),
    /untrusted hostname/,
  );
});
