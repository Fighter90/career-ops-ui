/**
 * Rippling source + adapter. v2 same-origin paginated board API (parent #4353).
 * CI-isolated (fake fetchImpl — no network, no parent project dependency).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ripplingSlugFromCareersUrl,
  buildRipplingEndpoint,
  fetchRippling,
  parseRipplingPage,
  RIPPLING_CAREERS_HOST_RE,
  RIPPLING_API_HOST,
  API_BASE,
} from '../server/lib/sources/rippling.mjs';
import { ripplingAdapter } from '../server/lib/portals/adapters/rippling.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BOARD_JSON = {
  page: 0, pageSize: 1000, totalItems: 4, totalPages: 1,
  items: [
    {
      id: 'abc-123',
      name: 'Senior Engineer',
      url: 'https://ats.rippling.com/acme-jobs/jobs/abc-123',
      department: { name: 'Engineering' },
      locations: [{ name: 'San Francisco, CA' }],
      created: '2026-06-01T00:00:00Z',
    },
    {
      id: 'def-456',
      name: 'Remote Product Manager',
      url: 'https://ats.rippling.com/acme-jobs/jobs/def-456',
      locations: [{ name: 'Remote' }],
      created: '2026-06-15',
    },
    {
      // no url — should be dropped
      id: 'no-url',
      name: 'Ghost Role',
      locations: [{ name: 'Austin, TX' }],
    },
    {
      // no name/title — should be dropped
      id: 'no-name',
      url: 'https://ats.rippling.com/acme-jobs/jobs/no-name',
    },
  ],
};

const VALID_CAREERS_URL = 'https://ats.rippling.com/acme-jobs/jobs';
const VALID_API_URL = 'https://ats.rippling.com/api/v2/board/acme-jobs/jobs?page=0&pageSize=1000';

const jsonFetch = (body) => async () => ({ ok: true, status: 200, json: async () => body });

/** Capture console.error lines while running fn. */
async function captureErrors(fn) {
  const errors = [];
  const orig = console.error;
  console.error = (...a) => { errors.push(a.join(' ')); };
  try { return { result: await fn(), errors }; } finally { console.error = orig; }
}

const pageOf = (n, count) => ({
  page: n, pageSize: 1000, totalItems: 2000, totalPages: 2,
  items: Array.from({ length: count }, (_, i) => ({
    id: `${n}-${i}`, name: `Role ${n}-${i}`, url: `https://ats.rippling.com/bigco/jobs/${n}-${i}`, locations: [],
  })),
});
const BIG_EP = 'https://ats.rippling.com/api/v2/board/bigco/jobs?page=0&pageSize=1000';
const FAST = { interPageDelayMs: 0, retryDelayMs: 0 };

// ---------------------------------------------------------------------------
// Slug extraction
// ---------------------------------------------------------------------------

test('ripplingSlugFromCareersUrl: extracts slug from /slug/jobs path', () => {
  assert.equal(ripplingSlugFromCareersUrl(VALID_CAREERS_URL), 'acme-jobs');
});

test('ripplingSlugFromCareersUrl: extracts slug from /slug only (no trailing /jobs)', () => {
  assert.equal(ripplingSlugFromCareersUrl('https://ats.rippling.com/my-company'), 'my-company');
});

test('ripplingSlugFromCareersUrl: returns null for non-ats.rippling.com host', () => {
  assert.equal(ripplingSlugFromCareersUrl('https://acme.example.com/jobs'), null);
  assert.equal(ripplingSlugFromCareersUrl('https://rippling.com/jobs'), null);
});

test('ripplingSlugFromCareersUrl: returns null for http (non-https)', () => {
  assert.equal(ripplingSlugFromCareersUrl('http://ats.rippling.com/acme-jobs/jobs'), null);
});

test('ripplingSlugFromCareersUrl: returns null for empty / malformed input', () => {
  assert.equal(ripplingSlugFromCareersUrl(''), null);
  assert.equal(ripplingSlugFromCareersUrl('not-a-url'), null);
});

// ---------------------------------------------------------------------------
// Endpoint transform (careers → API)
// ---------------------------------------------------------------------------

test('buildRipplingEndpoint: page-0 v2 board URL on ats.rippling.com', () => {
  assert.equal(buildRipplingEndpoint('acme-jobs'), VALID_API_URL);
  assert.equal(buildRipplingEndpoint('acme-jobs', 3), 'https://ats.rippling.com/api/v2/board/acme-jobs/jobs?page=3&pageSize=1000');
});

test('buildRipplingEndpoint: URL-encodes slug (safety)', () => {
  const ep = buildRipplingEndpoint('my slug');
  assert.ok(ep.includes('my%20slug'));
  assert.ok(ep.startsWith(API_BASE));
});

// ---------------------------------------------------------------------------
// parseRipplingPage (parent #4353)
// ---------------------------------------------------------------------------

test('parseRipplingPage: raw count, drops, trims, joins locations with " · "', () => {
  const { jobs, rawCount } = parseRipplingPage({ items: [
    { id: '1', name: 'Account Executive', url: 'https://ats.rippling.com/acme/jobs/uuid-1', locations: [{ name: 'Remote (United States)' }] },
    { id: '2', name: '  ML Engineer  ', url: '  https://ats.rippling.com/acme/jobs/uuid-2  ', locations: [{ name: 'Berlin, Germany' }, { name: 'Hamburg, Germany' }] },
    { id: '3', name: 'No Loc Role', url: 'https://ats.rippling.com/acme/jobs/uuid-3', locations: [] },
    { id: '4', name: 'Missing Locations', url: 'https://ats.rippling.com/acme/jobs/uuid-4' },
    { id: '5', name: '', url: 'https://ats.rippling.com/acme/jobs/uuid-5' },
    { id: '6', name: 'No URL Role' },
    { id: '7', name: 'Insecure', url: 'http://ats.rippling.com/acme/jobs/uuid-7' },
  ] }, 'Acme');
  assert.equal(rawCount, 7);
  assert.equal(jobs.length, 4);
  assert.equal(jobs[0].location, 'Remote (United States)');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[1].title, 'ML Engineer');
  assert.equal(jobs[1].url, 'https://ats.rippling.com/acme/jobs/uuid-2');
  assert.equal(jobs[1].location, 'Berlin, Germany · Hamburg, Germany');
  assert.equal(jobs[2].location, '');
  assert.equal(jobs[3].location, '');
});

test('parseRipplingPage: posting url host-locked to ats.rippling.com', () => {
  const { jobs } = parseRipplingPage({ items: [
    { name: 'External Host', url: 'https://evil.example/acme/jobs/uuid-x' },
    { name: 'Valid Host', url: 'https://ats.rippling.com/acme/jobs/uuid-9' },
  ] }, 'Acme');
  assert.deepEqual(jobs.map((j) => j.title), ['Valid Host']);
});

test('parseRipplingPage: empty items[] is an empty board; any other envelope throws', () => {
  assert.deepEqual(parseRipplingPage({ items: [] }, 'X'), { jobs: [], rawCount: 0 });
  for (const bad of [{}, { items: null }, { items: 'nope' }, null, 'not json', 42, []]) {
    assert.throws(() => parseRipplingPage(bad, 'X'), /unexpected response/, JSON.stringify(bad));
  }
});

// ---------------------------------------------------------------------------
// fetchRippling: normalization via fake fetchImpl
// ---------------------------------------------------------------------------

test('fetchRippling: returns 12-field shape, source=rippling', async () => {
  const jobs = await fetchRippling(VALID_API_URL, { fetchImpl: jsonFetch(BOARD_JSON) });
  // 2 valid (no-url and no-name dropped)
  assert.equal(jobs.length, 2);
  const [j0] = jobs;

  const REQUIRED = ['id','title','url','company','location','isRemote','workplaceType','salary','date','snippet','relocates','source'];
  for (const f of REQUIRED) {
    assert.ok(Object.hasOwn(j0, f), `missing field: ${f}`);
  }

  assert.equal(j0.title, 'Senior Engineer');
  assert.equal(j0.id, 'rippling-abc-123');
  assert.equal(j0.location, 'San Francisco, CA');
  assert.equal(j0.isRemote, false);
  assert.equal(j0.workplaceType, 'Onsite');
  assert.equal(j0.salary, '');
  assert.equal(j0.snippet, '');
  assert.equal(j0.relocates, false);
  assert.equal(j0.source, 'rippling');
  assert.equal(j0.date, '2026-06-01');
});

test('fetchRippling: remote inference from locations[].name', async () => {
  const jobs = await fetchRippling(VALID_API_URL, { fetchImpl: jsonFetch(BOARD_JSON) });
  const remote = jobs.find((j) => j.title === 'Remote Product Manager');
  assert.ok(remote);
  assert.equal(remote.isRemote, true);
  assert.equal(remote.workplaceType, 'Remote');
  assert.equal(remote.location, 'Remote');
  assert.equal(remote.date, '2026-06-15');
});

test('fetchRippling: requests the page-0 v2 URL with redirect:error; a short page is one request', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => BOARD_JSON }; };
  await fetchRippling(VALID_API_URL, { fetchImpl });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, VALID_API_URL);
  assert.equal(calls[0].init.redirect, 'error');
});

test('fetchRippling: a non-{items[]} envelope throws a descriptive error', async () => {
  await assert.rejects(() => fetchRippling(VALID_API_URL, { fetchImpl: jsonFetch([]) }), /unexpected response/);
});

test('fetchRippling: rejects off-host endpoint (not ats.rippling.com)', async () => {
  await assert.rejects(
    () => fetchRippling('https://evil.com/api/v2/board/acme/jobs', { fetchImpl: jsonFetch({ items: [] }) }),
    /untrusted hostname/
  );
  await assert.rejects(
    () => fetchRippling('https://api.rippling.com/platform/api/ats/v1/board/acme/jobs', { fetchImpl: jsonFetch({ items: [] }) }),
    /untrusted hostname/
  );
});

test('fetchRippling: rejects http endpoint', async () => {
  await assert.rejects(
    () => fetchRippling('http://ats.rippling.com/api/v2/board/acme/jobs', { fetchImpl: jsonFetch({ items: [] }) }),
    /must use HTTPS/
  );
});

test('fetchRippling: rejects a same-host URL that is not a v2 board endpoint', async () => {
  await assert.rejects(
    () => fetchRippling('https://ats.rippling.com/acme/jobs', { fetchImpl: jsonFetch({ items: [] }) }),
    /not a v2 board endpoint/
  );
});

test('fetchRippling: company name from entry, else capitalized slug from path', async () => {
  const one = { items: [BOARD_JSON.items[0]] };
  const bySlug = await fetchRippling(VALID_API_URL, { fetchImpl: jsonFetch(one) });
  assert.equal(bySlug[0].company, 'Acme-jobs');
  const byName = await fetchRippling(VALID_API_URL, { fetchImpl: jsonFetch(one), company: { name: 'Acme Inc' } });
  assert.equal(byName[0].company, 'Acme Inc');
});

// ---------------------------------------------------------------------------
// Pagination (parent #4353)
// ---------------------------------------------------------------------------

test('fetchRippling: paginates past page 0 and stops on the natural short page', async () => {
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); return { ok: true, status: 200, json: async () => (urls.length === 1 ? pageOf(0, 1000) : pageOf(1, 500)) }; };
  const jobs = await fetchRippling(BIG_EP, { fetchImpl, ...FAST });
  assert.equal(urls.length, 2);
  assert.equal(jobs.length, 1500);
  assert.match(urls[1], /[?&]page=1&pageSize=1000$/);
});

test('fetchRippling: a short page that is also the last allowed page is a natural end, not a cap warning', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; return { ok: true, status: 200, json: async () => (n === 1 ? pageOf(0, 1000) : pageOf(1, 300)) }; };
  const { result, errors } = await captureErrors(() => fetchRippling(BIG_EP, { fetchImpl, company: { max_pages: 2 }, ...FAST }));
  assert.equal(n, 2);
  assert.equal(result.length, 1300);
  assert.ok(!errors.some((e) => /raise max_pages/.test(e)), JSON.stringify(errors));
});

test('fetchRippling: DEFAULT_MAX_PAGES (10) clamps an always-full board and warns', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; if (n > 15) throw new Error('unbounded'); return { ok: true, status: 200, json: async () => pageOf(n, 1000) }; };
  const { result, errors } = await captureErrors(() => fetchRippling(BIG_EP, { fetchImpl, ...FAST }));
  assert.equal(n, 10);
  assert.equal(result.length, 10_000);
  assert.ok(errors.some((e) => /raise max_pages/.test(e)));
});

test('fetchRippling: honors an entry max_pages override', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; return { ok: true, status: 200, json: async () => pageOf(n, 1000) }; };
  await captureErrors(() => fetchRippling(BIG_EP, { fetchImpl, company: { max_pages: 2 }, ...FAST }));
  assert.equal(n, 2);
});

test('fetchRippling: opts.maxPages (health probe) caps at one request, no cap warning', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; return { ok: true, status: 200, json: async () => pageOf(0, 1000) }; };
  const { errors } = await captureErrors(() => fetchRippling(BIG_EP, { fetchImpl, maxPages: 1, ...FAST }));
  assert.equal(n, 1);
  assert.ok(!errors.some((e) => /raise max_pages/.test(e)));
});

test('fetchRippling: a later page failing keeps earlier pages, no cap warning', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; if (n === 1) return { ok: true, status: 200, json: async () => pageOf(0, 1000) }; throw new Error('page 1 blew up'); };
  const { result, errors } = await captureErrors(() => fetchRippling(BIG_EP, { fetchImpl, ...FAST }));
  assert.equal(result.length, 1000);
  assert.ok(!errors.some((e) => /raise max_pages/.test(e)));
  assert.ok(errors.some((e) => /truncated at page 2/.test(e)));
});

test('fetchRippling: a page-0 failure throws (dead board reads as failure)', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(() => fetchRippling(BIG_EP, { fetchImpl, ...FAST }));
});

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

test('adapter.matches: true for careers_url on ats.rippling.com', () => {
  assert.ok(ripplingAdapter.matches({ careers_url: VALID_CAREERS_URL }));
});

test('adapter.matches: true for provider=rippling even without URL', () => {
  assert.ok(ripplingAdapter.matches({ provider: 'rippling' }));
});

test('adapter.matches: false for non-rippling host', () => {
  assert.equal(ripplingAdapter.matches({ careers_url: 'https://acme.com/jobs' }), false);
});

test('adapter.matches: false for empty company', () => {
  assert.equal(ripplingAdapter.matches({}), false);
});

test('adapter.buildEndpoint: transforms careers_url to the v2 same-origin board URL', () => {
  assert.equal(
    ripplingAdapter.buildEndpoint({ careers_url: VALID_CAREERS_URL }),
    VALID_API_URL
  );
});

test('adapter.buildEndpoint: returns null for non-rippling URL', () => {
  assert.equal(
    ripplingAdapter.buildEndpoint({ careers_url: 'https://acme.example.com/jobs' }),
    null
  );
});

// ---------------------------------------------------------------------------
// Exported constants sanity
// ---------------------------------------------------------------------------

test('RIPPLING_CAREERS_HOST_RE matches ats.rippling.com only', () => {
  assert.ok(RIPPLING_CAREERS_HOST_RE.test('ats.rippling.com'));
  assert.ok(!RIPPLING_CAREERS_HOST_RE.test('rippling.com'));
  assert.ok(!RIPPLING_CAREERS_HOST_RE.test('evil.ats.rippling.com.evil.com'));
});

test('RIPPLING_API_HOST and API_BASE constants: v2 same-origin board (parent #4353)', () => {
  assert.equal(RIPPLING_API_HOST, 'ats.rippling.com');
  assert.equal(API_BASE, 'https://ats.rippling.com/api/v2/board');
});
