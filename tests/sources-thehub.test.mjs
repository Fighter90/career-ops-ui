/**
 * The Hub source — CI-isolated tests (v2 jobsandfeatured API).
 * Uses a fake fetchImpl (no network, no parent-project dependency).
 *
 * v2 migration (parent 6b33fc4 + ae905db): endpoint is
 * `/api/v2/jobsandfeatured`, the response wraps the list in a `jobs` envelope,
 * URLs are built from the job id, and there is NO posting date (date: '').
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTheHub, assertTheHubUrl, FEED_BASE } from '../server/lib/sources/thehub.mjs';
import { thehubAdapter } from '../server/lib/portals/adapters/thehub.mjs';

// ---------------------------------------------------------------------------
// Fake response helpers (v2 shape)
// ---------------------------------------------------------------------------

function makeJob(overrides = {}) {
  return {
    id: 'acme-42',
    title: 'Senior Engineer',
    company: { name: 'Acme Nordic' },
    isRemote: true,
    location: { address: 'Copenhagen', locality: 'Copenhagen', country: 'Denmark' },
    ...overrides,
  };
}

// v2 wraps the doc list in a `jobs` envelope.
function makePage(docs, pages = 1, page = 1) {
  return { jobs: { docs, pages, page, total: docs.length, limit: 15 } };
}

function fakeFetch(pages, requested) {
  // pages: array of response bodies (one per page requested)
  let call = 0;
  return async (url, _opts) => {
    if (requested) requested.push(url);
    const body = pages[call] ?? pages[pages.length - 1];
    call++;
    return {
      ok: true,
      json: async () => body,
    };
  };
}

// ---------------------------------------------------------------------------
// fetchTheHub — happy path: id-based URL, no date, drops no-title/no-id rows
// ---------------------------------------------------------------------------

test('fetchTheHub: normalizes v2 jobs, builds id-based URL, emits no date', async () => {
  const goodJob = makeJob();
  const noTitle = makeJob({ id: 'nt', title: '' }); // dropped — no title
  const noId = makeJob({ id: '', title: 'Has a title but no id' }); // dropped — no id

  const requested = [];
  const fetchImpl = fakeFetch([makePage([goodJob, noTitle, noId], 1)], requested);
  const jobs = await fetchTheHub(FEED_BASE, { fetchImpl });

  assert.equal(jobs.length, 1, 'only the row with both title and id survives');
  const j = jobs[0];

  // 12-field shape
  assert.equal(j.id, 'thehub-acme-42');
  assert.equal(j.title, 'Senior Engineer');
  assert.equal(j.company, 'Acme Nordic');
  assert.equal(j.url, 'https://thehub.io/jobs/acme-42'); // built from id, not from the response
  assert.equal(j.salary, '');
  assert.equal(j.isRemote, true);
  assert.equal(j.workplaceType, 'Remote');
  assert.equal(j.relocates, false);
  assert.equal(j.date, ''); // v2 carries no posting date — exempt from the age filter
  assert.equal(j.snippet, '');
  assert.equal(j.source, 'thehub');
  assert.ok(typeof j.location === 'string');

  // The default request carries page + countryCode=EU.
  assert.equal(requested[0], 'https://thehub.io/api/v2/jobsandfeatured?page=1&countryCode=EU');
});

// ---------------------------------------------------------------------------
// normalize: company fallback when company.name is absent
// ---------------------------------------------------------------------------

test('fetchTheHub: falls back company name to "The Hub"', async () => {
  const fetchImpl = fakeFetch([makePage([makeJob({ company: null })])]);
  const jobs = await fetchTheHub(FEED_BASE, { fetchImpl });
  assert.equal(jobs[0].company, 'The Hub');
});

// ---------------------------------------------------------------------------
// normalize: non-remote job gets workplaceType Onsite (no "Remote" suffix)
// ---------------------------------------------------------------------------

test('fetchTheHub: non-remote job gets workplaceType Onsite', async () => {
  const job = makeJob({ isRemote: false, location: { locality: 'Berlin', country: 'Germany' } });
  const fetchImpl = fakeFetch([makePage([job])]);
  const jobs = await fetchTheHub(FEED_BASE, { fetchImpl });
  assert.equal(jobs[0].isRemote, false);
  assert.equal(jobs[0].workplaceType, 'Onsite');
  assert.equal(jobs[0].location, 'Berlin, Germany');
});

// ---------------------------------------------------------------------------
// normalize: assembles locality/country and appends "Remote" when isRemote
// ---------------------------------------------------------------------------

test('fetchTheHub: assembles locality/country and appends "Remote"', async () => {
  const job = makeJob({ isRemote: true, location: { locality: 'Oslo', country: 'Norway' } });
  const fetchImpl = fakeFetch([makePage([job])]);
  const jobs = await fetchTheHub(FEED_BASE, { fetchImpl });
  assert.equal(jobs[0].location, 'Oslo, Norway, Remote');
});

// ---------------------------------------------------------------------------
// normalize: a row with no `location` key resolves to "Remote"/"" (never throws)
// ---------------------------------------------------------------------------

test('fetchTheHub: missing location resolves to "Remote"/"" without throwing', async () => {
  const fetchImpl = fakeFetch([makePage([
    makeJob({ id: 'r1', isRemote: true, location: undefined }),
    makeJob({ id: 'r2', isRemote: false, location: undefined }),
  ])]);
  const jobs = await fetchTheHub(FEED_BASE, { fetchImpl });
  assert.equal(jobs.find((j) => j.id === 'thehub-r1').location, 'Remote');
  assert.equal(jobs.find((j) => j.id === 'thehub-r2').location, '');
});

// ---------------------------------------------------------------------------
// normalize: URL-encodes the job id
// ---------------------------------------------------------------------------

test('fetchTheHub: URL-encodes the job id', async () => {
  const fetchImpl = fakeFetch([makePage([makeJob({ id: 'a/b c' })])]);
  const jobs = await fetchTheHub(FEED_BASE, { fetchImpl });
  assert.equal(jobs[0].url, 'https://thehub.io/jobs/a%2Fb%20c');
});

// ---------------------------------------------------------------------------
// pagination: stops at pages total even when maxPages is higher (v2 envelope)
// ---------------------------------------------------------------------------

test('fetchTheHub: pagination stops at reported pages total', async () => {
  // Each page returns 15 docs (full) so the short-page guard doesn't fire.
  // jobs.pages=2 means the API has 2 total pages; the loop must stop after 2.
  let callCount = 0;
  const fetchImpl = async () => {
    callCount++;
    const docs = Array.from({ length: 15 }, (_, i) => makeJob({ id: `p${callCount}-${i}` }));
    return { ok: true, json: async () => ({ jobs: { docs, pages: 2, page: callCount, total: 30, limit: 15 } }) };
  };
  await fetchTheHub(FEED_BASE, { fetchImpl, maxPages: 10 });
  assert.equal(callCount, 2, 'should stop after 2 pages (pages total)');
});

// ---------------------------------------------------------------------------
// pagination: stops when a short page is returned (< PER_PAGE = 15)
// ---------------------------------------------------------------------------

test('fetchTheHub: pagination stops on short page', async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount++;
    const count = callCount === 1 ? 15 : 3; // page 2 is short → last
    const docs = Array.from({ length: count }, (_, i) => makeJob({ id: `s${callCount}-${i}` }));
    return { ok: true, json: async () => ({ jobs: { docs, pages: 99, page: callCount, total: 99, limit: 15 } }) };
  };
  await fetchTheHub(FEED_BASE, { fetchImpl, maxPages: 5 });
  assert.equal(callCount, 2);
});

// ---------------------------------------------------------------------------
// maxPages clamp: values below 1 clamp to 1, values above 50 clamp to 50
// ---------------------------------------------------------------------------

test('fetchTheHub: maxPages clamps to [1, 50]', async () => {
  let callCount = 0;
  const makeFullPage = () => {
    callCount++;
    const docs = Array.from({ length: 15 }, (_, i) => makeJob({ id: `c${callCount}-${i}` }));
    return { ok: true, json: async () => ({ jobs: { docs, pages: 999, page: callCount, total: 9999, limit: 15 } }) };
  };

  callCount = 0;
  await fetchTheHub(FEED_BASE, { fetchImpl: async () => makeFullPage(), maxPages: 0 });
  assert.equal(callCount, 1, 'maxPages=0 clamps to 1');

  callCount = 0;
  await fetchTheHub(FEED_BASE, { fetchImpl: async () => makeFullPage(), maxPages: 9999 });
  assert.equal(callCount, 50, 'maxPages=9999 clamps to 50');
});

// ---------------------------------------------------------------------------
// dead board: first-page HTTP error throws
// ---------------------------------------------------------------------------

test('fetchTheHub: throws on first-page HTTP error (dead board)', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(
    () => fetchTheHub(FEED_BASE, { fetchImpl }),
    /HTTP 503/,
  );
});

// ---------------------------------------------------------------------------
// dead board: the very first request rejecting throws
// ---------------------------------------------------------------------------

test('fetchTheHub: throws when the very first request rejects (dead board)', async () => {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  await assert.rejects(
    () => fetchTheHub(FEED_BASE, { fetchImpl }),
    /ECONNREFUSED/,
  );
});

// ---------------------------------------------------------------------------
// dead board: first-page malformed response throws (v1 shape now invalid)
// ---------------------------------------------------------------------------

test('fetchTheHub: throws on malformed first-page response (missing jobs envelope)', async () => {
  // The old v1 shape `{ docs: [...] }` lacks the v2 `jobs` envelope → malformed.
  const fetchImpl = async () => ({ ok: true, json: async () => ({ docs: [] }) });
  await assert.rejects(
    () => fetchTheHub(FEED_BASE, { fetchImpl }),
    /unexpected API response/,
  );
});

// ---------------------------------------------------------------------------
// partials: a later page failing after page 1 succeeded keeps what's collected
// ---------------------------------------------------------------------------

test('fetchTheHub: keeps already-collected jobs when a later page fails', async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    const page = Number(new URL(url).searchParams.get('page'));
    if (page === 1) {
      const docs = Array.from({ length: 15 }, (_, i) => makeJob({ id: `b1-${i}` }));
      return { ok: true, json: async () => ({ jobs: { docs, pages: 3, page: 1, limit: 15 } }) };
    }
    throw new Error('HTTP 503');
  };
  const jobs = await fetchTheHub(FEED_BASE, { fetchImpl, maxPages: 3 });
  assert.equal(requested.length, 2, 'page 2 was attempted');
  assert.equal(jobs.length, 15, 'page-1 jobs are retained despite the page-2 failure');
});

// ---------------------------------------------------------------------------
// countryCode: default EU appended; an explicit countryCode is preserved
// ---------------------------------------------------------------------------

test('fetchTheHub: preserves a countryCode already on the endpoint (no default override)', async () => {
  const requested = [];
  const endpoint = 'https://thehub.io/api/v2/jobsandfeatured?countryCode=DK';
  const fetchImpl = fakeFetch([makePage([])], requested);
  await fetchTheHub(endpoint, { fetchImpl });
  assert.equal(requested[0], 'https://thehub.io/api/v2/jobsandfeatured?countryCode=DK&page=1');
});

// ---------------------------------------------------------------------------
// assertTheHubUrl: host-lock and HTTPS enforcement
// ---------------------------------------------------------------------------

test('assertTheHubUrl: accepts valid thehub.io HTTPS URL', () => {
  assert.equal(assertTheHubUrl(FEED_BASE), FEED_BASE);
  assert.equal(assertTheHubUrl('https://thehub.io/jobs/foo'), 'https://thehub.io/jobs/foo');
});

test('assertTheHubUrl: rejects non-HTTPS', () => {
  assert.throws(() => assertTheHubUrl('http://thehub.io/api/v2/jobsandfeatured'), /must use HTTPS/);
});

test('assertTheHubUrl: rejects off-host', () => {
  assert.throws(() => assertTheHubUrl('https://evil.com/api/v2/jobsandfeatured'), /untrusted hostname/);
});

test('assertTheHubUrl: rejects invalid URL', () => {
  assert.throws(() => assertTheHubUrl('not-a-url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// Adapter: matches + buildEndpoint
// ---------------------------------------------------------------------------

test('adapter: matches only on provider=thehub', () => {
  assert.ok(thehubAdapter.matches({ provider: 'thehub' }));
  assert.equal(thehubAdapter.matches({ provider: 'remotive' }), false);
  assert.equal(thehubAdapter.matches({ careers_url: 'https://thehub.io' }), false);
});

test('adapter: buildEndpoint returns FEED_BASE when no override', () => {
  assert.equal(thehubAdapter.buildEndpoint({ provider: 'thehub' }), FEED_BASE);
});

test('adapter: buildEndpoint prefers thehub: key, then api:', () => {
  assert.equal(
    thehubAdapter.buildEndpoint({ provider: 'thehub', thehub: 'https://thehub.io/api/v2/jobsandfeatured?countryCode=DK' }),
    'https://thehub.io/api/v2/jobsandfeatured?countryCode=DK',
  );
  assert.equal(
    thehubAdapter.buildEndpoint({ provider: 'thehub', api: 'https://thehub.io/api/v2/jobsandfeatured?countryCode=SE' }),
    'https://thehub.io/api/v2/jobsandfeatured?countryCode=SE',
  );
});

test('adapter: id and label', () => {
  assert.equal(thehubAdapter.id, 'thehub');
  assert.equal(thehubAdapter.label, 'The Hub');
});
