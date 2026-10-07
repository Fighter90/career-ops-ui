/**
 * NoFluffJobs source + adapter tests (v1.80.0 parity).
 * CI-isolated: fake fetchImpl only — no live network, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchNoFluffJobs,
  assertNoFluffUrl,
  API_URL,
  JOB_BASE,
  meta,
} from '../server/lib/sources/nofluffjobs.mjs';
import { nofluffjobsAdapter } from '../server/lib/portals/adapters/nofluffjobs.mjs';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const SAMPLE_POSTINGS = [
  {
    id: 'abc-123',
    url: 'abc-engineer-acme',
    title: 'Senior Backend Engineer',
    name: 'Acme Corp',
    location: { places: [{ city: 'Warsaw' }, { city: 'Kraków' }], fullyRemote: false },
    fullyRemote: false,
    salary: { from: 15000, to: 22000, currency: 'PLN' },
    posted: new Date('2026-06-15').getTime(),
  },
  {
    id: 'xyz-456',
    url: 'xyz-remote-devops',
    title: 'DevOps Engineer',
    name: 'Globex',
    location: { places: [], fullyRemote: true },
    fullyRemote: true,
    salary: null,
    posted: null,
  },
  {
    // missing title → should be filtered out
    id: 'bad-001',
    url: 'bad-job',
    title: '',
    name: 'Bad Co',
    location: {},
    fullyRemote: false,
    salary: null,
    posted: null,
  },
];

function makeFetchImpl(postings = SAMPLE_POSTINGS, ok = true) {
  return async (url, init) => {
    assert.equal(init.method, 'POST', 'request method must be POST');
    assert.ok(init.body, 'request must have a body');
    const parsed = JSON.parse(init.body);
    assert.ok(parsed.criteriaSearch, 'body must contain criteriaSearch');
    assert.ok(parsed.withSalaryMatch === true, 'body must have withSalaryMatch: true');
    return {
      ok,
      status: ok ? 200 : 500,
      json: async () => ({ postings, totalPages: 1 }),
    };
  };
}

/** URL-recording fake: `handler(pageTo)` returns the page body for that page. */
function pagedFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const page = handler(calls.length);
    if (page instanceof Error) throw page;
    return { ok: true, json: async () => page };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// source: fetchNoFluffJobs
// ---------------------------------------------------------------------------

test('fetchNoFluffJobs: uses POST method with correct body shape', async () => {
  // assertion is inside makeFetchImpl — test passes only if POST + criteriaSearch
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.ok(Array.isArray(jobs));
});

test('fetchNoFluffJobs: returns correct number of valid jobs (filters empty title)', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs.length, 2);
});

test('fetchNoFluffJobs: 12-field shape on each job', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  const required = ['id', 'title', 'company', 'url', 'salary', 'location', 'isRemote', 'workplaceType', 'relocates', 'date', 'snippet', 'source'];
  for (const job of jobs) {
    for (const field of required) {
      assert.ok(Object.prototype.hasOwnProperty.call(job, field), `missing field: ${field}`);
    }
  }
});

test('fetchNoFluffJobs: url built from JOB_BASE + slug', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs[0].url, `${JOB_BASE}abc-engineer-acme`);
  assert.equal(jobs[1].url, `${JOB_BASE}xyz-remote-devops`);
});

test('fetchNoFluffJobs: source field is "nofluffjobs"', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.ok(jobs.every((j) => j.source === 'nofluffjobs'));
});

test('fetchNoFluffJobs: id prefixed with "nofluffjobs-"', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.ok(jobs[0].id.startsWith('nofluffjobs-'));
});

test('fetchNoFluffJobs: isRemote false for office jobs, true for remote', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs[0].isRemote, false);
  assert.equal(jobs[1].isRemote, true);
  assert.equal(jobs[1].workplaceType, 'Remote');
});

test('fetchNoFluffJobs: salary formatted as range with currency', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs[0].salary, '15000–22000 PLN');
  assert.equal(jobs[1].salary, '');
});

test('fetchNoFluffJobs: date from epoch ms → YYYY-MM-DD', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs[0].date, '2026-06-15');
  assert.equal(jobs[1].date, '');
});

test('fetchNoFluffJobs: location joins city array', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs[0].location, 'Warsaw, Kraków');
});

test('fetchNoFluffJobs: throws on non-ok HTTP response', async () => {
  const badFetch = makeFetchImpl([], false);
  await assert.rejects(
    () => fetchNoFluffJobs(API_URL, { fetchImpl: badFetch }),
    /HTTP 500/,
  );
});

test('fetchNoFluffJobs: throws on unexpected API shape (no postings array)', async () => {
  const weirdFetch = async (_url, init) => {
    assert.equal(init.method, 'POST');
    return { ok: true, json: async () => ({ items: [] }) };
  };
  await assert.rejects(
    () => fetchNoFluffJobs(API_URL, { fetchImpl: weirdFetch }),
    /NoFluffJobs postings: expected an array/,
  );
});

// ---------------------------------------------------------------------------
// v1.242.0 — the live API 400s without the query params the parent sends
// ('Required parameter salaryCurrency'), pages via pageTo/totalPages, and rows
// without a slug must be dropped (the old post-normalize filter never
// rejected them: the `nofluffjobs-` id prefix is always truthy).
// ---------------------------------------------------------------------------

test('fetchNoFluffJobs: sends the required query params (salaryCurrency et al.)', async () => {
  const fetchImpl = pagedFetch(() => ({ postings: SAMPLE_POSTINGS, totalPages: 1 }));
  await fetchNoFluffJobs(API_URL, { fetchImpl });
  const q = new URL(fetchImpl.calls[0].url).searchParams;
  assert.equal(q.get('sort'), 'newest');
  assert.equal(q.get('withSalaryMatch'), 'true');
  assert.equal(q.get('pageTo'), '1');
  assert.equal(q.get('pageSize'), '20');
  assert.equal(q.get('salaryCurrency'), 'PLN');
  assert.equal(q.get('salaryPeriod'), 'month');
  assert.equal(q.get('region'), 'pl');
  assert.equal(q.get('language'), 'pl-PL');
  assert.equal(new URL(fetchImpl.calls[0].url).pathname, '/api/search/posting');
});

test('fetchNoFluffJobs: loops pageTo until totalPages is reached', async () => {
  const fetchImpl = pagedFetch((n) => ({
    postings: n === 1
      ? Array.from({ length: 20 }, (_, i) => ({ id: `p1-${i}`, url: `page1-${i}`, title: `P1 ${i}`, name: 'Acme' }))
      : Array.from({ length: 10 }, (_, i) => ({ id: `p2-${i}`, url: `page2-${i}`, title: `P2 ${i}`, name: 'Globex' })),
    totalPages: 2,
  }));
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(new URL(fetchImpl.calls[1].url).searchParams.get('pageTo'), '2');
  assert.equal(jobs.length, 30);
});

test('fetchNoFluffJobs: stops on an empty page even when totalPages is missing', async () => {
  const fetchImpl = pagedFetch((n) => (n === 1
    ? { postings: [{ id: 'x', url: 'x', title: 'X', name: 'X' }] }
    : { postings: [] }));
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, 1);
});

test('fetchNoFluffJobs: page cap (5 × 20) bounds a board with no totalPages', async () => {
  const fetchImpl = pagedFetch((n) => ({
    postings: Array.from({ length: 20 }, (_, i) => ({ id: `p${n}-${i}`, url: `u${n}-${i}`, title: `T ${n}-${i}`, name: 'Acme' })),
  }));
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 5);
  assert.equal(jobs.length, 100);
});

test('fetchNoFluffJobs: drops rows without a slug (url AND id missing)', async () => {
  // The old filter ran on the NORMALIZED row, whose id always carries the
  // truthy `nofluffjobs-` prefix — so a slug-less row passed with url: ''.
  const fetchImpl = pagedFetch(() => ({
    postings: [
      { title: 'Ghost Row', name: 'Ghost Co' }, // no url, no id → dropped
      { id: 'real-one', url: 'real-one', title: 'Real', name: 'Acme' },
    ],
    totalPages: 1,
  }));
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, `${JOB_BASE}real-one`);
  assert.ok(jobs.every((j) => j.url.length > 0));
});

test('fetchNoFluffJobs: first-page failure throws; mid-walk failure keeps collected jobs', async () => {
  await assert.rejects(
    () => fetchNoFluffJobs(API_URL, { fetchImpl: async () => ({ ok: false, status: 400 }) }),
    /HTTP 400/,
  );

  const flaky = pagedFetch((n) => {
    if (n === 1) return { postings: [{ id: 'k', url: 'keep', title: 'Keep', name: 'A' }], totalPages: 3 };
    return new Error('boom 503');
  });
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: flaky });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Keep');
});

// ---------------------------------------------------------------------------
// source: assertNoFluffUrl (host lock)
// ---------------------------------------------------------------------------

test('assertNoFluffUrl: accepts https://nofluffjobs.com/*', () => {
  assert.equal(assertNoFluffUrl('https://nofluffjobs.com/api/search/posting'), 'https://nofluffjobs.com/api/search/posting');
  assert.equal(assertNoFluffUrl('https://nofluffjobs.com/pl/job/foo'), 'https://nofluffjobs.com/pl/job/foo');
});

test('assertNoFluffUrl: rejects http (non-HTTPS)', () => {
  assert.throws(() => assertNoFluffUrl('http://nofluffjobs.com/api/search/posting'), /must use HTTPS/);
});

test('assertNoFluffUrl: rejects untrusted hostname', () => {
  assert.throws(() => assertNoFluffUrl('https://evil.com/api/search/posting'), /untrusted hostname/);
});

test('assertNoFluffUrl: rejects invalid URL string', () => {
  assert.throws(() => assertNoFluffUrl('not-a-url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// source: meta export
// ---------------------------------------------------------------------------

test('meta: correct value, label, region', () => {
  assert.equal(meta.value, 'nofluffjobs');
  assert.equal(meta.label, 'NoFluffJobs');
  assert.equal(meta.region, 'en');
});

// ---------------------------------------------------------------------------
// adapter: nofluffjobsAdapter
// ---------------------------------------------------------------------------

test('adapter.matches: true for provider=nofluffjobs', () => {
  assert.ok(nofluffjobsAdapter.matches({ provider: 'nofluffjobs' }));
});

test('adapter.matches: true for careers_url on nofluffjobs.com (https)', () => {
  assert.ok(nofluffjobsAdapter.matches({ careers_url: 'https://nofluffjobs.com/pl/job/x' }));
});

test('adapter.matches: true for api on nofluffjobs.com (https)', () => {
  assert.ok(nofluffjobsAdapter.matches({ api: 'https://nofluffjobs.com/api/search/posting' }));
});

test('adapter.matches: false for http careers_url (not https)', () => {
  assert.equal(nofluffjobsAdapter.matches({ careers_url: 'http://nofluffjobs.com/pl/job/x' }), false);
});

test('adapter.matches: false for unrelated host', () => {
  assert.equal(nofluffjobsAdapter.matches({ careers_url: 'https://greenhouse.io/jobs' }), false);
});

test('adapter.matches: false for empty entry', () => {
  assert.equal(nofluffjobsAdapter.matches({}), false);
});

test('adapter.buildEndpoint: returns API_URL by default', () => {
  assert.equal(nofluffjobsAdapter.buildEndpoint({ provider: 'nofluffjobs' }), API_URL);
  assert.equal(nofluffjobsAdapter.buildEndpoint({ careers_url: 'https://nofluffjobs.com/pl/job/x' }), API_URL);
});

test('adapter.buildEndpoint: respects explicit nofluffjobs override key', () => {
  const override = 'https://nofluffjobs.com/api/search/posting?region=de';
  assert.equal(nofluffjobsAdapter.buildEndpoint({ nofluffjobs: override }), override);
});

test('adapter.buildEndpoint: off-host / non-https override falls back to API_URL', () => {
  assert.equal(nofluffjobsAdapter.buildEndpoint({ nofluffjobs: 'https://evil.com/api/search/posting' }), API_URL);
  assert.equal(nofluffjobsAdapter.buildEndpoint({ nofluffjobs: 'http://nofluffjobs.com/api/search/posting' }), API_URL);
  assert.equal(nofluffjobsAdapter.buildEndpoint({ nofluffjobs: 'not a url' }), API_URL);
});

test('adapter.id and label', () => {
  assert.equal(nofluffjobsAdapter.id, 'nofluffjobs');
  assert.equal(nofluffjobsAdapter.label, 'NoFluffJobs');
});

test('adapter.fetch is fetchNoFluffJobs', () => {
  assert.equal(nofluffjobsAdapter.fetch, fetchNoFluffJobs);
});
