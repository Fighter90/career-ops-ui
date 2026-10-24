/**
 * Platsbanken source (v1.253.0 parent parity) — CI-isolated suite.
 * Ported from the parent's platsbanken provider cases: the `platsbanken:`
 * config block, search-URL build (q/limit/offset), the posting permalink
 * rebuilt from the ad id on a fixed literal host (surrogate-safe), the
 * JobSearch envelope parse (hits[] required — a changed envelope throws
 * naming the keys; a malformed row is skipped; city→municipality→region→
 * country location), the host/port pin, the 21-page source ceiling, and the
 * pagination rules (a pre-aborted scan throws; a page-1 failure marks the
 * keyword failed while ALL keywords failing throws; a later-page failure or
 * envelope throw keeps the partials; a short RAW page ends the walk; a cap
 * stop tags platsbankenTruncated). No network — parsePlatsbankenResponse is
 * pure; fetchPlatsbanken runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePlatsbankenConfig,
  buildSearchUrl,
  postingUrl,
  parsePlatsbankenResponse,
  rawHitCount,
  formatLocation,
  assertPlatsbankenUrl,
  resolveMaxPages,
  fetchPlatsbanken,
  SEARCH_URL,
  API_HOST,
  POSTING_URL_BASE,
  PAGE_SIZE,
  DEFAULT_MAX_PAGES,
  MAX_PAGES_CAP,
} from '../server/lib/sources/platsbanken.mjs';
import { platsbankenAdapter } from '../server/lib/portals/adapters/platsbanken.mjs';

const resp = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  headers: { get: () => null },
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const httpError = (status) => ({
  ok: false,
  status,
  headers: { get: () => null },
  json: async () => ({}),
  text: async () => '',
});

const hit = (i, extra = {}) => ({
  id: `ad-${i}`,
  headline: `Jobbet ${i}`,
  employer: { name: 'Bolag AB' },
  workplace_address: { city: 'Stockholm', municipality: 'Stockholms kommun' },
  publication_date: '2026-10-01T06:00:00',
  description: { text: 'Bygg saker' },
  ...extra,
});
const hitPage = (offset, count = PAGE_SIZE) => ({
  total: { value: 40000 },
  hits: Array.from({ length: count }, (_, i) => hit(offset + i)),
});

/**
 * A fetchImpl routed by the `q` query param. Each keyword maps to an array of
 * page bodies — a plain object is a 200 JSON body, `{ error }` throws, and a
 * pre-built response object passes through as-is.
 */
function makeFetch(pagesByKeyword, calls = []) {
  return async (url) => {
    calls.push(url);
    const u = new URL(url);
    const pages = pagesByKeyword[u.searchParams.get('q')];
    const pageIdx = Number(u.searchParams.get('offset')) / PAGE_SIZE;
    const page = pages && pages[pageIdx];
    if (page === undefined) throw new Error(`unexpected fetch: ${url}`);
    if (page && page.error) throw page.error;
    if (page && page.raw) return page.raw;
    return resp(page);
  };
}

const KW = { platsbanken: { keywords: ['backend developer'] } };

test('platsbanken: parsePlatsbankenConfig — trimmed, deduped keywords, missing block tolerated', () => {
  assert.deepEqual(parsePlatsbankenConfig(KW), { keywords: ['backend developer'] });
  assert.deepEqual(
    parsePlatsbankenConfig({ platsbanken: { keywords: [' a ', 'a', 5, '', null, 'b'] } }),
    { keywords: ['a', 'b'] },
  );
  assert.deepEqual(parsePlatsbankenConfig({}), { keywords: [] });
  assert.deepEqual(parsePlatsbankenConfig(null), { keywords: [] });
});

test('platsbanken: buildSearchUrl — q/limit/offset on the pinned endpoint, offset is 0-based rows', () => {
  assert.equal(
    buildSearchUrl('backend developer', 1),
    `${SEARCH_URL}?q=${'backend+developer'}&limit=${PAGE_SIZE}&offset=0`,
  );
  assert.equal(
    buildSearchUrl('backend developer', 3),
    `${SEARCH_URL}?q=${'backend+developer'}&limit=${PAGE_SIZE}&offset=${PAGE_SIZE * 2}`,
  );
  assert.match(buildSearchUrl('x', 1, `https://${API_HOST}/search`), /^https:\/\/jobsearch\.api\.jobtechdev\.se\/search\?/);
});

test('platsbanken: postingUrl — rebuilt on the literal arbetsformedlingen.se host, surrogate-safe', () => {
  assert.equal(postingUrl('abc/def ghi'), `${POSTING_URL_BASE}abc%2Fdef%20ghi`);
  assert.equal(postingUrl(' 42 '), `${POSTING_URL_BASE}42`);
  assert.equal(postingUrl('\uD800lone'), null, 'a lone surrogate drops the posting, never a URIError');
  assert.equal(postingUrl(null), null);
  assert.equal(postingUrl(undefined), null);
  assert.equal(postingUrl(''), null);
});

test('platsbanken: parsePlatsbankenResponse — full row mapping', () => {
  const jobs = parsePlatsbankenResponse({
    total: { value: 2 },
    hits: [hit(1), hit(2, { description: {}, publication_date: null, workplace_address: {} })],
  });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Jobbet 1');
  assert.equal(jobs[0].url, `${POSTING_URL_BASE}ad-1`);
  assert.equal(jobs[0].company, 'Bolag AB');
  assert.equal(jobs[0].location, 'Stockholm');
  assert.equal(jobs[0].description, 'Bygg saker');
  assert.equal(jobs[0].postedAt, Date.parse('2026-10-01T06:00:00'));
  assert.equal(jobs[0].externalId, 'ad-1');
  assert.equal(jobs[1].description, undefined, 'an empty description object adds no description');
  assert.equal(jobs[1].postedAt, undefined, 'a null publication_date adds no postedAt');
});

test('platsbanken: parsePlatsbankenResponse — malformed rows are skipped, empty hits is an empty board', () => {
  assert.deepEqual(parsePlatsbankenResponse({ hits: [] }), []);
  const jobs = parsePlatsbankenResponse({
    hits: [null, 'garbage', { id: 'x' }, { headline: 'No id' }, hit(9)],
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].externalId, 'ad-9');
});

test('platsbanken: parsePlatsbankenResponse — a changed envelope throws naming what arrived', () => {
  assert.throws(() => parsePlatsbankenResponse({ total: 5 }), /expected hits\[\], got: keys: \[total\]/);
  assert.throws(() => parsePlatsbankenResponse({}), /got: keys: \[\]/);
  assert.throws(() => parsePlatsbankenResponse({ hits: null }), /got: keys: \[hits\]/);
  assert.throws(() => parsePlatsbankenResponse({ hits: 'lots' }), /got: keys: \[hits\]/);
  assert.throws(() => parsePlatsbankenResponse(['a', 'b']), /got: an array of 2/);
  assert.throws(() => parsePlatsbankenResponse(null), /got: null/);
  assert.throws(() => parsePlatsbankenResponse('login page'), /got: string/);
});

test('platsbanken: formatLocation — city → municipality → region → country', () => {
  assert.equal(formatLocation({ city: 'Malmö', municipality: 'M' }), 'Malmö');
  assert.equal(formatLocation({ municipality: 'Lund' }), 'Lund');
  assert.equal(formatLocation({ region: 'Skåne' }), 'Skåne');
  assert.equal(formatLocation({ country: 'Sverige' }), 'Sverige');
  assert.equal(formatLocation({}), '');
  assert.equal(formatLocation(null), '');
});

test('platsbanken: rawHitCount — the RAW page length, not the parsed row count', () => {
  assert.equal(rawHitCount({ hits: [hit(1), null, 'x'] }), 3);
  assert.equal(rawHitCount({}), 0);
  assert.equal(rawHitCount(null), 0);
});

test('platsbanken: assertPlatsbankenUrl — HTTPS on the API host only, default port only', () => {
  assert.equal(assertPlatsbankenUrl(SEARCH_URL), SEARCH_URL);
  assert.throws(() => assertPlatsbankenUrl(`http://${API_HOST}/search`), /must use HTTPS/);
  assert.throws(() => assertPlatsbankenUrl(`https://${API_HOST}:8443/search`), /non-default port/);
  assert.throws(() => assertPlatsbankenUrl('https://evil.example/search'), /untrusted hostname/);
  assert.throws(() => assertPlatsbankenUrl('not a url'), /invalid URL/);
});

test('platsbanken: resolveMaxPages — default 5, capped at the 21-page source ceiling', () => {
  assert.equal(resolveMaxPages({}), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 2 }), 2);
  assert.equal(resolveMaxPages({ max_pages: 999 }), MAX_PAGES_CAP);
  assert.equal(resolveMaxPages({ max_pages: 0 }), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: '5' }), DEFAULT_MAX_PAGES, 'a non-integer is ignored, not trusted');
});

test('platsbanken: fetchPlatsbanken — a pre-aborted scan throws before any request', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return resp(hitPage(0)); };
  await assert.rejects(
    () => fetchPlatsbanken(SEARCH_URL, { fetchImpl, signal: controller.signal, company: KW }),
    /aborted/,
  );
  assert.equal(calls, 0, 'no request was made');
});

test('platsbanken: fetchPlatsbanken — no keywords anywhere is a loud config error', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  await assert.rejects(
    () => fetchPlatsbanken(SEARCH_URL, { fetchImpl, company: { name: 'PB', provider: 'platsbanken' }, profileKeywords: [] }),
    /has no platsbanken\.keywords\[\] and no config\/profile\.yml target_roles/,
  );
});

test('platsbanken: fetchPlatsbanken — keyword from the entry, profile-keywords fallback, web-ui row shape', async () => {
  const calls = [];
  const fetchImpl = makeFetch({ 'data engineer': [hitPage(0, 2)] }, calls);
  const jobs = await fetchPlatsbanken(SEARCH_URL, {
    fetchImpl,
    company: { name: 'Platsbanken — Data', provider: 'platsbanken', platsbanken: { keywords: ['data engineer'] } },
    delayMs: 0,
  });
  assert.match(calls[0], /q=data\+engineer&limit=100&offset=0$/);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].id, 'platsbanken-ad-0');
  assert.equal(jobs[0].source, 'platsbanken');
  assert.equal(jobs[0].company, 'Bolag AB');
  assert.equal(jobs[0].date, new Date(Date.parse('2026-10-01T06:00:00')).toISOString());
  assert.equal(jobs[0].snippet, 'Bygg saker');
  assert.equal(jobs[0].salary, '');
});

test('platsbanken: fetchPlatsbanken — no entry keywords falls back to opts.profileKeywords', async () => {
  const fetchImpl = makeFetch({ 'ml engineer': [hitPage(0, 1)] });
  const jobs = await fetchPlatsbanken(SEARCH_URL, {
    fetchImpl,
    company: { name: 'PB', provider: 'platsbanken' },
    profileKeywords: ['ml engineer'],
    delayMs: 0,
  });
  assert.equal(jobs.length, 1);
});

test('platsbanken: fetchPlatsbanken — one keyword failing page 1 keeps the other keywords', async () => {
  const fetchImpl = makeFetch({
    dead: [ { error: Object.assign(new Error('HTTP 500'), { status: 500 }) } ],
    alive: [hitPage(0, 2)],
  });
  const jobs = await fetchPlatsbanken(SEARCH_URL, {
    fetchImpl,
    company: { platsbanken: { keywords: ['dead', 'alive'] } },
    delayMs: 0,
    retries: 0,
  });
  assert.equal(jobs.length, 2, 'the surviving keyword still reports');
});

test('platsbanken: fetchPlatsbanken — every keyword failing page 1 throws (never a quiet empty board)', async () => {
  const fetchImpl = makeFetch({
    dead1: [ { error: Object.assign(new Error('HTTP 503'), { status: 503 }) } ],
    dead2: [ { error: Object.assign(new Error('HTTP 503'), { status: 503 }) } ],
  });
  await assert.rejects(
    () => fetchPlatsbanken(SEARCH_URL, {
      fetchImpl,
      company: { platsbanken: { keywords: ['dead1', 'dead2'] } },
      delayMs: 0,
      retries: 0,
    }),
    /all 2 keyword request\(s\) failed/,
  );
});

test('platsbanken: fetchPlatsbanken — a later-page failure keeps the collected jobs', async () => {
  const calls = [];
  const fetchImpl = makeFetch({ 'backend developer': [hitPage(0), { error: Object.assign(new Error('HTTP 500'), { status: 500 }) }] }, calls);
  const jobs = await fetchPlatsbanken(SEARCH_URL, {
    fetchImpl,
    company: KW,
    delayMs: 0,
    retries: 0,
  });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, PAGE_SIZE, 'page-1 jobs kept');
  assert.equal(jobs.platsbankenTruncated, undefined, 'an error stop is not a cap truncation');
});

test('platsbanken: fetchPlatsbanken — a later-page envelope throw keeps the collected jobs', async () => {
  const fetchImpl = makeFetch({ 'backend developer': [hitPage(0), { total: 5 }] });
  const jobs = await fetchPlatsbanken(SEARCH_URL, {
    fetchImpl,
    company: KW,
    delayMs: 0,
    retries: 0,
  });
  assert.equal(jobs.length, PAGE_SIZE, 'page-1 jobs kept');
  assert.equal(jobs.platsbankenTruncated, undefined, 'a shape stop is not a cap truncation');
});

test('platsbanken: fetchPlatsbanken — a short RAW page ends the keyword walk', async () => {
  const calls = [];
  const fetchImpl = makeFetch({ 'backend developer': [hitPage(0, 12)] }, calls);
  const jobs = await fetchPlatsbanken(SEARCH_URL, { fetchImpl, company: KW, delayMs: 0 });
  assert.equal(calls.length, 1);
  assert.equal(jobs.length, 12);
  assert.equal(jobs.platsbankenTruncated, undefined);
});

test('platsbanken: fetchPlatsbanken — a full page at max_pages tags the array platsbankenTruncated', async () => {
  const fetchImpl = makeFetch({ 'backend developer': [hitPage(0), hitPage(PAGE_SIZE)] });
  const jobs = await fetchPlatsbanken(SEARCH_URL, {
    fetchImpl,
    company: { ...KW, max_pages: 2 },
    delayMs: 0,
  });
  assert.equal(jobs.length, PAGE_SIZE * 2);
  assert.equal(jobs.platsbankenTruncated, true, 'the cap stopped the walk — the board is partial');
});

test('platsbanken: fetchPlatsbanken — max_pages above 21 is clamped to the source ceiling (21 calls)', async () => {
  const pages = Array.from({ length: MAX_PAGES_CAP }, (_, p) => hitPage(p * PAGE_SIZE));
  const calls = [];
  const fetchImpl = makeFetch({ 'backend developer': pages }, calls);
  const jobs = await fetchPlatsbanken(SEARCH_URL, {
    fetchImpl,
    company: { ...KW, max_pages: 99 },
    delayMs: 0,
  });
  assert.equal(calls.length, MAX_PAGES_CAP, 'the 2000-offset ceiling, not the configured 99, is the cap');
  assert.equal(jobs.length, PAGE_SIZE * MAX_PAGES_CAP);
  assert.equal(jobs.platsbankenTruncated, true);
});

test('platsbanken: fetchPlatsbanken — an aborted scan mid-walk throws, never returns partials silently', async () => {
  const controller = new AbortController();
  let calls = 0;
  const fetchImpl = async (url, opts = {}) => {
    calls += 1;
    if (calls === 1) return resp(hitPage(0));
    controller.abort();
    throw new Error('aborted transport');
  };
  await assert.rejects(
    () => fetchPlatsbanken(SEARCH_URL, {
      fetchImpl,
      signal: controller.signal,
      company: KW,
      delayMs: 0,
      retries: 0,
    }),
    /aborted transport/,
  );
  assert.equal(calls, 2);
});

test('platsbanken adapter: provider-selected only, endpoint pinned, null-safe matches', () => {
  assert.equal(platsbankenAdapter.buildEndpoint({ provider: 'platsbanken' }), SEARCH_URL);
  assert.equal(platsbankenAdapter.buildEndpoint({ provider: 'platsbanken', api: `https://${API_HOST}/search?mirror=1` }), `https://${API_HOST}/search?mirror=1`);
  assert.equal(platsbankenAdapter.buildEndpoint({ provider: 'platsbanken', api: 'https://evil.example/search' }), SEARCH_URL, 'an off-host override never reaches the fetch slot');
  assert.equal(platsbankenAdapter.buildEndpoint({ provider: 'platsbanken', api: 'not a url' }), SEARCH_URL);
  assert.equal(platsbankenAdapter.matches({ provider: 'platsbanken' }), true);
  assert.equal(platsbankenAdapter.matches({ careers_url: SEARCH_URL }), false, 'a national board is never host-auto-detected');
  assert.equal(platsbankenAdapter.matches({ provider: 'greenhouse' }), false);
  assert.equal(platsbankenAdapter.matches(null), false, 'a null entry is false, never a throw');
  assert.equal(platsbankenAdapter.matches(undefined), false);
  assert.equal(platsbankenAdapter.matches(42), false);
});
