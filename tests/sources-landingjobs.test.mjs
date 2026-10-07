/**
 * Landing.jobs source + adapter tests (v1.80.0 parity).
 * CI-isolated — uses a fake fetchImpl, no network, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchLandingjobs,
  assertLandingjobsUrl,
  companyFromUrl,
  FEED_URL,
} from '../server/lib/sources/landingjobs.mjs';
import { landingjobsAdapter } from '../server/lib/portals/adapters/landingjobs.mjs';

// ---------------------------------------------------------------------------
// Shared fake feed data
// ---------------------------------------------------------------------------
const FAKE_FEED = [
  {
    id: 1001,
    title: 'Senior Backend Engineer',
    url: 'https://landing.jobs/at/acme-corp/senior-backend-engineer',
    locations: [{ city: 'Lisbon', country_code: 'PT' }],
    remote: true,
    published_at: '2026-06-15T10:00:00Z',
    created_at: '2026-06-14T08:00:00Z',
    gross_salary_low: 80000,
    gross_salary_high: 110000,
  },
  {
    id: 1002,
    title: 'Frontend Developer',
    url: 'https://landing.jobs/at/globex-solutions/frontend-dev',
    locations: [],
    remote: false,
    created_at: '2026-06-20T09:00:00Z',
  },
  {
    // Bad host — should be dropped
    id: 1003,
    title: 'Dropped Bad Host',
    url: 'https://evil.com/job/123',
  },
  {
    // Missing title — should be dropped
    id: 1004,
    title: '',
    url: 'https://landing.jobs/at/some-co/role',
  },
  {
    // Missing URL — should be dropped
    id: 1005,
    title: 'No URL Job',
    url: '',
  },
];

function makeFetchImpl(payload) {
  return async () => ({
    ok: true,
    json: async () => payload,
  });
}

// ---------------------------------------------------------------------------
// companyFromUrl
// ---------------------------------------------------------------------------
test('companyFromUrl: derives humanized company from /at/<slug>/<job> path', () => {
  assert.equal(
    companyFromUrl('https://landing.jobs/at/acme-corp/some-role'),
    'Acme Corp',
  );
  assert.equal(
    companyFromUrl('https://landing.jobs/at/my_company/role'),
    'My Company',
  );
});

test('companyFromUrl: returns empty string for non-/at/ paths', () => {
  assert.equal(companyFromUrl('https://landing.jobs/jobs/123'), '');
  assert.equal(companyFromUrl('https://landing.jobs/'), '');
});

test('companyFromUrl: returns empty string for malformed URLs', () => {
  assert.equal(companyFromUrl('not-a-url'), '');
});

// ---------------------------------------------------------------------------
// fetchLandingjobs — normalization
// ---------------------------------------------------------------------------
test('fetchLandingjobs: normalizes valid rows, drops bad rows', async () => {
  const fetchImpl = makeFetchImpl(FAKE_FEED);
  const jobs = await fetchLandingjobs(FEED_URL, { fetchImpl });

  // 3 valid (drops evil.com, missing title, missing url)
  assert.equal(jobs.length, 2);
});

test('fetchLandingjobs: 12-field shape on first job', async () => {
  const fetchImpl = makeFetchImpl(FAKE_FEED);
  const [job] = await fetchLandingjobs(FEED_URL, { fetchImpl });

  // All 12 fields present
  const FIELDS = [
    'id', 'title', 'company', 'url', 'salary', 'location',
    'isRemote', 'workplaceType', 'relocates', 'date', 'snippet', 'source',
  ];
  for (const f of FIELDS) {
    assert.ok(f in job, `field "${f}" missing`);
  }
});

test('fetchLandingjobs: first job field values', async () => {
  const fetchImpl = makeFetchImpl(FAKE_FEED);
  const [job] = await fetchLandingjobs(FEED_URL, { fetchImpl });

  assert.equal(job.id, 'landingjobs-1001');
  assert.equal(job.title, 'Senior Backend Engineer');
  assert.equal(job.company, 'Acme Corp');
  assert.equal(job.url, 'https://landing.jobs/at/acme-corp/senior-backend-engineer');
  assert.equal(job.salary, '80000–110000');
  assert.equal(job.location, 'Lisbon, PT, Remote');
  assert.equal(job.isRemote, true);
  assert.equal(job.workplaceType, 'Remote');
  assert.equal(job.relocates, false);
  assert.equal(job.date, '2026-06-15');
  assert.equal(job.snippet, '');
  assert.equal(job.source, 'landingjobs');
});

test('fetchLandingjobs: second job (on-site, no salary, fallback date from created_at)', async () => {
  const fetchImpl = makeFetchImpl(FAKE_FEED);
  const [, job] = await fetchLandingjobs(FEED_URL, { fetchImpl });

  assert.equal(job.id, 'landingjobs-1002');
  assert.equal(job.company, 'Globex Solutions');
  assert.equal(job.isRemote, false);
  assert.equal(job.workplaceType, 'Onsite');
  assert.equal(job.salary, '');
  assert.equal(job.date, '2026-06-20');
  assert.equal(job.source, 'landingjobs');
});

test('fetchLandingjobs: company-from-url derivation for /at/<slug>/<job>', async () => {
  const fetchImpl = makeFetchImpl([
    {
      id: 99,
      title: 'Engineer',
      url: 'https://landing.jobs/at/my-startup/engineer',
      remote: false,
    },
  ]);
  const [job] = await fetchLandingjobs(FEED_URL, { fetchImpl });
  assert.equal(job.company, 'My Startup');
});

test('fetchLandingjobs: company falls back to Landing.jobs for non-/at/ URLs', async () => {
  const fetchImpl = makeFetchImpl([
    {
      id: 100,
      title: 'Designer',
      url: 'https://landing.jobs/jobs/designer-100',
      remote: false,
    },
  ]);
  const [job] = await fetchLandingjobs(FEED_URL, { fetchImpl });
  assert.equal(job.company, 'Landing.jobs');
});

test('fetchLandingjobs: drops bad-host, missing-title, missing-url rows', async () => {
  const fetchImpl = makeFetchImpl([
    { id: 1, title: 'Bad Host', url: 'https://evil.com/job' },
    { id: 2, title: '', url: 'https://landing.jobs/at/co/role' },
    { id: 3, title: 'Good', url: 'https://landing.jobs/at/co/role' },
    { id: 4, title: 'No URL', url: null },
  ]);
  const jobs = await fetchLandingjobs(FEED_URL, { fetchImpl });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Good');
});

test('fetchLandingjobs: HTTP error throws', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(
    () => fetchLandingjobs(FEED_URL, { fetchImpl }),
    /HTTP 503/,
  );
});

test('fetchLandingjobs: non-array response throws', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ jobs: [] }),
  });
  await assert.rejects(
    () => fetchLandingjobs(FEED_URL, { fetchImpl }),
    /Landing\.jobs jobs: expected an array/,
  );
});

// ---------------------------------------------------------------------------
// v1.242.0 — offset pagination (the un-parameterized GET served only the
// first 50) + the Phase-2 failure contract
// ---------------------------------------------------------------------------

const fullPage = () => Array.from({ length: 50 }, (_, i) => ({
  id: 5000 + i,
  title: `Role ${i}`,
  url: `https://landing.jobs/at/acme/role-${i}`,
}));

/** URL-recording fake: `handler(pageNumber, url)` returns the JSON body. */
function pagedFetch(handler) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const page = handler(calls.length, url);
    if (page instanceof Error) throw page;
    return { ok: true, json: async () => page };
  };
  impl.calls = calls;
  return impl;
}

test('fetchLandingjobs: loops ?limit=50&offset=N until a short page', async () => {
  const fetchImpl = pagedFetch((n) => (n === 1 ? fullPage() : [
    { id: 9999, title: 'Tail Role', url: 'https://landing.jobs/at/globex/tail' },
  ]));
  const jobs = await fetchLandingjobs(FEED_URL, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 2);
  const first = new URL(fetchImpl.calls[0]);
  assert.equal(first.searchParams.get('limit'), '50');
  assert.equal(first.searchParams.get('offset'), '0');
  const second = new URL(fetchImpl.calls[1]);
  assert.equal(second.searchParams.get('offset'), '50');
  assert.equal(jobs.length, 51); // 50 + 1
});

test('fetchLandingjobs: a short first page still costs exactly one request', async () => {
  const fetchImpl = pagedFetch(() => FAKE_FEED);
  const jobs = await fetchLandingjobs(FEED_URL, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(jobs.length, 2);
});

test('fetchLandingjobs: a tenant that ignores offset stops on the first no-fresh page', async () => {
  const fetchImpl = pagedFetch(() => fullPage());
  const jobs = await fetchLandingjobs(FEED_URL, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, 50); // second page re-served the same rows
});

test('fetchLandingjobs: the page cap bounds a full-page board (25 × 50)', async () => {
  let n = 0;
  const fetchImpl = pagedFetch(() => {
    n += 1;
    return fullPage().map((j) => ({ ...j, id: j.id + n * 1000, url: `https://landing.jobs/at/acme/role-${n}-${j.id}` }));
  });
  const jobs = await fetchLandingjobs(FEED_URL, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 25);
  assert.equal(jobs.length, 25 * 50);
});

test('fetchLandingjobs: first-page failure throws; mid-walk failure keeps collected jobs', async () => {
  await assert.rejects(
    () => fetchLandingjobs(FEED_URL, { fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /HTTP 503/,
  );

  const flaky = pagedFetch((n) => (n === 1 ? fullPage() : new Error('boom 429')));
  const jobs = await fetchLandingjobs(FEED_URL, { fetchImpl: flaky });
  assert.equal(jobs.length, 50);
  assert.equal(jobs[0].title, 'Role 0');
});

// ---------------------------------------------------------------------------
// assertLandingjobsUrl — SSRF host-lock
// ---------------------------------------------------------------------------
test('assertLandingjobsUrl: accepts valid HTTPS landing.jobs URL', () => {
  assert.equal(assertLandingjobsUrl(FEED_URL), FEED_URL);
  assert.equal(
    assertLandingjobsUrl('https://landing.jobs/api/v1/jobs?page=2'),
    'https://landing.jobs/api/v1/jobs?page=2',
  );
});

test('assertLandingjobsUrl: throws on non-HTTPS', () => {
  assert.throws(
    () => assertLandingjobsUrl('http://landing.jobs/api/v1/jobs'),
    /must use HTTPS/,
  );
});

test('assertLandingjobsUrl: throws on untrusted hostname', () => {
  assert.throws(
    () => assertLandingjobsUrl('https://evil.com/api/v1/jobs'),
    /untrusted hostname/,
  );
});

test('assertLandingjobsUrl: throws on malformed URL', () => {
  assert.throws(
    () => assertLandingjobsUrl('not-a-url'),
    /invalid URL/,
  );
});

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
test('adapter: matches only on provider=landingjobs', () => {
  assert.ok(landingjobsAdapter.matches({ provider: 'landingjobs' }));
  assert.equal(landingjobsAdapter.matches({ provider: 'remotive' }), false);
  assert.equal(landingjobsAdapter.matches({ careers_url: 'https://landing.jobs' }), false);
  assert.equal(landingjobsAdapter.matches({}), false);
});

test('adapter: buildEndpoint returns FEED_URL when no override', () => {
  assert.equal(
    landingjobsAdapter.buildEndpoint({ provider: 'landingjobs' }),
    FEED_URL,
  );
});

test('adapter: buildEndpoint respects landingjobs override key', () => {
  assert.equal(
    landingjobsAdapter.buildEndpoint({
      provider: 'landingjobs',
      landingjobs: 'https://landing.jobs/api/v1/jobs?custom=1',
    }),
    'https://landing.jobs/api/v1/jobs?custom=1',
  );
});

test('adapter: buildEndpoint respects api override key', () => {
  assert.equal(
    landingjobsAdapter.buildEndpoint({
      provider: 'landingjobs',
      api: 'https://landing.jobs/api/v1/jobs?api=1',
    }),
    'https://landing.jobs/api/v1/jobs?api=1',
  );
});

test('adapter: id and label', () => {
  assert.equal(landingjobsAdapter.id, 'landingjobs');
  assert.equal(landingjobsAdapter.label, 'Landing.jobs');
});

test('adapter: fetch is fetchLandingjobs', () => {
  assert.equal(landingjobsAdapter.fetch, fetchLandingjobs);
});
