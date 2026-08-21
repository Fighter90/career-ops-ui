/**
 * MyCareersFuture source — CI-isolated tests.
 * Uses a fake fetchImpl (no network, no port binding, no parent-project
 * dependency). Parent career-ops parity (providers/mycareersfuture.mjs), adapted
 * to the web-ui source contract.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchMyCareersFuture,
  parseConfig,
  cleanUrl,
  normalizeJob,
  profileTargetKeywords,
  assertApiUrl,
  API_URL,
  meta,
} from '../server/lib/sources/mycareersfuture.mjs';
import { mycareersfutureAdapter } from '../server/lib/portals/adapters/mycareersfuture.mjs';

const okJson = (obj) => ({ ok: true, json: async () => obj });
// A permanent 4xx (not retried by fetchJsonWithRetry) keeps the failure tests
// fast — a 5xx/429 would burn the retry budget with real backoff delays.
const errStatus = (status) => ({ ok: false, status, headers: { get: () => null }, json: async () => ({}) });

const TRUSTED_JOB = 'https://www.mycareersfuture.gov.sg/job/software-engineering/acme-abc123';

/** Build one raw `results[]` record. */
function rawJob({
  jobPostId = 'abc123',
  title = 'Software Engineer',
  jobDetailsUrl = TRUSTED_JOB,
  hiringCompany, // { name }
  postedCompany, // { name }
  districts = [{ location: 'Downtown Core' }],
  newPostingDate = '2026-08-20T00:00:00.000Z',
} = {}) {
  const r = {
    title,
    metadata: { jobPostId, jobDetailsUrl, newPostingDate },
    address: { districts },
  };
  if (hiringCompany !== undefined) r.hiringCompany = hiringCompany;
  if (postedCompany !== undefined) r.postedCompany = postedCompany;
  return r;
}

/**
 * fetchImpl mapping the POSTed body's `search` → array-of-pages of `results[]`,
 * indexed by the QUERY-STRING `page` param (0-indexed — the param that actually
 * advances). Records every call. A page beyond the array answers empty.
 */
function fakeSearch(byKeyword) {
  const calls = [];
  const impl = async (url, opts) => {
    const u = new URL(url);
    const body = opts && opts.body ? JSON.parse(opts.body) : {};
    const page = Number(u.searchParams.get('page'));
    calls.push({ url, method: opts?.method, body, page, headers: opts?.headers });
    const pages = byKeyword[body.search] || [];
    return okJson({ results: pages[page] ?? [] });
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// meta + adapter
// ---------------------------------------------------------------------------

test('meta is { value: "mycareersfuture", label: "MyCareersFuture", region: "en" }', () => {
  assert.deepEqual(meta, { value: 'mycareersfuture', label: 'MyCareersFuture', region: 'en' });
});

test('adapter matches provider:mycareersfuture or a mycareersfuture.gov.sg host; host-pins the endpoint', () => {
  assert.equal(mycareersfutureAdapter.matches({ provider: 'mycareersfuture' }), true);
  assert.equal(mycareersfutureAdapter.matches({ careers_url: 'https://www.mycareersfuture.gov.sg/search' }), true);
  assert.equal(mycareersfutureAdapter.matches({ api: 'https://api.mycareersfuture.gov.sg/v2/search' }), true);
  assert.equal(mycareersfutureAdapter.matches({ provider: 'other' }), false);
  assert.equal(mycareersfutureAdapter.matches({ careers_url: 'https://mycareersfuture.gov.sg.evil.com/x' }), false);
  assert.equal(mycareersfutureAdapter.matches({ careers_url: 'http://www.mycareersfuture.gov.sg/x' }), false);
  assert.equal(mycareersfutureAdapter.buildEndpoint({}), API_URL);
  assert.equal(mycareersfutureAdapter.buildEndpoint({ api: 'https://api.mycareersfuture.gov.sg/x' }), 'https://api.mycareersfuture.gov.sg/x');
});

// ---------------------------------------------------------------------------
// assertApiUrl (host guard)
// ---------------------------------------------------------------------------

test('assertApiUrl accepts api.mycareersfuture.gov.sg HTTPS, rejects other hosts/schemes/spoofs', () => {
  assert.equal(assertApiUrl(API_URL), API_URL);
  assert.throws(() => assertApiUrl('http://api.mycareersfuture.gov.sg/x'), /must use HTTPS/);
  assert.throws(() => assertApiUrl('https://evil.example.com/x'), /untrusted hostname/);
  assert.throws(() => assertApiUrl('https://api.mycareersfuture.gov.sg.evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertApiUrl('https://www.mycareersfuture.gov.sg/x'), /untrusted hostname/); // www ≠ api host-pin
  assert.throws(() => assertApiUrl('not a url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// parseConfig (keyword sanitize + size/max_pages clamping)
// ---------------------------------------------------------------------------

test('parseConfig returns defaults when the block is absent', () => {
  assert.deepEqual(parseConfig({}), { keywords: [], size: 100, maxPages: 5 });
  assert.deepEqual(parseConfig({ mycareersfuture: {} }), { keywords: [], size: 100, maxPages: 5 });
});

test('parseConfig trims, drops non-strings, and dedups keywords', () => {
  const cfg = parseConfig({ mycareersfuture: { keywords: ['  python  ', '', 7, 'data engineer', 'python'] } });
  assert.deepEqual(cfg.keywords, ['python', 'data engineer']);
});

test('parseConfig clamps size to the server ceiling (1..100)', () => {
  assert.equal(parseConfig({ mycareersfuture: { size: 250 } }).size, 100); // > MAX_PAGE_SIZE
  assert.equal(parseConfig({ mycareersfuture: { size: 0 } }).size, 1); // below floor
  assert.equal(parseConfig({ mycareersfuture: { size: 42 } }).size, 42); // in range
  assert.equal(parseConfig({ mycareersfuture: { size: 'nope' } }).size, 100); // NaN → default
});

test('parseConfig clamps max_pages to the MAX_PAGES_CAP (1..20), default 5', () => {
  assert.equal(parseConfig({ max_pages: 999 }).maxPages, 20); // > cap
  assert.equal(parseConfig({ max_pages: 0 }).maxPages, 1); // below floor
  assert.equal(parseConfig({ max_pages: 7 }).maxPages, 7); // in range
  assert.equal(parseConfig({}).maxPages, 5); // absent → default
});

// ---------------------------------------------------------------------------
// cleanUrl (job-detail host lock)
// ---------------------------------------------------------------------------

test('cleanUrl accepts the trusted www host over HTTPS', () => {
  assert.equal(cleanUrl(TRUSTED_JOB), TRUSTED_JOB);
  assert.equal(cleanUrl(`  ${TRUSTED_JOB}  `), TRUSTED_JOB); // trims
});

test('cleanUrl rejects off-host, http scheme, a port, and userinfo', () => {
  assert.equal(cleanUrl('https://evil.example.com/job/1'), '');
  assert.equal(cleanUrl('https://www.mycareersfuture.gov.sg.evil.com/job/1'), '');
  assert.equal(cleanUrl('http://www.mycareersfuture.gov.sg/job/1'), ''); // not HTTPS
  assert.equal(cleanUrl('https://www.mycareersfuture.gov.sg:8443/job/1'), ''); // non-default port
  assert.equal(cleanUrl('https://user:pass@www.mycareersfuture.gov.sg/job/1'), ''); // userinfo
  assert.equal(cleanUrl('https://www.mycareersfuture.gov.sg@evil.example/job/1'), ''); // userinfo spoof — real host is evil
});

test('cleanUrl returns "" for junk / empty / non-string input', () => {
  assert.equal(cleanUrl(''), '');
  assert.equal(cleanUrl('   '), '');
  assert.equal(cleanUrl('not a url'), '');
  assert.equal(cleanUrl(null), '');
  assert.equal(cleanUrl(42), '');
});

// ---------------------------------------------------------------------------
// profileTargetKeywords
// ---------------------------------------------------------------------------

test('profileTargetKeywords extracts primary[] + archetypes[].name, trims/dedups', () => {
  const profile = {
    target_roles: {
      primary: ['  Backend Developer ', 'Backend Developer', ''],
      archetypes: [{ name: 'Platform Engineer' }, { name: '' }, { nope: 'x' }, null],
    },
  };
  assert.deepEqual(profileTargetKeywords(profile), ['Backend Developer', 'Platform Engineer']);
  assert.deepEqual(profileTargetKeywords({}), []);
  assert.deepEqual(profileTargetKeywords({ target_roles: null }), []);
});

// ---------------------------------------------------------------------------
// normalizeJob
// ---------------------------------------------------------------------------

test('normalizeJob maps id/title/url/company/location/postedAt', () => {
  const job = normalizeJob(rawJob({
    jobPostId: 'JP-1',
    title: '  Senior Software Engineer  ',
    hiringCompany: { name: 'Acme Pte Ltd' },
    districts: [{ location: 'Downtown Core' }],
    newPostingDate: '2026-08-20T00:00:00.000Z',
  }));
  assert.equal(job.id, 'JP-1');
  assert.equal(job.title, 'Senior Software Engineer'); // trimmed
  assert.equal(job.company, 'Acme Pte Ltd');
  assert.equal(job.location, 'Downtown Core');
  assert.equal(job.url, TRUSTED_JOB);
  assert.equal(job.postedAt, Date.parse('2026-08-20T00:00:00.000Z'));
});

test('normalizeJob prefers hiringCompany over postedCompany', () => {
  const both = normalizeJob(rawJob({ hiringCompany: { name: 'Real Employer' }, postedCompany: { name: 'Agency' } }));
  assert.equal(both.company, 'Real Employer');
  const posterOnly = normalizeJob(rawJob({ hiringCompany: undefined, postedCompany: { name: 'Agency' } }));
  assert.equal(posterOnly.company, 'Agency');
  const neither = normalizeJob(rawJob({ hiringCompany: undefined, postedCompany: undefined }));
  assert.equal(neither.company, '');
});

test('normalizeJob joins address.districts[].location by ", " and tolerates gaps', () => {
  const many = normalizeJob(rawJob({ districts: [{ location: 'Downtown Core' }, { location: 'Orchard' }, { nope: 1 }, null] }));
  assert.equal(many.location, 'Downtown Core, Orchard');
  const none = normalizeJob(rawJob({ districts: [] }));
  assert.equal(none.location, '');
  const noAddress = normalizeJob({ title: 'X', metadata: { jobPostId: '1', jobDetailsUrl: TRUSTED_JOB } });
  assert.equal(noAddress.location, '');
});

test('normalizeJob returns null on a missing id, title, or trusted url', () => {
  assert.equal(normalizeJob(rawJob({ jobPostId: '' })), null); // no id
  assert.equal(normalizeJob(rawJob({ jobPostId: 0 })), null); // falsy id
  assert.equal(normalizeJob(rawJob({ title: '   ' })), null); // blank title
  assert.equal(normalizeJob(rawJob({ jobDetailsUrl: 'https://evil.example.com/job/1' })), null); // off-host url
  assert.equal(normalizeJob({}), null); // empty record
  assert.equal(normalizeJob(null), null);
});

test('normalizeJob omits postedAt when newPostingDate is unparseable', () => {
  const j = normalizeJob(rawJob({ newPostingDate: 'not a date' }));
  assert.equal('postedAt' in j, false);
  // metadata with no newPostingDate field at all → still no postedAt
  const j2 = normalizeJob({ title: 'X', metadata: { jobPostId: '1', jobDetailsUrl: TRUSTED_JOB } });
  assert.equal('postedAt' in j2, false);
});

test('normalizeJob coerces a numeric jobPostId to a string id', () => {
  const j = normalizeJob(rawJob({ jobPostId: 987654 }));
  assert.equal(j.id, '987654');
});

// ---------------------------------------------------------------------------
// fetchMyCareersFuture — keyword threading, dedup, POST shape
// ---------------------------------------------------------------------------

test('fetchMyCareersFuture queries each keyword, dedups by id, strips the id, POSTs JSON', async () => {
  const shared = [rawJob({ jobPostId: 'SHARED' })]; // same posting id under both keywords
  const impl = fakeSearch({ python: [shared], data: [shared] });
  const jobs = await fetchMyCareersFuture(API_URL, {
    fetchImpl: impl,
    company: { name: 'MCF', mycareersfuture: { keywords: ['python', 'data'] } },
  });
  assert.equal(jobs.length, 1); // deduped across keywords by id
  assert.equal('id' in jobs[0], false); // dedup id stripped from the returned shape
  const kws = impl.calls.map((c) => c.body.search);
  assert.deepEqual([...new Set(kws)].sort(), ['data', 'python']);
  assert.equal(impl.calls[0].method, 'POST');
  assert.equal(impl.calls[0].headers['content-type'], 'application/json');
  assert.deepEqual(impl.calls[0].body.sortBy, ['new_posting_date']);
});

test('fetchMyCareersFuture puts the page in the query string (limit + page)', async () => {
  const impl = fakeSearch({ python: [[rawJob()]] });
  await fetchMyCareersFuture(API_URL, { fetchImpl: impl, company: { mycareersfuture: { keywords: ['python'], size: 42 } } });
  const u = new URL(impl.calls[0].url);
  assert.equal(u.searchParams.get('limit'), '42');
  assert.equal(u.searchParams.get('page'), '0');
});

test('fetchMyCareersFuture falls back to injected profile keywords when config has none', async () => {
  const impl = fakeSearch({ 'Backend Developer': [[rawJob()]] });
  const jobs = await fetchMyCareersFuture(API_URL, {
    fetchImpl: impl,
    profileKeywords: ['Backend Developer'],
    company: { name: 'MCF', mycareersfuture: {} },
  });
  assert.equal(jobs.length, 1);
  assert.equal(impl.calls[0].body.search, 'Backend Developer');
});

test('fetchMyCareersFuture throws when no config keywords and no profile fallback (no fetch)', async () => {
  let called = false;
  await assert.rejects(
    () => fetchMyCareersFuture(API_URL, {
      fetchImpl: async () => { called = true; return okJson({ results: [] }); },
      profileKeywords: [], // no profile roles → no fallback
      company: { name: 'Empty', mycareersfuture: {} },
    }),
    /no mycareersfuture\.keywords\[\] and no config\/profile\.yml target_roles/,
  );
  assert.equal(called, false);
});

test('fetchMyCareersFuture rejects an off-host endpoint override before any fetch', async () => {
  let called = false;
  await assert.rejects(
    () => fetchMyCareersFuture('https://evil.example.com/search', {
      fetchImpl: async () => { called = true; return okJson({ results: [] }); },
      company: { mycareersfuture: { keywords: ['python'] } },
    }),
    /untrusted hostname/,
  );
  assert.equal(called, false);
});

// ---------------------------------------------------------------------------
// pagination + page caps
// ---------------------------------------------------------------------------

/** A full page of exactly `size` distinct postings. */
function fullPage(size, offset) {
  return Array.from({ length: size }, (_, i) => rawJob({ jobPostId: `id-${offset + i}` }));
}

test('fetchMyCareersFuture paginates while pages are full, stops on a short page', async () => {
  const impl = fakeSearch({ python: [fullPage(2, 0), [rawJob({ jobPostId: 'last' })]] });
  const jobs = await fetchMyCareersFuture(API_URL, { fetchImpl: impl, company: { mycareersfuture: { keywords: ['python'], size: 2 } } });
  assert.equal(jobs.length, 3); // 2 (full page 0) + 1 (short page 1)
  const pages = impl.calls.map((c) => c.page);
  assert.deepEqual(pages, [0, 1]); // stopped after the short page 1
});

test('fetchMyCareersFuture stops after one request when page 0 is already short', async () => {
  const impl = fakeSearch({ python: [[rawJob()]] });
  await fetchMyCareersFuture(API_URL, { fetchImpl: impl, company: { mycareersfuture: { keywords: ['python'], size: 100 } } });
  assert.equal(impl.calls.length, 1);
});

test('fetchMyCareersFuture honours opts.maxPages (bounded probe) even when every page is full', async () => {
  let requests = 0;
  const impl = async () => { requests++; return okJson({ results: [rawJob({ jobPostId: `p-${requests}` })] }); };
  await fetchMyCareersFuture(API_URL, { fetchImpl: impl, maxPages: 2, company: { mycareersfuture: { keywords: ['python'], size: 1 } } });
  assert.equal(requests, 2);
});

test('fetchMyCareersFuture clamps a configured max_pages to the MAX_PAGES_CAP (20)', async () => {
  let requests = 0;
  const impl = async () => { requests++; return okJson({ results: [rawJob({ jobPostId: `p-${requests}` })] }); };
  await fetchMyCareersFuture(API_URL, { fetchImpl: impl, company: { mycareersfuture: { keywords: ['python'], size: 1 }, max_pages: 999 } });
  assert.equal(requests, 20);
});

// ---------------------------------------------------------------------------
// recall-first: partial success vs total outage
// ---------------------------------------------------------------------------

test('fetchMyCareersFuture does not throw when one keyword fails and another answers empty', async () => {
  const impl = async (url, opts) => {
    const kw = JSON.parse(opts.body).search;
    if (kw === 'bad') return errStatus(404);
    return okJson({ results: [] });
  };
  const jobs = await fetchMyCareersFuture(API_URL, { fetchImpl: impl, company: { mycareersfuture: { keywords: ['ok', 'bad'] } } });
  assert.deepEqual(jobs, []);
});

test('fetchMyCareersFuture keeps the good keyword\'s jobs when another keyword fails', async () => {
  const impl = async (url, opts) => {
    const kw = JSON.parse(opts.body).search;
    if (kw === 'bad') return errStatus(404);
    return okJson({ results: [rawJob({ jobPostId: 'from-ok' })] });
  };
  const jobs = await fetchMyCareersFuture(API_URL, { fetchImpl: impl, company: { mycareersfuture: { keywords: ['ok', 'bad'], size: 100 } } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, TRUSTED_JOB);
});

test('fetchMyCareersFuture throws when every keyword request fails (total outage)', async () => {
  await assert.rejects(
    () => fetchMyCareersFuture(API_URL, { fetchImpl: async () => errStatus(404), company: { mycareersfuture: { keywords: ['a', 'b'] } } }),
    /all 2 keyword request\(s\) failed/,
  );
});

test('fetchMyCareersFuture rethrows a keyword failure while probing (bounded health check)', async () => {
  await assert.rejects(
    () => fetchMyCareersFuture(API_URL, {
      fetchImpl: async () => errStatus(404),
      maxPages: 1,
      company: { mycareersfuture: { keywords: ['a', 'b'] } },
    }),
    /HTTP 404/,
  );
});
