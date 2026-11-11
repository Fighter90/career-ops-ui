/**
 * JibeApply source — CI-isolated tests (fake fetchImpl, no network).
 * v1.242.0: wrong-shape guards (a 200 without the jobs container throws on
 * page 1; a later-page shape failure keeps the pages already fetched) plus
 * pins for the pagination contract that predates this change.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchJibeapply,
  parseJibeapplyResponse,
  toApiUrl,
} from '../server/lib/sources/jibeapply.mjs';

const API = 'https://acme.jibeapply.com/api/jobs';

/** One tenant job row — JibeApply wraps the payload in `data`. */
const mkRow = (slug, overrides = {}) => ({
  data: {
    title: `Role ${slug}`,
    slug,
    hiring_organization: 'Acme',
    city: 'Springfield',
    country: 'US',
    ...overrides,
  },
});

const makePage = (rows, { totalCount, count } = {}) => ({
  jobs: rows,
  totalCount: totalCount ?? rows.length,
  ...(count != null ? { count } : {}),
});

/** fetchImpl(url, opts) → {ok:true, json}; keyed by the `page` query param (1-based). */
function fakeFetch(pages) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const page = Number(new URL(url).searchParams.get('page') || 1);
    return { ok: true, json: async () => pages[page - 1] };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// toApiUrl — careers_url → /api/… form (pins the adapter's detect/build path)
// ---------------------------------------------------------------------------

test('toApiUrl: only https *.jibeapply.com hosts, /api path ensured', () => {
  assert.equal(toApiUrl('https://acme.jibeapply.com'), 'https://acme.jibeapply.com/api/');
  assert.equal(toApiUrl('https://acme.jibeapply.com/jobs'), 'https://acme.jibeapply.com/api/jobs');
  assert.equal(toApiUrl('https://acme.jibeapply.com/api/jobs'), 'https://acme.jibeapply.com/api/jobs');
  assert.equal(toApiUrl('http://acme.jibeapply.com/api/jobs'), null); // non-https
  assert.equal(toApiUrl('https://evil.com/api/jobs'), null); // off-host
  assert.equal(toApiUrl('https://acme.jibeapply.com.evil.com/api/jobs'), null); // suffix trick
  assert.equal(toApiUrl('not a url'), null);
});

// ---------------------------------------------------------------------------
// parseJibeapplyResponse
// ---------------------------------------------------------------------------

test('parseJibeapplyResponse: maps rows to the 12-field shape, origin-pinned URLs', () => {
  const jobs = parseJibeapplyResponse(
    makePage([mkRow('backend-dev'), { data: { title: 'No Slug' } }, null]),
    { name: 'Acme Inc', careers_url: 'https://acme.jibeapply.com' },
  );
  assert.equal(jobs.length, 1); // slugless + null rows dropped
  const j = jobs[0];
  assert.equal(j.id, 'jibeapply-backend-dev');
  assert.equal(j.title, 'Role backend-dev');
  assert.equal(j.company, 'Acme');
  assert.equal(j.url, 'https://acme.jibeapply.com/jobs/backend-dev');
  assert.equal(j.location, 'Springfield, US');
  assert.equal(j.source, 'jibeapply');
  const fields = ['id', 'title', 'company', 'url', 'salary', 'location',
    'isRemote', 'workplaceType', 'relocates', 'date', 'snippet', 'source'];
  for (const f of fields) assert.ok(f in j, `missing field: ${f}`);
});

test('parseJibeapplyResponse: a 200 with a non-array jobs container throws', () => {
  assert.throws(() => parseJibeapplyResponse({ jobs: {} }, {}), /expected an array/);
  assert.throws(() => parseJibeapplyResponse({ jobs: 'nope' }, {}), /expected an array/);
  assert.throws(() => parseJibeapplyResponse({}, {}), /expected an array/);
});

// ---------------------------------------------------------------------------
// fetchJibeapply — pagination + shape guards
// ---------------------------------------------------------------------------

test('fetchJibeapply: paginates by ?page= until totalCount is exhausted', async () => {
  const impl = fakeFetch([
    makePage([mkRow('a1'), mkRow('a2')], { totalCount: 5 }),
    makePage([mkRow('a3'), mkRow('a4')], { totalCount: 5 }),
    makePage([mkRow('a5')], { totalCount: 5 }),
  ]);
  const jobs = await fetchJibeapply(API, { fetchImpl: impl, company: { name: 'Acme' } });
  assert.equal(jobs.length, 5);
  assert.equal(impl.calls.length, 3);
  assert.equal(new URL(impl.calls[1]).searchParams.get('page'), '2');
  assert.equal(new URL(impl.calls[2]).searchParams.get('page'), '3');
});

test('fetchJibeapply: a wrong-shape 200 on page 1 throws instead of reading as an empty board', async () => {
  for (const body of [{ totalCount: 3 }, { jobs: { exploded: true } }, 'nope']) {
    const impl = async () => ({ ok: true, status: 200, json: async () => body });
    await assert.rejects(() => fetchJibeapply(API, { fetchImpl: impl, company: { name: 'X' } }), /JibeApply/);
  }
});

test('fetchJibeapply: a later-page {jobs:{}} keeps the first page instead of throwing TypeError', async () => {
  // The regression: `allJobs.push(...(json.jobs || []))` sat OUTSIDE the page
  // try/catch, so a 200 whose `jobs` was an object blew up the walk and
  // discarded everything fetched so far.
  const impl = fakeFetch([
    makePage([mkRow('keep1'), mkRow('keep2')], { totalCount: 9 }),
    { jobs: { exploded: true }, totalCount: 9 },
  ]);
  const jobs = await fetchJibeapply(API, { fetchImpl: impl, company: { name: 'Acme' } });
  assert.equal(jobs.length, 2); // partials kept
  assert.equal(jobs[0].id, 'jibeapply-keep1');
});

test('fetchJibeapply: a later-page network failure keeps the pages already fetched', async () => {
  const impl = async (url) => {
    const page = Number(new URL(url).searchParams.get('page') || 1);
    if (page === 2) throw new Error('boom 503');
    return { ok: true, json: async () => makePage([mkRow(`p${page}`)], { totalCount: 9 }) };
  };
  const jobs = await fetchJibeapply(API, { fetchImpl: impl, company: { name: 'Acme' } });
  assert.equal(jobs.length, 1);
});

test('fetchJibeapply: company.max_pages caps the walk', async () => {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => makePage([mkRow(`p${calls.length}`)], { totalCount: 999 }) };
  };
  const jobs = await fetchJibeapply(API, { fetchImpl: impl, company: { name: 'Acme', max_pages: 3 } });
  assert.equal(calls.length, 3); // capped despite totalCount=999
  assert.equal(jobs.length, 3);
});

// ---------------------------------------------------------------------------
// CAR-264 (parent #6692) — opt-in page_size, accurate cap warning, canonical
// truncation shape, probe behavior
// ---------------------------------------------------------------------------

test('fetchJibeapply: page_size opt-in sends limit=N on every request', async () => {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    const page = Number(new URL(url).searchParams.get('page') || 1);
    const n = page === 3 ? 50 : 100;
    return {
      ok: true,
      json: async () => makePage(
        Array.from({ length: n }, (_, i) => mkRow(`j${page}-${i}`)),
        { totalCount: 250, count: 250 },
      ),
    };
  };
  const jobs = await fetchJibeapply(API, { fetchImpl: impl, company: { name: 'PetCo', page_size: 100 } });
  assert.equal(calls.length, 3);
  assert.equal(jobs.length, 250);
  assert.ok(calls.every((u) => new URL(u).searchParams.get('limit') === '100'), calls.join(' | '));
  assert.equal(new URL(calls[0]).searchParams.get('page'), null, 'the first request carries limit only');
  assert.equal(new URL(calls[1]).searchParams.get('page'), '2');
  assert.equal(new URL(calls[2]).searchParams.get('page'), '3');
});

test('fetchJibeapply: page_size is capped at 100', async () => {
  let firstUrl = '';
  const impl = async (url) => {
    firstUrl = String(url);
    return { ok: true, json: async () => makePage([mkRow('a')], { totalCount: 1 }) };
  };
  await fetchJibeapply(API, { fetchImpl: impl, company: { name: 'X', page_size: 5000 } });
  assert.equal(new URL(firstUrl).searchParams.get('limit'), '100');
});

test('fetchJibeapply: no limit param without page_size (default unchanged)', async () => {
  let firstUrl = '';
  const impl = async (url) => {
    firstUrl = String(url);
    return { ok: true, json: async () => makePage([mkRow('a')], { totalCount: 1 }) };
  };
  await fetchJibeapply(API, { fetchImpl: impl, company: { name: 'X' } });
  assert.equal(new URL(firstUrl).searchParams.get('limit'), null);
});

test('fetchJibeapply: at MAX_PAGES_CAP the warning names the provider ceiling, not max_pages, and the board is marked truncated', async () => {
  const warns = [];
  const ow = console.warn;
  console.warn = (m) => warns.push(String(m));
  let jobs;
  try {
    jobs = await fetchJibeapply(API, {
      fetchImpl: async () => ({
        ok: true,
        json: async () => makePage(Array.from({ length: 10 }, (_, i) => mkRow(`x${i}`)), { totalCount: 10_000_000, count: 10 }),
      }),
      company: { name: 'Absurd', max_pages: 500 },
    });
  } finally {
    console.warn = ow;
  }
  assert.ok(
    warns.some((w) => /provider ceiling/.test(w) && /5000 of 10000000/.test(w) && /page_size/.test(w)),
    `ceiling warning wrong: ${JSON.stringify(warns)}`,
  );
  assert.ok(!warns.some((w) => /raise max_pages/.test(w)), 'raising max_pages cannot help at the ceiling');
  assert.deepEqual(jobs.truncated, { reason: 'page-cap', fetched: 5000, total: 10000000 });
});

test('fetchJibeapply: below the ceiling the warning still names max_pages, with the canonical truncation shape', async () => {
  const warns = [];
  const ow = console.warn;
  console.warn = (m) => warns.push(String(m));
  let jobs;
  try {
    jobs = await fetchJibeapply(API, {
      fetchImpl: async () => ({ ok: true, json: async () => makePage([mkRow('y')], { totalCount: 999, count: 1 }) }),
      company: { name: 'Y', max_pages: 3 },
    });
  } finally {
    console.warn = ow;
  }
  assert.ok(warns.some((w) => /exceeds max_pages/.test(w)), JSON.stringify(warns));
  assert.deepEqual(jobs.truncated, { reason: 'page-cap', fetched: 3, total: 999 });
});

test('fetchJibeapply: a page failure marks fetch-error and suppresses ceiling guidance', async () => {
  const warns = [];
  const ow = console.warn;
  console.warn = (m) => warns.push(String(m));
  let jobs;
  try {
    jobs = await fetchJibeapply(API, {
      fetchImpl: async (url) => {
        if (new URL(url).searchParams.get('page') === '2') throw new Error('boom 503');
        return { ok: true, json: async () => makePage([mkRow('z')], { totalCount: 10_000_000, count: 1 }) };
      },
      company: { name: 'Z', max_pages: 500 },
    });
  } finally {
    console.warn = ow;
  }
  assert.equal(jobs.length, 1, 'the first page is kept');
  assert.ok(warns.some((w) => /page 2 fetch failed/.test(w)), JSON.stringify(warns));
  assert.ok(!warns.some((w) => /provider ceiling|exceeds max_pages/.test(w)), `cap guidance must not fire on a fetch error: ${JSON.stringify(warns)}`);
  assert.deepEqual(jobs.truncated, { reason: 'fetch-error', fetched: 1, total: 10000000 });
});

test('fetchJibeapply: a probe (opts.maxPages) caps the walk — maxPages 1 requests only page 1', async () => {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      json: async () => makePage(Array.from({ length: 10 }, (_, i) => mkRow(`p${i}`)), { totalCount: 40, count: 10 }),
    };
  };
  const jobs = await fetchJibeapply(API, { fetchImpl: impl, company: { name: 'P' }, maxPages: 1 });
  assert.equal(calls.length, 1);
  assert.equal(jobs.length, 10);
  assert.equal(jobs.truncated, undefined, 'a probe cap is a budget, not a truncation');
});

test('fetchJibeapply: a probe allowed more pages rethrows the original page error', async () => {
  const page2Error = new Error('HTTP 503');
  const impl = async (url) => {
    if (new URL(url).searchParams.get('page') === '2') throw page2Error;
    return {
      ok: true,
      json: async () => makePage(Array.from({ length: 10 }, (_, i) => mkRow(`p${i}`)), { totalCount: 40, count: 10 }),
    };
  };
  const ow = console.warn;
  console.warn = () => {};
  let caught = null;
  try {
    await fetchJibeapply(API, { fetchImpl: impl, company: { name: 'P' }, maxPages: 2 });
  } catch (e) {
    caught = e;
  } finally {
    console.warn = ow;
  }
  assert.equal(caught, page2Error, 'a probe must see the original failure, not first-page jobs as success');
});
