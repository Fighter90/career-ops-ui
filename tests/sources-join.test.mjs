/**
 * JOIN (join.com) source + adapter — CI-isolated tests (fake fetchImpl, no
 * network, no parent-project dependency), adapted to the web-ui source contract:
 * rich normalized job objects, host-pinned `fetchText` fetches with
 * `redirect:'error'`, and the successfactors-style dead-board contract (throw
 * on a page-0 failure, keep partials on a later-page failure).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSlug,
  extractNextData,
  normalizeJoinJob,
  fetchJoin,
  meta,
} from '../server/lib/sources/join.mjs';
import { joinAdapter } from '../server/lib/portals/adapters/join.mjs';

// A canned join.com careers page: __NEXT_DATA__ carrying the SSR page state.
const nextDataHtml = (jobs, pageCount, companyDomain = 'acme-corp') =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        initialState: {
          company: { domain: companyDomain },
          jobs: { items: jobs, pagination: { pageCount } },
        },
      },
    },
  })}</script></body></html>`;

// fetchText expects a Response-like object: { ok, status, text() }.
const okRes = (html) => ({ ok: true, status: 200, text: async () => html });
const failRes = (status = 503) => ({ ok: false, status });

// Fake fetchImpl that serves `pages` in call order and records {url, opts}.
// A page value of null (or {fail}) yields a non-2xx response so fetchText throws.
function makeFetch(pages, calls) {
  let i = 0;
  return async (url, opts) => {
    calls.push({ url, opts });
    const page = pages[i++];
    if (page == null || page.fail) return failRes(page?.status || 503);
    return okRes(page);
  };
}

// ---------------------------------------------------------------------------
// meta + adapter surface: host-detected, host-pinned
// ---------------------------------------------------------------------------

test('meta: id/label/region + adapter.id', () => {
  assert.equal(meta.value, 'join');
  assert.equal(meta.label, 'JOIN');
  assert.equal(meta.region, 'en');
  assert.equal(joinAdapter.id, 'join');
  assert.equal(joinAdapter.label, 'JOIN');
});

test('adapter: matches a join.com careers_url; buildEndpoint returns it, else null', () => {
  assert.ok(joinAdapter.matches({ careers_url: 'https://join.com/companies/acme-corp' }));
  assert.equal(joinAdapter.matches({ careers_url: 'https://example.com/careers' }), false);
  assert.equal(joinAdapter.matches({}), false);
  assert.equal(joinAdapter.matches(null), false);

  assert.equal(
    joinAdapter.buildEndpoint({ careers_url: 'https://join.com/companies/acme-corp' }),
    'https://join.com/companies/acme-corp',
  );
  assert.equal(joinAdapter.buildEndpoint({ careers_url: 'https://example.com/careers' }), null);
  assert.equal(joinAdapter.buildEndpoint({}), null);
});

// ---------------------------------------------------------------------------
// extractSlug — anchored to the literal join.com host + /companies/<slug>
// ---------------------------------------------------------------------------

test('extractSlug: extracts the slug from join.com/companies/<slug>', () => {
  assert.equal(extractSlug('https://join.com/companies/acme-corp'), 'acme-corp');
  // a longer path (a specific job) still yields the company slug
  assert.equal(extractSlug('https://join.com/companies/acme-corp/jobs/abc123'), 'acme-corp');
});

test('extractSlug: rejects spoofed hosts (not the literal join.com hostname)', () => {
  assert.equal(extractSlug('https://join.com.evil.com/companies/acme-corp'), null);
  assert.equal(extractSlug('https://evil.com/join.com/companies/acme-corp'), null);
  assert.equal(extractSlug('https://www.join.com/companies/acme-corp'), null);
});

test('extractSlug: returns null for invalid / missing input', () => {
  assert.equal(extractSlug('not a url'), null);
  assert.equal(extractSlug(undefined), null);
  assert.equal(extractSlug(null), null);
  assert.equal(extractSlug('https://join.com/about'), null); // no /companies/<slug>
});

// ---------------------------------------------------------------------------
// extractNextData — pulls + parses the embedded JSON, null on any problem
// ---------------------------------------------------------------------------

test('extractNextData: parses the embedded __NEXT_DATA__ JSON', () => {
  const data = extractNextData(nextDataHtml([{ title: 'X', idParam: '1', city: { cityName: 'Berlin' } }], 1));
  assert.equal(data?.props?.pageProps?.initialState?.jobs?.items?.length, 1);
});

test('extractNextData: returns null when the script tag is absent / malformed / non-string', () => {
  assert.equal(extractNextData('<html>no script here</html>'), null);
  assert.equal(extractNextData('<html><script id="__NEXT_DATA__">not json</script></html>'), null);
  assert.equal(extractNextData(undefined), null);
  assert.equal(extractNextData(null), null);
  assert.equal(extractNextData(42), null);
});

// ---------------------------------------------------------------------------
// normalizeJoinJob — maps one item into the web-ui job shape
// ---------------------------------------------------------------------------

test('normalizeJoinJob: maps an item into the web-ui rich job shape', () => {
  const n = normalizeJoinJob(
    { title: 'Senior AI Engineer', idParam: 'abc123', city: { cityName: 'Berlin' } },
    { company: 'Acme', companySlug: 'acme-corp' },
  );
  assert.ok(n);
  assert.equal(n.id, 'join-abc123');
  assert.equal(n.title, 'Senior AI Engineer');
  assert.equal(n.company, 'Acme');
  assert.equal(n.url, 'https://join.com/companies/acme-corp/jobs/abc123');
  assert.equal(n.salary, '');
  assert.equal(n.location, 'Berlin');
  assert.equal(n.isRemote, false);
  assert.equal(n.workplaceType, '');
  assert.equal(n.relocates, false);
  assert.equal(n.date, '');
  assert.equal(n.snippet, '');
  assert.equal(n.source, 'join');
});

test('normalizeJoinJob: derives isRemote/workplaceType from the location and relocates from the title', () => {
  const remote = normalizeJoinJob(
    { title: 'Backend Engineer', idParam: '9', city: { cityName: 'Remote' } },
    { company: 'Acme', companySlug: 'acme-corp' },
  );
  assert.equal(remote.isRemote, true);
  assert.equal(remote.workplaceType, 'Remote');

  const relo = normalizeJoinJob(
    { title: 'Engineer (visa sponsorship available)', idParam: '10', city: {} },
    { company: 'Acme', companySlug: 'acme-corp' },
  );
  assert.equal(relo.relocates, true);
  assert.equal(relo.location, '');
});

test('normalizeJoinJob: drops items with no idParam (url + id both depend on it) or non-objects', () => {
  assert.equal(normalizeJoinJob({ title: 'X', city: {} }, { companySlug: 'acme-corp' }), null);
  assert.equal(normalizeJoinJob({ title: 'X', idParam: '' }, { companySlug: 'acme-corp' }), null);
  assert.equal(normalizeJoinJob(null, { companySlug: 'acme-corp' }), null);
});

// ---------------------------------------------------------------------------
// fetchJoin — single page, pagination, SSRF hardening, dead-board contract
// ---------------------------------------------------------------------------

test('fetchJoin: maps a single page of items to the normalized job shape', async () => {
  const calls = [];
  const fetchImpl = makeFetch(
    [nextDataHtml([{ title: 'Senior AI Engineer', idParam: 'abc123', city: { cityName: 'Remote' } }], 1)],
    calls,
  );
  const jobs = await fetchJoin('https://join.com/companies/acme-corp', {
    fetchImpl,
    company: { name: 'Acme' },
  });
  assert.equal(calls.length, 1); // pageCount 1 → no pagination
  assert.equal(calls[0].url, 'https://join.com/companies/acme-corp');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Senior AI Engineer');
  assert.equal(jobs[0].url, 'https://join.com/companies/acme-corp/jobs/abc123');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].location, 'Remote');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].source, 'join');
});

test('fetchJoin: company falls back to "" when the entry has no name (scanner backfills)', async () => {
  const calls = [];
  const fetchImpl = makeFetch([nextDataHtml([{ title: 'X', idParam: '1', city: {} }], 1)], calls);
  const jobs = await fetchJoin('https://join.com/companies/acme-corp', { fetchImpl });
  assert.equal(jobs[0].company, '');
});

test('fetchJoin: url company slug comes from state.company.domain, not the URL slug', async () => {
  const calls = [];
  // careers_url slug is "acme-corp" but the page reports domain "acme"
  const fetchImpl = makeFetch(
    [nextDataHtml([{ title: 'X', idParam: '1', city: {} }], 1, 'acme')],
    calls,
  );
  const jobs = await fetchJoin('https://join.com/companies/acme-corp', { fetchImpl });
  assert.equal(jobs[0].url, 'https://join.com/companies/acme/jobs/1');
});

test('fetchJoin: paginates via ?page=N while pagination.pageCount > 1', async () => {
  const calls = [];
  const fetchImpl = makeFetch(
    [
      nextDataHtml([{ title: 'Job 1', idParam: '1', city: {} }], 2),
      nextDataHtml([{ title: 'Job 2', idParam: '2', city: {} }], 2),
    ],
    calls,
  );
  const jobs = await fetchJoin('https://join.com/companies/acme-corp', { fetchImpl });
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://join.com/companies/acme-corp?page=2');
});

test('fetchJoin: passes redirect:"error" on the first and every paginated request (SSRF)', async () => {
  const calls = [];
  const fetchImpl = makeFetch(
    [
      nextDataHtml([{ title: 'Job 1', idParam: '1', city: {} }], 2),
      nextDataHtml([{ title: 'Job 2', idParam: '2', city: {} }], 2),
    ],
    calls,
  );
  await fetchJoin('https://join.com/companies/acme-corp', { fetchImpl });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((c) => c.opts?.redirect === 'error'));
});

test('fetchJoin: dedupes items repeated by url across pages', async () => {
  const calls = [];
  const dup = { title: 'Job 1', idParam: '1', city: {} };
  const fetchImpl = makeFetch(
    [nextDataHtml([dup], 2), nextDataHtml([{ ...dup }], 2)],
    calls,
  );
  const jobs = await fetchJoin('https://join.com/companies/acme-corp', { fetchImpl });
  assert.equal(jobs.length, 1);
});

test('fetchJoin: caps pagination at DEFAULT_MAX_PAGES=50 and warns when the board reports more', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    const n = calls.length;
    return okRes(nextDataHtml([{ title: `Job ${n}`, idParam: String(n), city: {} }], 9999));
  };
  const warnings = [];
  const realError = console.error;
  console.error = (...args) => warnings.push(args.join(' '));
  let jobs;
  try {
    jobs = await fetchJoin('https://join.com/companies/acme-corp', { fetchImpl, company: { name: 'Acme' } });
  } finally {
    console.error = realError;
  }
  assert.equal(calls.length, 50);
  assert.equal(jobs.length, 50);
  assert.ok(warnings.some((w) => w.includes('truncated at max_pages=50')));
});

test('fetchJoin: entry.max_pages overrides the default cap', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    const n = calls.length;
    return okRes(nextDataHtml([{ title: `Job ${n}`, idParam: String(n), city: {} }], 9999));
  };
  const jobs = await fetchJoin('https://join.com/companies/acme-corp', {
    fetchImpl,
    company: { name: 'Acme', max_pages: 3 },
  });
  assert.equal(calls.length, 3);
  assert.equal(jobs.length, 3);
});

test('fetchJoin: throws when careers_url is not a join.com URL (before any request)', async () => {
  let called = false;
  await assert.rejects(
    () =>
      fetchJoin('https://example.com/careers', {
        fetchImpl: async () => {
          called = true;
          return okRes('');
        },
      }),
    /cannot extract slug/,
  );
  assert.equal(called, false);
});

test('fetchJoin: a failing FIRST-page request throws (dead-board contract)', async () => {
  const calls = [];
  const fetchImpl = makeFetch([{ fail: true, status: 503 }], calls);
  await assert.rejects(
    () => fetchJoin('https://join.com/companies/acme-corp', { fetchImpl }),
    /HTTP 503/,
  );
});

test('fetchJoin: throws when the first page has missing / non-array __NEXT_DATA__', async () => {
  await assert.rejects(
    () => fetchJoin('https://join.com/companies/acme-corp', { fetchImpl: makeFetch(['<html>no next data</html>'], []) }),
    /unexpected structure/,
  );
  // jobs.items present but not an array on the first page
  await assert.rejects(
    () =>
      fetchJoin('https://join.com/companies/acme-corp', {
        fetchImpl: makeFetch([nextDataHtml({ not: 'an array' }, 1)], []),
      }),
    /unexpected structure/,
  );
});

test('fetchJoin: keeps partials when a LATER page fetch fails (does not throw)', async () => {
  const calls = [];
  const fetchImpl = makeFetch(
    [nextDataHtml([{ title: 'Job 1', idParam: '1', city: {} }], 2), { fail: true, status: 500 }],
    calls,
  );
  const jobs = await fetchJoin('https://join.com/companies/acme-corp', { fetchImpl });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 1); // page-1 partial kept
  assert.equal(jobs[0].url, 'https://join.com/companies/acme-corp/jobs/1');
});

test('fetchJoin: keeps partials when a LATER page has missing / non-array __NEXT_DATA__', async () => {
  const brokenParse = makeFetch(
    [nextDataHtml([{ title: 'Job 1', idParam: '1', city: {} }], 2), '<html>no next data on page 2</html>'],
    [],
  );
  const brokenJobs = await fetchJoin('https://join.com/companies/acme-corp', { fetchImpl: brokenParse });
  assert.equal(brokenJobs.length, 1);

  const nonArray = makeFetch(
    [nextDataHtml([{ title: 'Job 1', idParam: '1', city: {} }], 2), nextDataHtml({ not: 'an array' }, 2)],
    [],
  );
  const nonArrayJobs = await fetchJoin('https://join.com/companies/acme-corp', { fetchImpl: nonArray });
  assert.equal(nonArrayJobs.length, 1);
});
