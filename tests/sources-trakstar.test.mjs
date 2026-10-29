/**
 * Trakstar Hire source (upstream #6131 port) — CI-isolated suite.
 * Ported from the parent's trakstar provider cases: client extraction
 * (https + suffix + slug rules, reserved labels, look-alike hosts, the api:
 * Frontend URL), the page parse (title/url/location/description mapping,
 * hosted_url kept only on the client's own board host, total_count alias,
 * lone-surrogate id drop), and the pagination stop rules (offset walk to
 * meta.total; short page; empty page; repeated page; first-page failure
 * throws; later-page failure keeps partials; cap tags trakstarTruncated).
 * No network — parseTrakstarPage is pure; fetchTrakstar runs on a fake
 * fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractClient,
  resolveClient,
  resolveMaxPages,
  apiUrlFor,
  assertTrakstarUrl,
  jobLocation,
  parseTrakstarPage,
  fetchTrakstar,
  API_HOST,
  PAGE_SIZE,
  DEFAULT_MAX_PAGES,
  MAX_PAGES_CAP,
} from '../server/lib/sources/trakstar.mjs';
import { trakstarAdapter } from '../server/lib/portals/adapters/trakstar.mjs';
import { resolveAdapter, ALL_ADAPTERS } from '../server/lib/portals/registry.mjs';

const CLIENT = 'acme';
const BOARD = `https://${CLIENT}.hire.trakstar.com`;
const API = apiUrlFor(CLIENT);

const row = (id, extra = {}) => ({
  id,
  title: `Backend Engineer ${id}`,
  description: null,
  location: { city: 'Austin', state: 'TX', country: 'US', zipcode: '00000' },
  allows_remote: false,
  hosted_url: `https://${CLIENT}.hire.trakstar.com/jobs/${id}/`,
  close_date: '2026-12-01T00:00:00Z',
  ...extra,
});
const many = (start, n, extra) => Array.from({ length: n }, (_, i) => row(`j${start + i}`, extra));
const page = (objects, total = objects.length) => ({ meta: { offset: 0, limit: PAGE_SIZE, total }, objects });

// ── registry + adapter contract ──────────────────────────────────────────────

test('trakstar: meta — value, label, region en', async () => {
  const { meta } = await import('../server/lib/sources/trakstar.mjs');
  assert.deepEqual(meta, { value: 'trakstar', label: 'Trakstar Hire', region: 'en' });
  assert.equal(trakstarAdapter.id, 'trakstar');
  assert.equal(trakstarAdapter.label, 'Trakstar Hire');
});

test('trakstar: the adapter is registered in ALL_ADAPTERS', () => {
  assert.ok(ALL_ADAPTERS.some((a) => a.id === 'trakstar'), 'trakstar missing from ALL_ADAPTERS');
});

test('trakstar: adapter resolves a hire.trakstar.com board via the registry', () => {
  const m = resolveAdapter({ name: 'Acme', careers_url: BOARD });
  assert.ok(m);
  assert.equal(m.adapter.id, 'trakstar');
  assert.equal(m.endpoint, API);
});

// ── extractClient / resolveClient ────────────────────────────────────────────

test('trakstar: extractClient claims the board hosts and the Frontend API URL', () => {
  assert.equal(extractClient(BOARD), CLIENT);
  assert.equal(extractClient(`${BOARD}/jobs/abc123/`), CLIENT, 'a posting URL on the board host');
  assert.equal(extractClient('https://Acme.hire.trakstar.com/'), CLIENT, 'mixed case is lowercased');
  assert.equal(extractClient(`https://${CLIENT}.recruiterbox.com/jobs`), CLIENT, 'legacy recruiterbox host');
  assert.equal(extractClient(`${API}&limit=2`), CLIENT, 'Frontend API URL');
  assert.equal(extractClient('https://jsapi.recruiterbox.com/v1/openings/?client_name=acme'), CLIENT, 'trailing slash on the API path');
  assert.equal(extractClient('not a url'), null);
  assert.equal(extractClient(null), null);
  assert.equal(extractClient(42), null);
  assert.equal(extractClient(''), null);
});

test('trakstar: extractClient rejects look-alike and reserved hosts', () => {
  assert.equal(extractClient(`http://${CLIENT}.hire.trakstar.com`), null, 'non-https');
  assert.equal(extractClient(`https://${CLIENT}.hire.trakstar.com.evil.example`), null, 'look-alike host');
  assert.equal(extractClient('https://eviltrakstar.com'), null, 'suffix look-alike host');
  assert.equal(extractClient('https://hire.trakstar.com'), null, 'apex host with no client');
  assert.equal(extractClient('https://www.hire.trakstar.com'), null, 'reserved www label');
  assert.equal(extractClient('https://jsapi.recruiterbox.com'), null, 'reserved jsapi label');
  assert.equal(extractClient('https://jobs.acme.hire.trakstar.com'), null, 'extra subdomain label');
  assert.equal(extractClient('https://jsapi.recruiterbox.com/v1/openings'), null, 'API URL with no client_name');
  assert.equal(extractClient('https://jsapi.recruiterbox.com/v1/candidates?client_name=acme'), null, 'a different API path');
  assert.equal(extractClient('https://acme_corp.hire.trakstar.com'), null, 'an underscore label is not a slug');
  assert.equal(extractClient('https://-bad.hire.trakstar.com'), null, 'a leading hyphen is not a slug');
});

test('trakstar: resolveClient — api: wins over a branded careers_url; entry itself is null-guarded', () => {
  assert.equal(resolveClient({ api: `${API}&limit=2` }), CLIENT);
  assert.equal(resolveClient({ careers_url: 'https://careers.example.test/jobs', api: API }), CLIENT, 'api over a branded careers page');
  assert.equal(resolveClient({ careers_url: BOARD }), CLIENT);
  assert.equal(resolveClient({}), null);
  assert.equal(resolveClient(null), null);
});

test('trakstar: apiUrlFor — page-1 URL on the pinned host', () => {
  assert.equal(apiUrlFor(CLIENT), `https://${API_HOST}/v1/openings?client_name=${CLIENT}`);
});

test('trakstar: resolveMaxPages — positive integer, capped at 50', () => {
  assert.equal(resolveMaxPages({}), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 3 }), 3);
  assert.equal(resolveMaxPages({ max_pages: 10_000 }), MAX_PAGES_CAP);
  assert.equal(resolveMaxPages({ max_pages: -1 }), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 0 }), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: '5' }), DEFAULT_MAX_PAGES, 'a non-integer is ignored, not trusted');
});

// ── assertTrakstarUrl (host pin) ─────────────────────────────────────────────

test('trakstar: assertTrakstarUrl pins https + default port + the exact API host', () => {
  assert.equal(assertTrakstarUrl(API), API);
  assert.throws(() => assertTrakstarUrl('http://jsapi.recruiterbox.com/v1/openings?client_name=acme'), /must use HTTPS/);
  assert.throws(() => assertTrakstarUrl(`https://evil.example/v1/openings?client_name=${CLIENT}`), /untrusted hostname/);
  assert.throws(() => assertTrakstarUrl(`https://jsapi.recruiterbox.com:8443/v1/openings?client_name=${CLIENT}`), /non-default port/);
  assert.throws(() => assertTrakstarUrl('not a url'), /invalid URL/);
});

// ── jobLocation ──────────────────────────────────────────────────────────────

test('trakstar: jobLocation — city/state/country joined; Remote with and without a place', () => {
  assert.equal(jobLocation(row('a')), 'Austin, TX, US');
  assert.equal(jobLocation({ allows_remote: true, location: { city: 'Berlin' } }), 'Remote (Berlin)');
  assert.equal(jobLocation({ allows_remote: true, location: {} }), 'Remote');
  assert.equal(jobLocation({ allows_remote: false, location: { zipcode: '00000' } }), '', 'zipcode is not a place');
  assert.equal(jobLocation({}), '');
  assert.equal(jobLocation(null), '');
});

// ── parseTrakstarPage ────────────────────────────────────────────────────────

test('trakstar: parseTrakstarPage — maps title, hosted_url, location, description; drops junk rows', () => {
  const parsed = parseTrakstarPage(page([
    row('aaa', { description: '<p>Build <strong>apis</strong> and ship</p>' }),
    row('bbb', { allows_remote: true, location: { city: null, state: null, country: null } }),
    row('ccc', { title: '   ' }),
    row('ddd', { hosted_url: 'http://acme.hire.trakstar.com/jobs/ddd/' }),
    row('eee', { hosted_url: 'https://evil.example/jobs/eee/' }),
    null,
    'junk',
  ], 7), 'Acme', CLIENT);
  assert.equal(parsed.rawCount, 7, 'the raw count keeps the junk rows');
  assert.equal(parsed.total, 7);
  assert.equal(parsed.jobs.length, 4);
  const [j1, j2, j4, j5] = parsed.jobs;
  assert.deepEqual(
    { title: j1.title, url: j1.url, company: j1.company, location: j1.location, description: j1.description },
    { title: 'Backend Engineer aaa', url: `https://${CLIENT}.hire.trakstar.com/jobs/aaa/`, company: 'Acme', location: 'Austin, TX, US', description: 'Build apis and ship' },
  );
  assert.equal(j2.location, 'Remote', 'a remote opening with no place is just "Remote"');
  assert.equal('description' in j2, false, 'a null description is omitted');
  assert.equal(j4.url, `https://${CLIENT}.hire.trakstar.com/jobs/ddd/`, 'a non-https hosted_url is rebuilt on the board host');
  assert.equal(j5.url, `https://${CLIENT}.hire.trakstar.com/jobs/eee/`, 'an off-host hosted_url is rebuilt on the board host');
  for (const j of parsed.jobs) {
    assert.equal('postedAt' in j, false, 'close_date is not a posted date');
  }
});

test('trakstar: parseTrakstarPage — a https hosted_url on the LEGACY host is kept', () => {
  const parsed = parseTrakstarPage(page([
    row('bbb', { hosted_url: `https://${CLIENT}.recruiterbox.com/jobs/bbb/` }),
  ]), 'Acme', CLIENT);
  assert.equal(parsed.jobs[0].url, `https://${CLIENT}.recruiterbox.com/jobs/bbb/`);
});

test('trakstar: parseTrakstarPage — reads meta.total_count when meta.total is absent', () => {
  const parsed = parseTrakstarPage({ meta: { total_count: 4 }, objects: [row('z1')] }, 'Acme', CLIENT);
  assert.equal(parsed.total, 4);
});

test('trakstar: parseTrakstarPage — a lone-surrogate id drops the one posting, keeps the page', () => {
  const LONE = '\uD800';
  const survived = parseTrakstarPage(page([
    row(`${LONE}bad`, { hosted_url: 'https://evil.example/nope' }),
    row('good1'),
  ]), 'Acme', CLIENT);
  assert.equal(survived.jobs.length, 1);
  assert.equal(survived.jobs[0].url, `https://${CLIENT}.hire.trakstar.com/jobs/good1/`);
});

test('trakstar: parseTrakstarPage — a present-and-empty objects array is a valid empty board', () => {
  assert.equal(parseTrakstarPage(page([]), 'Acme', CLIENT).jobs.length, 0);
});

test('trakstar: parseTrakstarPage — a malformed 200 throws (page-1 shape gate)', () => {
  for (const [body, label] of [
    [{}, 'an object without objects'],
    [{ objects: null }, 'objects: null'],
    [{ objects: {} }, 'objects: {}'],
    [{ jobs: [] }, 'a different key'],
    ['', 'an empty body'],
    [42, 'a number'],
    [null, 'null'],
    [[], 'an array'],
  ]) {
    assert.throws(() => parseTrakstarPage(body, 'Acme', CLIENT), /trakstar/, `throws on ${label}`);
  }
});

// ── fetchTrakstar ────────────────────────────────────────────────────────────

/** A fake fetchImpl over canned pages, recording every URL + opts. */
function recorder(pagesByCall, { failAfter } = {}) {
  const calls = [];
  const fetchImpl = async (url, o) => {
    calls.push({ url, opts: o });
    if (failAfter !== undefined && calls.length > failAfter) {
      const err = new Error('upstream 503');
      err.status = 503;
      throw err;
    }
    const body = pagesByCall[Math.min(calls.length - 1, pagesByCall.length - 1)];
    const payload = typeof body === 'function' ? body(calls.length) : body;
    return { ok: true, status: 200, json: async () => payload };
  };
  return { calls, fetchImpl };
}

test('trakstar: fetchTrakstar — rejects an unrecognised URL before any request', async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchTrakstar(API, {
      fetchImpl: async () => { calls += 1; return page([]); },
      company: { name: 'Acme', careers_url: 'https://careers.example.test/jobs' },
      delayMs: 0,
    }),
    /cannot derive the client name/,
  );
  assert.equal(calls, 0, 'no request was made');
});

test('trakstar: fetchTrakstar — walks offset to meta.total, 100 per page, redirect:"error" everywhere', async () => {
  const { calls, fetchImpl } = recorder([page(many(1, 100), 150), page(many(101, 50), 150)]);
  const jobs = await fetchTrakstar(API, { fetchImpl, company: { name: 'Acme', careers_url: BOARD }, delayMs: 0 });
  assert.equal(jobs.length, 150);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, `${API}&limit=${PAGE_SIZE}&offset=0`);
  assert.equal(calls[1].url, `${API}&limit=${PAGE_SIZE}&offset=${PAGE_SIZE}`);
  for (const c of calls) assert.equal(c.opts.redirect, 'error', 'every request refuses redirects');
  assert.equal(jobs.trakstarTruncated, undefined);
  assert.ok(jobs.every((j) => j.source === 'trakstar' && j.company === 'Acme'));
});

test('trakstar: fetchTrakstar — stops when seen rows reach meta.total even if the page is full', async () => {
  const { calls, fetchImpl } = recorder([page(many(1, 100), 40), page(many(201, 100), 40)]);
  const jobs = await fetchTrakstar(API, { fetchImpl, company: { name: 'Acme', careers_url: BOARD }, delayMs: 0 });
  assert.equal(jobs.length, 100);
  assert.equal(calls.length, 1);
  assert.equal(jobs.trakstarTruncated, undefined);
});

test('trakstar: fetchTrakstar — stops on a short page', async () => {
  const { calls, fetchImpl } = recorder([page(many(1, 100), 500), page(many(500, 20), 500)]);
  const jobs = await fetchTrakstar(API, { fetchImpl, company: { name: 'Acme', careers_url: BOARD }, delayMs: 0 });
  assert.equal(jobs.length, 120);
  assert.equal(calls.length, 2);
  assert.equal(jobs.trakstarTruncated, undefined);
});

test('trakstar: fetchTrakstar — a zero delayMs short-circuits the inter-page wait', async () => {
  const { calls, fetchImpl } = recorder([page(many(1, 100), 500), page(many(500, 20), 500)]);
  const jobs = await fetchTrakstar(API, { fetchImpl, company: { name: 'Acme', careers_url: BOARD }, delayMs: 0 });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 120);
});

test('trakstar: fetchTrakstar — stops when a page repeats', async () => {
  const { calls, fetchImpl } = recorder([page(many(1, 100), 9000)]);
  const jobs = await fetchTrakstar(API, { fetchImpl, company: { name: 'Acme', careers_url: BOARD }, delayMs: 0 });
  assert.equal(jobs.length, 100);
  assert.equal(calls.length, 2);
  assert.equal(jobs.trakstarTruncated, undefined, 'a repeated page is a feed quirk, not a truncation');
});

test('trakstar: fetchTrakstar — stops on an empty page', async () => {
  const { calls, fetchImpl } = recorder([page(many(1, 100), 500), page([], 500)]);
  const jobs = await fetchTrakstar(API, { fetchImpl, company: { name: 'Acme', careers_url: BOARD }, delayMs: 0 });
  assert.equal(jobs.length, 100);
  assert.equal(calls.length, 2);
  assert.equal(jobs.trakstarTruncated, undefined);
});

test('trakstar: fetchTrakstar — dedups a repeated URL within the sweep', async () => {
  const dup = row('dup');
  const { fetchImpl } = recorder([
    page([...many(1, 99), dup], 500),
    page([...many(500, 20), { ...dup, title: 'Same again' }], 500),
  ]);
  const jobs = await fetchTrakstar(API, { fetchImpl, company: { name: 'Acme', careers_url: BOARD }, delayMs: 0 });
  assert.equal(jobs.filter((j) => j.url === dup.hosted_url).length, 1, 'the duplicate URL appears once');
  assert.equal(jobs.length, 120);
});

test('trakstar: fetchTrakstar — caps pagination at DEFAULT_MAX_PAGES and tags the board', async () => {
  // A different page of ids on every call — a repeated page is a different
  // stop rule (tested above); the cap needs a feed that never ends.
  const { calls, fetchImpl } = recorder([(n) => page(many(n * 1000, 100), 1_000_000)]);
  const jobs = await fetchTrakstar(API, { fetchImpl, company: { name: 'Acme', careers_url: BOARD }, delayMs: 0 });
  assert.equal(calls.length, DEFAULT_MAX_PAGES);
  assert.equal(jobs.length, DEFAULT_MAX_PAGES * PAGE_SIZE);
  assert.equal(jobs.trakstarTruncated, true, 'a board cut by the cap is PARTIAL, never a quiet slice');
});

test('trakstar: fetchTrakstar — a short page at the cap is complete, not a cap stop', async () => {
  const { calls, fetchImpl } = recorder([
    page(many(1, 100), 140),
    page(many(200, 40), 140),
  ]);
  const jobs = await fetchTrakstar(API, {
    fetchImpl,
    company: { name: 'Acme', careers_url: BOARD, max_pages: 2 },
    delayMs: 0,
  });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 140);
  assert.equal(jobs.trakstarTruncated, undefined);
});

test('trakstar: fetchTrakstar — caps an oversized max_pages at MAX_PAGES_CAP', async () => {
  const { calls, fetchImpl } = recorder([(n) => page(many(n * 1000, 100), 1_000_000)]);
  await fetchTrakstar(API, {
    fetchImpl,
    company: { name: 'Acme', careers_url: BOARD, max_pages: 10_000 },
    delayMs: 0,
  });
  assert.equal(calls.length, MAX_PAGES_CAP);
});

test('trakstar: fetchTrakstar — keeps page 1 when a later page fails and tags the board', async () => {
  const { calls, fetchImpl } = recorder([page(many(1, 100), 250)], { failAfter: 1 });
  const jobs = await fetchTrakstar(API, { fetchImpl, company: { name: 'Acme', careers_url: BOARD }, delayMs: 0 });
  // Local retry budget (fetchJsonWithRetry default): page 2 spends its full
  // budget — 1 attempt + 2 retries — before the partials are kept.
  assert.equal(jobs.length, 100);
  assert.equal(calls.length, 4, 'page 1 once + page 2 three times (1 attempt + 2 retries)');
  assert.equal(jobs.trakstarTruncated, true);
});

test('trakstar: fetchTrakstar — keeps page 1 when a later page has a malformed envelope', async () => {
  const { calls, fetchImpl } = recorder([page(many(1, 100), 250), { error: 'maintenance' }]);
  const jobs = await fetchTrakstar(API, { fetchImpl, company: { name: 'Acme', careers_url: BOARD }, delayMs: 0 });
  assert.equal(jobs.length, 100);
  assert.equal(calls.length, 2);
  assert.equal(jobs.trakstarTruncated, true);
  await assert.rejects(
    () => fetchTrakstar(API, {
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ error: 'maintenance' }) }),
      company: { name: 'Acme', careers_url: BOARD },
      delayMs: 0,
    }),
    /trakstar/,
    'a malformed FIRST page throws — there is no board',
  );
});

test('trakstar: fetchTrakstar — throws a first-page 400 without retrying it', async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchTrakstar(API, {
      fetchImpl: async () => {
        calls += 1;
        const err = new Error('Invalid client name');
        err.status = 400;
        throw err;
      },
      company: { name: 'Acme', careers_url: BOARD },
      delayMs: 0,
    }),
  );
  assert.equal(calls, 1, 'a permanent 4xx is never retried');
});

test('trakstar: fetchTrakstar — honours the injected signal (aborted before a page fails loud)', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => fetchTrakstar(API, {
      fetchImpl: async () => page([]),
      signal: controller.signal,
      company: { name: 'Acme', careers_url: BOARD },
      delayMs: 0,
    }),
    /aborted|AbortError/i,
  );
});
