/**
 * The Muse source + adapter tests (CI-isolated, fake fetchImpl).
 * No live network, no parent-project files, no port binding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchTheMuse,
  assertTheMuseUrl,
  FEED_BASE,
} from '../server/lib/sources/themuse.mjs';
import { themuseAdapter } from '../server/lib/portals/adapters/themuse.mjs';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeJob(overrides = {}) {
  return {
    id: 123,
    name: 'Senior Engineer',
    refs: { landing_page: 'https://www.themuse.com/jobs/acme/senior-engineer' },
    company: { name: 'Acme Corp' },
    locations: [{ name: 'New York, NY' }],
    publication_date: '2026-06-15T00:00:00Z',
    ...overrides,
  };
}

function makeResponse(results, page_count = 1) {
  return { results, page: 0, page_count };
}

function fakeOnePage(jobs) {
  return async () => ({
    ok: true,
    json: async () => makeResponse(jobs),
  });
}

// ---------------------------------------------------------------------------
// normalize / field-shape tests
// ---------------------------------------------------------------------------

test('fetchTheMuse: maps all 12 fields from a standard job', async () => {
  const job = makeJob();
  const fetchImpl = fakeOnePage([job]);
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl });

  assert.equal(results.length, 1);
  const j = results[0];

  assert.equal(j.id, 'themuse-123');
  assert.equal(j.title, 'Senior Engineer');
  assert.equal(j.company, 'Acme Corp');
  assert.equal(j.url, 'https://www.themuse.com/jobs/acme/senior-engineer');
  assert.equal(j.salary, '');
  assert.equal(j.location, 'New York, NY');
  assert.equal(j.isRemote, false);
  assert.equal(j.workplaceType, 'Onsite');
  assert.equal(j.relocates, false);
  assert.equal(j.date, '2026-06-15');
  assert.equal(j.snippet, '');
  assert.equal(j.source, 'themuse');
});

test('fetchTheMuse: url taken from refs.landing_page', async () => {
  const job = makeJob({ refs: { landing_page: 'https://www.themuse.com/jobs/x/y' } });
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl: fakeOnePage([job]) });
  assert.equal(results[0].url, 'https://www.themuse.com/jobs/x/y');
});

test('fetchTheMuse: source field is always "themuse"', async () => {
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl: fakeOnePage([makeJob()]) });
  assert.ok(results.every((j) => j.source === 'themuse'));
});

test('fetchTheMuse: isRemote true when location contains "Remote"', async () => {
  const job = makeJob({ locations: [{ name: 'Remote' }] });
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl: fakeOnePage([job]) });
  assert.equal(results[0].isRemote, true);
  assert.equal(results[0].workplaceType, 'Remote');
});

test('fetchTheMuse: "Flexible" location → isRemote true, canonical Remote workplaceType', async () => {
  // "Flexible" counts as remote-friendly, so isRemote and workplaceType agree
  // on the canonical enum (Remote / Hybrid / Onsite — never the raw "Flexible").
  const job = makeJob({ locations: [{ name: 'Flexible' }] });
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl: fakeOnePage([job]) });
  assert.equal(results[0].isRemote, true);
  assert.equal(results[0].workplaceType, 'Remote');
});

test('fetchTheMuse: multiple locations are joined with ", "', async () => {
  const job = makeJob({ locations: [{ name: 'New York, NY' }, { name: 'Remote' }] });
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl: fakeOnePage([job]) });
  assert.equal(results[0].location, 'New York, NY, Remote');
});

test('fetchTheMuse: falls back to "The Muse" when company.name is absent', async () => {
  const job = makeJob({ company: {} });
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl: fakeOnePage([job]) });
  assert.equal(results[0].company, 'The Muse');
});

test('fetchTheMuse: drops job when name (title) is missing', async () => {
  const job = makeJob({ name: '' });
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl: fakeOnePage([job]) });
  assert.equal(results.length, 0);
});

test('fetchTheMuse: drops job when landing_page URL is invalid/http', async () => {
  const jobHttp = makeJob({ refs: { landing_page: 'http://www.themuse.com/jobs/x' } });
  const jobMissing = makeJob({ refs: {} });
  const results = await fetchTheMuse(FEED_BASE, {
    fetchImpl: fakeOnePage([jobHttp, jobMissing]),
  });
  assert.equal(results.length, 0);
});

test('fetchTheMuse: date is sliced to YYYY-MM-DD', async () => {
  const job = makeJob({ publication_date: '2026-01-20T12:34:56Z' });
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl: fakeOnePage([job]) });
  assert.equal(results[0].date, '2026-01-20');
});

test('fetchTheMuse: date is "" when publication_date is absent', async () => {
  const job = makeJob({ publication_date: undefined });
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl: fakeOnePage([job]) });
  assert.equal(results[0].date, '');
});

// ---------------------------------------------------------------------------
// Pagination tests
// ---------------------------------------------------------------------------

test('fetchTheMuse: reads page_count from first page and iterates', async () => {
  let calls = 0;
  const pages = [
    { results: [makeJob({ id: 1, name: 'Job 1' })], page_count: 2 },
    { results: [makeJob({ id: 2, name: 'Job 2' })], page_count: 2 },
  ];
  const fetchImpl = async (url) => {
    const n = Number(new URL(url).searchParams.get('page') ?? 0);
    calls++;
    return { ok: true, json: async () => pages[n] };
  };
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl, maxPages: 5 });
  assert.equal(calls, 2);
  assert.equal(results.length, 2);
});

test('fetchTheMuse: maxPages clamps at 50', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: true, json: async () => ({ results: [makeJob({ id: calls })], page_count: 100 }) };
  };
  await fetchTheMuse(FEED_BASE, { fetchImpl, maxPages: 999 });
  assert.equal(calls, 50);
});

test('fetchTheMuse: maxPages clamps minimum to 1', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: true, json: async () => ({ results: [makeJob()], page_count: 5 }) };
  };
  await fetchTheMuse(FEED_BASE, { fetchImpl, maxPages: -10 });
  assert.equal(calls, 1);
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

test('fetchTheMuse: throws on non-ok first page', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(
    () => fetchTheMuse(FEED_BASE, { fetchImpl }),
    /HTTP 503/,
  );
});

test('fetchTheMuse: throws on unexpected API shape on first page', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ data: [] }) });
  await assert.rejects(
    () => fetchTheMuse(FEED_BASE, { fetchImpl }),
    /unexpected API response/,
  );
});

// v1.242.0 Phase 2 — a later-page failure keeps the earlier pages.
test('fetchTheMuse: a later-page JSON failure keeps earlier pages and logs', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call++;
    if (call === 1) return { ok: true, json: async () => ({ results: [makeJob({ id: 1 })], page_count: 3 }) };
    return { ok: true, json: async () => { throw new Error('Unexpected token <'); } };
  };
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  let results;
  try {
    results = await fetchTheMuse(FEED_BASE, { fetchImpl, maxPages: 5 });
  } finally {
    console.error = orig;
  }
  assert.equal(results.length, 1);
  assert.match(errs.join(' '), /themuse/i);
});

test('fetchTheMuse: a later-page wrong shape keeps earlier pages', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call++;
    if (call === 1) return { ok: true, json: async () => ({ results: [makeJob({ id: 1 })], page_count: 3 }) };
    return { ok: true, json: async () => ({ broken: true }) };
  };
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  let results;
  try {
    results = await fetchTheMuse(FEED_BASE, { fetchImpl, maxPages: 5 });
  } finally {
    console.error = orig;
  }
  assert.equal(results.length, 1);
  assert.match(errs.join(' '), /themuse/i);
});

test('fetchTheMuse: a raw empty page stops pagination', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: true, json: async () => ({ results: calls === 1 ? [makeJob({ id: 1 })] : [], page_count: 5 }) };
  };
  const results = await fetchTheMuse(FEED_BASE, { fetchImpl, maxPages: 5 });
  assert.equal(calls, 2, 'stops on the raw empty page instead of walking page_count');
  assert.equal(results.length, 1);
});

// ---------------------------------------------------------------------------
// SSRF guard — assertTheMuseUrl
// ---------------------------------------------------------------------------

test('assertTheMuseUrl: accepts https://www.themuse.com/…', () => {
  assert.equal(assertTheMuseUrl(FEED_BASE), FEED_BASE);
  assert.equal(
    assertTheMuseUrl('https://www.themuse.com/api/public/jobs?page=0'),
    'https://www.themuse.com/api/public/jobs?page=0',
  );
});

test('assertTheMuseUrl: rejects non-https', () => {
  assert.throws(
    () => assertTheMuseUrl('http://www.themuse.com/api/public/jobs'),
    /must use HTTPS/,
  );
});

test('assertTheMuseUrl: rejects wrong host', () => {
  assert.throws(
    () => assertTheMuseUrl('https://evil.com/api/public/jobs'),
    /untrusted hostname/,
  );
});

test('assertTheMuseUrl: rejects invalid URL string', () => {
  assert.throws(() => assertTheMuseUrl('not-a-url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('adapter: id and label', () => {
  assert.equal(themuseAdapter.id, 'themuse');
  assert.equal(themuseAdapter.label, 'The Muse');
});

test('adapter: matches only on provider=themuse', () => {
  assert.ok(themuseAdapter.matches({ provider: 'themuse' }));
  assert.equal(themuseAdapter.matches({ provider: 'remotive' }), false);
  assert.equal(themuseAdapter.matches({ careers_url: 'https://www.themuse.com' }), false);
  assert.equal(themuseAdapter.matches({}), false);
});

test('adapter: buildEndpoint returns FEED_BASE when no override', () => {
  assert.equal(themuseAdapter.buildEndpoint({ provider: 'themuse' }), FEED_BASE);
});

test('adapter: buildEndpoint prefers themuse: key over api:', () => {
  assert.equal(
    themuseAdapter.buildEndpoint({ provider: 'themuse', themuse: 'https://www.themuse.com/api/public/jobs?category=Engineering' }),
    'https://www.themuse.com/api/public/jobs?category=Engineering',
  );
});

test('adapter: buildEndpoint falls back to api: when themuse: absent', () => {
  assert.equal(
    themuseAdapter.buildEndpoint({ provider: 'themuse', api: 'https://www.themuse.com/api/public/jobs?level=Senior' }),
    'https://www.themuse.com/api/public/jobs?level=Senior',
  );
});

test('adapter: fetch is fetchTheMuse', async () => {
  // Verify the adapter's fetch function is wired correctly
  const fetchImpl = fakeOnePage([makeJob()]);
  const results = await themuseAdapter.fetch(FEED_BASE, { fetchImpl });
  assert.equal(results.length, 1);
  assert.equal(results[0].source, 'themuse');
});
