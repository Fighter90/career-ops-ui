/**
 * Tech in Asia source (v1.253.0 parent parity) — CI-isolated suite.
 * Ported from the parent's techinasia provider cases: the fresh-per-run
 * Algolia credential discovery (hashed app asset → apiKey/appId from the
 * bundle config, entry override short-circuits discovery), the Algolia
 * endpoint build (credentials as query params on the app-named host), the
 * naive-UTC published_at parse, the external-link rules (https only, no
 * shorteners, shared links collapse to the posting page), the id-segment
 * surrogate safety, and the pagination rules (a pre-aborted scan throws
 * before any request; a page-0 failure or envelope throw propagates naming
 * what arrived; a later-page failure or shape throw keeps the partials; the
 * nbPages/short-page stops; a cap stop tags techinasiaTruncated). No network
 * — every pure helper is exported; fetchTechInAsia runs on a fake fetchImpl
 * routed by host.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertTechinasiaHost,
  findAppAssetPath,
  parseAlgoliaCredentials,
  algoliaEndpoint,
  parsePublishedAt,
  externalLinkOf,
  resolveTechInAsiaUrl,
  normalizeTechInAsiaJob,
  parseTechInAsiaPage,
  resolveMaxPages,
  fetchTechInAsia,
  SITE_HOST,
  ASSET_HOST,
  SITE_ORIGIN,
  SEARCH_PAGE_URL,
  HITS_PER_PAGE,
  DEFAULT_MAX_PAGES,
  MAX_PAGES_CAP,
} from '../server/lib/sources/techinasia.mjs';
import { techinasiaAdapter } from '../server/lib/portals/adapters/techinasia.mjs';

const APP_ID = 'ABC123DEF4'; // 10 alnum chars, per the appId shape
const API_KEY = '0123456789abcdef0123456789abcdef'; // 32 alnum chars
const ALGOLIA_HOST = `${APP_ID.toLowerCase()}-dsn.algolia.net`;
const SEARCH_HTML = '<html><script src="//static.techinasia.com/assets/v5/app.1a2b3c4d.js"></script></html>';
const BUNDLE_JS = `(window.config={apiKey:"${API_KEY}",appId:"${APP_ID}"});`;

const hit = (i, extra = {}) => ({
  objectID: `tia-${i}`,
  title: `Backend Engineer ${i}`,
  company: JSON.stringify({ name: `Startup ${i}` }),
  city: { name: 'Jakarta', country_name: 'Indonesia' },
  published_at: '2026-10-01 06:00:00',
  description: '<p>Build things</p>',
  ...extra,
});
const algoliaPage = (page, hits, nbPages = 1) => ({
  results: [{ hits, page, nbPages, hitsPerPage: HITS_PER_PAGE }],
});

const respJson = (body) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const respText = (text) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  text: async () => text,
  json: async () => { throw new Error('not JSON'); },
});

/**
 * A fetchImpl routed by host: SITE_HOST → search HTML, ASSET_HOST → bundle
 * JS, the Algolia host → per-page responses from `pages` (index by page; a
 * plain object is a 200 JSON body, `{ error }` throws, `{ raw }` passes
 * through). Every call is recorded for assertions.
 */
function makeFetch(pages = {}, calls = []) {
  return async (url, opts = {}) => {
    calls.push({ url, opts });
    const u = new URL(url);
    if (u.hostname === SITE_HOST) return respText(SEARCH_HTML);
    if (u.hostname === ASSET_HOST) return respText(BUNDLE_JS);
    if (u.hostname === ALGOLIA_HOST) {
      const page = Number(/page=(\d+)/.exec(String(JSON.parse(opts.body).requests[0].params))[1]);
      const p = pages[page];
      if (p === undefined) throw new Error(`unexpected page ${page} fetch`);
      if (p && p.error) throw p.error;
      if (p && p.raw) return p.raw;
      return respJson(p && p.body ? p.body : algoliaPage(page, (p && p.hits) || [], (p && p.nbPages) || 1));
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

const ENTRY = { name: 'Tech in Asia', provider: 'techinasia' };
const OVERRIDE_ENTRY = {
  ...ENTRY,
  techinasia: { appId: APP_ID, apiKey: API_KEY },
};

test('techinasia: findAppAssetPath — the hashed v5 bundle on the pinned asset host', () => {
  assert.equal(
    findAppAssetPath(SEARCH_HTML),
    `https://${ASSET_HOST}/assets/v5/app.1a2b3c4d.js`,
  );
  assert.throws(() => findAppAssetPath('<html>no bundle here</html>'), /could not find the app bundle/);
  assert.throws(() => findAppAssetPath(null), /got no HTML/);
  assert.throws(() => findAppAssetPath(42), /got no HTML/);
});

test('techinasia: parseAlgoliaCredentials — apiKey then appId, shape-validated', () => {
  assert.deepEqual(parseAlgoliaCredentials(BUNDLE_JS), { appId: APP_ID, apiKey: API_KEY });
  assert.throws(() => parseAlgoliaCredentials('const x = 1;'), /credentials not found/);
  assert.throws(() => parseAlgoliaCredentials(null), /got no bundle/);
  assert.throws(() => parseAlgoliaCredentials(7), /got no bundle/);
});

test('techinasia: algoliaEndpoint — credentials ride as QUERY params on the app-named host', () => {
  const url = new URL(algoliaEndpoint(APP_ID, API_KEY));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, ALGOLIA_HOST);
  assert.equal(url.pathname, '/1/indexes/*/queries');
  assert.equal(url.searchParams.get('x-algolia-application-id'), APP_ID);
  assert.equal(url.searchParams.get('x-algolia-api-key'), API_KEY);
  assert.throws(() => algoliaEndpoint('../evil', API_KEY), /unexpected Algolia app id/);
  assert.throws(() => algoliaEndpoint('', API_KEY), /unexpected Algolia app id/);
});

test('techinasia: assertTechinasiaHost — HTTPS, exact hostname, default port only', () => {
  assert.equal(assertTechinasiaHost(SEARCH_PAGE_URL, SITE_HOST, 'search page'), SEARCH_PAGE_URL);
  assert.throws(() => assertTechinasiaHost('http://www.techinasia.com/jobs/search', SITE_HOST, 'x'), /must use HTTPS/);
  assert.throws(() => assertTechinasiaHost('https://www.techinasia.com:8443/', SITE_HOST, 'x'), /non-default port/);
  assert.throws(() => assertTechinasiaHost('https://evil.example/', SITE_HOST, 'x'), /untrusted x hostname/);
  assert.throws(() => assertTechinasiaHost('not a url', SITE_HOST, 'x'), /invalid URL/);
});

test('techinasia: parsePublishedAt — naive stamps read as UTC, zoned ones as-is', () => {
  assert.equal(parsePublishedAt('2026-10-01 06:00:00'), Date.parse('2026-10-01T06:00:00Z'));
  assert.equal(parsePublishedAt('2026-10-01T06:00:00+07:00'), Date.parse('2026-10-01T06:00:00+07:00'));
  assert.equal(parsePublishedAt('garbage'), undefined);
  assert.equal(parsePublishedAt(''), undefined);
  assert.equal(parsePublishedAt(null), undefined);
  assert.equal(parsePublishedAt(12345), undefined);
});

test('techinasia: externalLinkOf — https employer links only, shorteners refused', () => {
  assert.equal(externalLinkOf({ external_link: 'https://jobs.acme.com/apply/1' }), 'https://jobs.acme.com/apply/1');
  assert.equal(externalLinkOf({ external_link: 'http://jobs.acme.com/apply/1' }), '', 'plain HTTP is not verifiable');
  assert.equal(externalLinkOf({ external_link: 'https://bit.ly/abc' }), '', 'a shortener is refused');
  assert.equal(externalLinkOf({ external_link: 'https://T.CO/x' }), '', 'the shortener check is case-insensitive');
  assert.equal(externalLinkOf({ external_link: 'not a url' }), '');
  assert.equal(externalLinkOf({}), '');
  assert.equal(externalLinkOf(null), '');
});

test('techinasia: resolveTechInAsiaUrl — own external link wins; shared links collapse to the posting page', () => {
  const own = { objectID: 'a1', external_link: 'https://jobs.acme.com/apply/1' };
  assert.equal(resolveTechInAsiaUrl(own), 'https://jobs.acme.com/apply/1');
  assert.equal(
    resolveTechInAsiaUrl(own, new Set(['https://jobs.acme.com/apply/1'])),
    `${SITE_ORIGIN}/jobs/a1`,
    'a link another posting also uses is not this posting\'s own path',
  );

  const noLink = { objectID: 'b2' };
  assert.equal(resolveTechInAsiaUrl(noLink), `${SITE_ORIGIN}/jobs/b2`);
  assert.equal(resolveTechInAsiaUrl({ objectID: 'x/../../about' }), `${SITE_ORIGIN}/jobs/x%2F..%2F..%2Fabout`, 'the id segment is percent-encoded');
  assert.equal(resolveTechInAsiaUrl({ objectID: '\uD800lone' }), '', 'a lone surrogate drops the row');
  assert.equal(resolveTechInAsiaUrl({}), '', 'no id and no link — nothing to dedup or link');
  assert.equal(resolveTechInAsiaUrl({ id: 'legacy-id' }), `${SITE_ORIGIN}/jobs/legacy-id`, 'the bare id field works too');
});

test('techinasia: normalizeTechInAsiaJob — company JSON string/object/fallback, location parts, UTC date', () => {
  const row = normalizeTechInAsiaJob(hit(1, { is_remote: 1 }), 'Tech in Asia');
  assert.equal(row.title, 'Backend Engineer 1');
  assert.equal(row.url, `${SITE_ORIGIN}/jobs/tia-1`);
  assert.equal(row.company, 'Startup 1', 'the JSON-encoded company string is parsed');
  assert.equal(row.location, 'Jakarta, Indonesia, Remote');
  assert.equal(row.description, 'Build things', 'decode-then-strip via the shared helper');
  assert.equal(row.postedAt, Date.parse('2026-10-01T06:00:00Z'));
  assert.equal(row.externalId, 'tia-1');

  const obj = normalizeTechInAsiaJob(hit(2, { company: { name: 'Obj Co' } }), 'Tech in Asia');
  assert.equal(obj.company, 'Obj Co', 'a real company object is tolerated');

  const raw = normalizeTechInAsiaJob(hit(3, { company: 'not json' }), 'Fallback Entry');
  assert.equal(raw.company, 'Fallback Entry', 'unparseable company falls back to the entry name');

  assert.equal(normalizeTechInAsiaJob(hit(4, { title: '  ' }), 'x'), null, 'no title → null');
  assert.equal(normalizeTechInAsiaJob(null), null);
});

test('techinasia: parseTechInAsiaPage — page 0 strict, later pages lenient about a contentless answer', () => {
  const good = parseTechInAsiaPage(algoliaPage(0, [hit(1)], 3), { page: 0 });
  assert.equal(good.hits.length, 1);
  assert.equal(good.nbPages, 3);
  assert.equal(good.rowsLength, 1);

  // Page 0: a changed envelope throws naming what arrived.
  assert.throws(() => parseTechInAsiaPage(null, { page: 0 }), /page 0 — expected results\[\], got: null/);
  assert.throws(() => parseTechInAsiaPage({}, { page: 0 }), /got: keys: \[\]/);
  assert.throws(() => parseTechInAsiaPage({ error: 'quota' }, { page: 0 }), /got: keys: \[error\]/);
  assert.throws(() => parseTechInAsiaPage([1, 2], { page: 0 }), /got: an array of 2/);
  assert.throws(() => parseTechInAsiaPage('blocked', { page: 0 }), /got: string/);
  assert.throws(
    () => parseTechInAsiaPage({ results: [{ nbPages: 1 }] }, { page: 0 }),
    /expected results\[0\]\.hits, got keys: \[nbPages\]/,
  );

  // results: [] is the documented envelope answering nothing — an empty board.
  assert.equal(parseTechInAsiaPage({ results: [] }, { page: 0 }).rowsLength, 0);

  // Later pages: a contentless answer ends the walk naturally.
  assert.equal(parseTechInAsiaPage(null, { page: 1 }).rowsLength, 0);
  assert.equal(parseTechInAsiaPage({}, { page: 1 }).rowsLength, 0);
  // …but a shape change still throws (and the fetch loop keeps the partials).
  assert.throws(() => parseTechInAsiaPage({ unexpected: true }, { page: 1 }), /page 1 — expected results\[\], got: keys: \[unexpected\]/);
  assert.throws(() => parseTechInAsiaPage({ results: [{}] }, { page: 1 }), /expected results\[0\]\.hits/);
});

test('techinasia: resolveMaxPages — default 5, camelCase accepted, capped at 50', () => {
  assert.equal(resolveMaxPages({}), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 2 }), 2);
  assert.equal(resolveMaxPages({ maxPages: 7 }), 7, 'a camelCase entry is not silently ignored');
  assert.equal(resolveMaxPages({ max_pages: 999 }), MAX_PAGES_CAP);
  assert.equal(resolveMaxPages({ max_pages: 0 }), DEFAULT_MAX_PAGES);
});

test('techinasia: fetchTechInAsia — a pre-aborted scan throws before any request', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return respText(SEARCH_HTML); };
  await assert.rejects(
    () => fetchTechInAsia(SEARCH_PAGE_URL, { fetchImpl, signal: controller.signal, company: OVERRIDE_ENTRY }),
    /aborted/,
  );
  assert.equal(calls, 0, 'no request — not even credential discovery');
});

test('techinasia: fetchTechInAsia — credentials discovered fresh from the site build, POST carries them', async () => {
  const calls = [];
  const fetchImpl = makeFetch({ 0: { hits: [hit(1)] } }, calls);
  const jobs = await fetchTechInAsia(SEARCH_PAGE_URL, { fetchImpl, company: ENTRY, delayMs: 0 });
  assert.equal(calls.length, 3, 'search page → app bundle → one Algolia POST');
  assert.equal(calls[0].url, SEARCH_PAGE_URL);
  assert.equal(calls[1].url, `https://${ASSET_HOST}/assets/v5/app.1a2b3c4d.js`);
  const algolia = new URL(calls[2].url);
  assert.equal(algolia.hostname, ALGOLIA_HOST);
  assert.equal(algolia.searchParams.get('x-algolia-application-id'), APP_ID);
  assert.equal(calls[2].opts.headers.referer, `${SITE_ORIGIN}/`, 'the key is referer-gated');
  assert.equal(calls[2].opts.headers['content-type'], 'application/x-www-form-urlencoded');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Startup 1');
});

test('techinasia: fetchTechInAsia — an entry appId/apiKey override short-circuits discovery', async () => {
  const calls = [];
  const fetchImpl = makeFetch({ 0: { hits: [hit(1)] } }, calls);
  const jobs = await fetchTechInAsia(SEARCH_PAGE_URL, { fetchImpl, company: OVERRIDE_ENTRY, delayMs: 0 });
  assert.equal(calls.length, 1, 'no discovery requests');
  assert.equal(jobs.length, 1);
});

test('techinasia: fetchTechInAsia — a page-0 fetch failure propagates (no quiet empty board)', async () => {
  const fetchImpl = makeFetch({ 0: { error: Object.assign(new Error('HTTP 403'), { status: 403 }) } });
  await assert.rejects(
    () => fetchTechInAsia(SEARCH_PAGE_URL, { fetchImpl, company: OVERRIDE_ENTRY, delayMs: 0, retries: 0 }),
    /HTTP 403/,
  );
});

test('techinasia: fetchTechInAsia — a page-0 envelope throw propagates naming what arrived', async () => {
  const fetchImpl = makeFetch({ 0: { body: { quotaExceeded: true } } });
  await assert.rejects(
    () => fetchTechInAsia(SEARCH_PAGE_URL, { fetchImpl, company: OVERRIDE_ENTRY, delayMs: 0, retries: 0 }),
    /page 0 — expected results\[\], got: keys: \[quotaExceeded\]/,
  );
});

test('techinasia: fetchTechInAsia — a later-page failure keeps the collected hits', async () => {
  const calls = [];
  const fetchImpl = makeFetch(
    { 0: { hits: [hit(1), hit(2)], nbPages: 3 }, 1: { error: Object.assign(new Error('HTTP 500'), { status: 500 }) } },
    calls,
  );
  const jobs = await fetchTechInAsia(SEARCH_PAGE_URL, { fetchImpl, company: OVERRIDE_ENTRY, delayMs: 0, retries: 0 });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 2, 'page-0 jobs kept');
  assert.equal(jobs.techinasiaTruncated, undefined, 'an error stop is not a cap truncation');
});

test('techinasia: fetchTechInAsia — a later-page envelope throw keeps the collected hits', async () => {
  const fetchImpl = makeFetch(
    { 0: { hits: [hit(1)], nbPages: 3 }, 1: { body: { unexpected: true } } },
  );
  const jobs = await fetchTechInAsia(SEARCH_PAGE_URL, { fetchImpl, company: OVERRIDE_ENTRY, delayMs: 0, retries: 0 });
  assert.equal(jobs.length, 1, 'page-0 jobs kept');
  assert.equal(jobs.techinasiaTruncated, undefined, 'a shape stop is not a cap truncation');
});

test('techinasia: fetchTechInAsia — nbPages is the honest stop; a cap stop tags techinasiaTruncated', async () => {
  const calls = [];
  const fetchImpl = makeFetch({ 0: { hits: [hit(1)], nbPages: 1 } }, calls);
  const jobs = await fetchTechInAsia(SEARCH_PAGE_URL, { fetchImpl, company: OVERRIDE_ENTRY, delayMs: 0 });
  assert.equal(calls.length, 1, 'nbPages 1 — the whole board arrived in one request');
  assert.equal(jobs.techinasiaTruncated, undefined);

  const capped = await fetchTechInAsia(SEARCH_PAGE_URL, {
    fetchImpl: makeFetch({ 0: { hits: [hit(1)], nbPages: 5 }, 1: { hits: [hit(2)], nbPages: 5 } }),
    company: { ...OVERRIDE_ENTRY, max_pages: 2 },
    delayMs: 0,
  });
  assert.equal(capped.techinasiaTruncated, true, 'the entry cap stopped a board with 5 pages');
});

test('techinasia: fetchTechInAsia — an empty page ends the walk without the truncation flag', async () => {
  const fetchImpl = makeFetch({ 0: { hits: [] } });
  const jobs = await fetchTechInAsia(SEARCH_PAGE_URL, { fetchImpl, company: OVERRIDE_ENTRY, delayMs: 0 });
  assert.deepEqual(jobs, []);
});

test('techinasia: fetchTechInAsia — shared external links collapse to posting pages, rows dedup by url', async () => {
  const sharedForm = 'https://forms.example.com/intake';
  const fetchImpl = makeFetch({
    0: {
      hits: [
        hit(1, { external_link: sharedForm }),
        hit(2, { external_link: sharedForm }),
        hit(3, { external_link: 'https://jobs.acme.com/apply/3' }),
        hit(9, { objectID: 'tia-1', title: 'Duplicate Post' }), // same posting page as hit 1 → deduped
      ],
    },
  });
  const jobs = await fetchTechInAsia(SEARCH_PAGE_URL, { fetchImpl, company: OVERRIDE_ENTRY, delayMs: 0 });
  const urls = jobs.map((j) => j.url);
  assert.deepEqual(urls, [
    `${SITE_ORIGIN}/jobs/tia-1`,
    `${SITE_ORIGIN}/jobs/tia-2`,
    'https://jobs.acme.com/apply/3',
  ], 'the shared form collapses to posting pages; the duplicated posting is deduped');
});

test('techinasia: fetchTechInAsia — the web-ui row shape', async () => {
  const fetchImpl = makeFetch({ 0: { hits: [hit(1, { title: 'Remote Platform Engineer', is_remote: 1 })] } });
  const jobs = await fetchTechInAsia(SEARCH_PAGE_URL, { fetchImpl, company: OVERRIDE_ENTRY, delayMs: 0 });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'techinasia-tia-1');
  assert.equal(jobs[0].source, 'techinasia');
  assert.equal(jobs[0].date, new Date(Date.parse('2026-10-01T06:00:00Z')).toISOString());
  assert.equal(jobs[0].snippet, 'Build things');
  assert.equal(jobs[0].salary, '', 'the index salary fields are flags, never attached');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].workplaceType, 'Remote');
});

test('techinasia adapter: provider-selected only, endpoint pinned, null-safe matches', () => {
  assert.equal(techinasiaAdapter.buildEndpoint(ENTRY), SEARCH_PAGE_URL);
  assert.equal(techinasiaAdapter.buildEndpoint({ provider: 'techinasia', api: `https://${SITE_HOST}/mirror` }), `https://${SITE_HOST}/mirror`);
  assert.equal(techinasiaAdapter.buildEndpoint({ provider: 'techinasia', api: 'https://evil.example/' }), SEARCH_PAGE_URL, 'an off-host override never reaches the fetch slot');
  assert.equal(techinasiaAdapter.buildEndpoint({ provider: 'techinasia', api: 'not a url' }), SEARCH_PAGE_URL);
  assert.equal(techinasiaAdapter.matches(ENTRY), true);
  assert.equal(techinasiaAdapter.matches({ careers_url: SEARCH_PAGE_URL }), false, 'a job-board aggregator is never host-auto-detected');
  assert.equal(techinasiaAdapter.matches({ provider: 'greenhouse' }), false);
  assert.equal(techinasiaAdapter.matches(null), false, 'a null entry is false, never a throw');
  assert.equal(techinasiaAdapter.matches(undefined), false);
  assert.equal(techinasiaAdapter.matches(42), false);
});
