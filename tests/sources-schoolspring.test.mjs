/**
 * SchoolSpring source + adapter — ported from parent career-ops
 * `tests/providers/schoolspring.test.mjs` (host gating, the page parser and
 * the pagination contract), plus web-ui contract checks.
 *
 * Quirks pinned here, all easy to undo by accident:
 *   - `www.` and `api.schoolspring.com` are platform hosts, not districts.
 *   - Only null / {} / [] and `jobsList: []` read as empty; every other
 *     unexpected body throws (a missing `success`, `value: null`, …).
 *   - A page that adds no new posting stops the walk and does NOT blame
 *     max_pages; only our own ceiling on a still-full board warns.
 *   - A failure on a later page fails the whole company (no partial board).
 *
 * CI-isolated: fake fetchImpl, no network, no parent checkout, no port binding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  API_HOST,
  PAGE_SIZE,
  DEFAULT_MAX_PAGES,
  MAX_PAGES_CAP,
  isDistrictHost,
  resolveDistrictHost,
  assertApiUrl,
  resolveMaxPages,
  buildPageUrl,
  parseSchoolSpringPage,
  fetchSchoolSpring,
} from '../server/lib/sources/schoolspring.mjs';
import { schoolspringAdapter } from '../server/lib/portals/adapters/schoolspring.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

// ── fixtures (mirroring the parent's) ───────────────────────────────────────

const ORIGIN = 'https://example.schoolspring.com';
const ENDPOINT = `${ORIGIN}/`;

const PAGE = {
  success: true,
  value: {
    page: 1,
    size: 100,
    jobsList: [
      { jobId: 5930050, employer: 'Gaiser Middle School', title: 'Head Coach', location: 'Exampleville, Washington', displayDate: '2026-09-16T07:00:00' },
      { jobId: 5791497, employer: 'Hudson&#x27;s Bay High School', title: 'Assistant Boys &amp; Girls Coach &#8211; Grade 5', location: 'Exampleville, Washington', displayDate: 'not a date' },
      { jobId: 'abc', employer: 'X', title: 'Non-numeric id', location: 'Y' }, // dropped
      { jobId: 7, employer: 'X', title: '', location: 'Y' }, // no title → dropped
      { employer: 'X', title: 'No id', location: 'Y' }, // no id → dropped
      null, // junk row → dropped
    ],
  },
};

const row = (n) => ({ jobId: 1000 + n, employer: 'E', title: `Job ${n}`, location: 'L', displayDate: '2026-09-01T07:00:00' });
const fullPage = (start) => ({ success: true, value: { jobsList: Array.from({ length: 100 }, (_, i) => row(start + i)) } });
const pageNo = (url) => Number(new URL(url).searchParams.get('page'));
/** A distinct full page per page number, as a real board returns. */
const distinctPage = (url) => fullPage((pageNo(url) - 1) * 100);

function res(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => null } };
}

/** Fake transport that routes by URL and records every call. */
function router(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { impl, calls };
}

const noSleep = { sleep: async () => {}, retryDelayMs: 0 };
const company = { name: 'Acme', careers_url: ENDPOINT };

/** Capture console.warn for the duration of `fn`. */
async function captureWarn(fn) {
  const warnings = [];
  const real = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  try {
    const value = await fn();
    return { value, warnings };
  } finally {
    console.warn = real;
  }
}

// ── meta + adapter ──────────────────────────────────────────────────────────

test('meta is the EN schoolspring source', () => {
  assert.deepEqual(meta, { value: 'schoolspring', label: 'SchoolSpring', region: 'en' });
});

test('adapter shape: id, label, fetch', () => {
  assert.equal(schoolspringAdapter.id, 'schoolspring');
  assert.equal(schoolspringAdapter.label, 'SchoolSpring');
  assert.equal(schoolspringAdapter.fetch, fetchSchoolSpring);
});

for (const url of ['https://example.schoolspring.com/', 'https://Example.SchoolSpring.com/jobs?x=1']) {
  test(`adapter claims and normalizes ${url}`, () => {
    const c = { name: 'Acme', careers_url: url };
    assert.equal(schoolspringAdapter.matches(c), true);
    assert.equal(schoolspringAdapter.buildEndpoint(c), ENDPOINT);
  });
}

test('adapter reads `api:` before careers_url', () => {
  const c = { name: 'Acme', api: 'https://other.schoolspring.com/', careers_url: ENDPOINT };
  assert.equal(schoolspringAdapter.buildEndpoint(c), 'https://other.schoolspring.com/');
});

const NEGATIVES = {
  'the platform www host': { careers_url: 'https://www.schoolspring.com/' },
  'the platform api host': { careers_url: 'https://api.schoolspring.com/' },
  'the bare apex': { careers_url: 'https://schoolspring.com/' },
  'a non-schoolspring host': { careers_url: 'https://example.com/' },
  'a path-spoofed URL': { careers_url: 'https://evil.example/example.schoolspring.com/' },
  'a lookalike suffix host': { careers_url: 'https://example.schoolspring.com.evil.example/' },
  'a lookalike prefix host': { careers_url: 'https://example.evilschoolspring.com/' },
  'a nested subdomain': { careers_url: 'https://a.b.schoolspring.com/' },
  http: { careers_url: 'http://example.schoolspring.com/' },
  'a malformed URL': { careers_url: 'not a url' },
  'null careers_url': { careers_url: null },
  'a non-string careers_url': { careers_url: 7 },
  'no careers_url': {},
};
for (const [label, extra] of Object.entries(NEGATIVES)) {
  test(`adapter does not claim ${label}`, () => {
    const c = { name: 'X', ...extra };
    assert.equal(schoolspringAdapter.matches(c), false);
    assert.equal(schoolspringAdapter.buildEndpoint(c), null);
  });
}

test('an explicit different provider wins; explicit schoolspring on a foreign host yields no endpoint', () => {
  assert.equal(schoolspringAdapter.matches({ name: 'X', provider: 'greenhouse', careers_url: ENDPOINT }), false);
  const explicit = { name: 'X', provider: 'schoolspring', careers_url: 'https://evil.example/' };
  assert.equal(schoolspringAdapter.matches(explicit), true);
  assert.equal(schoolspringAdapter.buildEndpoint(explicit), null);
  assert.equal(schoolspringAdapter.matches(null), false);
});

// ── host + URL helpers ──────────────────────────────────────────────────────

test('isDistrictHost / resolveDistrictHost are anchored and HTTPS-only', () => {
  assert.equal(isDistrictHost('example.schoolspring.com'), true);
  assert.equal(isDistrictHost('www.schoolspring.com'), false);
  assert.equal(isDistrictHost('api.schoolspring.com'), false);
  assert.equal(isDistrictHost(42), false);
  assert.equal(resolveDistrictHost('https://Example.SchoolSpring.com/x'), 'example.schoolspring.com');
  assert.equal(resolveDistrictHost('http://example.schoolspring.com/'), null);
  assert.equal(resolveDistrictHost('  '), null);
});

test('assertApiUrl pins the fixed API host over HTTPS', () => {
  assert.equal(assertApiUrl(buildPageUrl('example.schoolspring.com', 1)), buildPageUrl('example.schoolspring.com', 1));
  for (const bad of [
    'http://api.schoolspring.com/api/Jobs/GetPagedJobsWithSearch',
    'https://api.schoolspring.com.evil.example/x',
    'https://evil.example/api.schoolspring.com',
    'https://api.schoolspring.com:8443/x',
    'https://user:pw@api.schoolspring.com/x',
    'not a url',
  ]) {
    assert.throws(() => assertApiUrl(bad), /schoolspring:/, bad);
  }
});

test('buildPageUrl targets the fixed API with the district as domainName', () => {
  const u = new URL(buildPageUrl('example.schoolspring.com', 3));
  assert.equal(u.origin, `https://${API_HOST}`);
  assert.equal(u.pathname, '/api/Jobs/GetPagedJobsWithSearch');
  assert.equal(u.searchParams.get('domainName'), 'example.schoolspring.com');
  assert.equal(u.searchParams.get('page'), '3');
  assert.equal(u.searchParams.get('size'), String(PAGE_SIZE));
  assert.equal(u.searchParams.get('sortDateAscending'), 'false');
});

test('resolveMaxPages: default, positive-integer override, cap', () => {
  assert.equal(resolveMaxPages({}), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 2 }), 2);
  assert.equal(resolveMaxPages({ max_pages: 1_000_000 }), MAX_PAGES_CAP);
  for (const bad of [0, -1, 2.5, '5', null]) assert.equal(resolveMaxPages({ max_pages: bad }), DEFAULT_MAX_PAGES);
});

// ── parser ──────────────────────────────────────────────────────────────────

test('parser keeps rows with a numeric id + title and reports the raw row count', () => {
  const { jobs, rawCount } = parseSchoolSpringPage(PAGE, 'Acme', ORIGIN);
  assert.equal(jobs.length, 2);
  assert.equal(rawCount, 6);
});

test('parser builds the 12-field web-ui job with <origin>/?jobid=<id>', () => {
  const [job] = parseSchoolSpringPage(PAGE, 'Acme', ORIGIN).jobs;
  assert.deepEqual(job, {
    id: 'schoolspring-example.schoolspring.com-5930050',
    title: 'Head Coach',
    company: 'Acme',
    url: `${ORIGIN}/?jobid=5930050`,
    salary: '',
    location: 'Exampleville, Washington - Gaiser Middle School',
    isRemote: false,
    workplaceType: '',
    relocates: false,
    date: '2026-09-16',
    snippet: '',
    source: 'schoolspring',
  });
});

test("parser decodes the API's HTML entities (&amp; &#x27; and numeric &#8211;)", () => {
  const job = parseSchoolSpringPage(PAGE, 'Acme', ORIGIN).jobs[1];
  assert.equal(job.title, 'Assistant Boys & Girls Coach – Grade 5');
  assert.ok(job.location.endsWith("Hudson's Bay High School"));
});

test('parser leaves date empty when displayDate is unparseable', () => {
  assert.equal(parseSchoolSpringPage(PAGE, 'Acme', ORIGIN).jobs[1].date, '');
});

test('parser flags a remote location', () => {
  const body = { success: true, value: { jobsList: [{ jobId: 1, title: 'Tutor', location: 'Remote', employer: 'E' }] } };
  const [job] = parseSchoolSpringPage(body, 'Acme', ORIGIN).jobs;
  assert.equal(job.isRemote, true);
  assert.equal(job.workplaceType, 'Remote');
});

for (const [label, empty] of [['{}', {}], ['[]', []], ['null', null], ['a real empty board', { success: true, value: { jobsList: [] } }]]) {
  test(`parser: ${label} → empty`, () => {
    assert.equal(parseSchoolSpringPage(empty, 'X', ORIGIN).jobs.length, 0);
  });
}

for (const [label, bad, re] of [
  ['success:false', { success: false, message: 'Domain not found' }, /Domain not found/],
  ['a bare string body ("unavailable")', 'unavailable', /unexpected response type string/],
  ['a bare number body', 503, /unexpected response type number/],
  ['a bare boolean body', true, /unexpected response type boolean/],
  ['an envelope that omits success', { value: { jobsList: [] } }, /did not report success:true/],
  ['success that is not true', { success: 'yes', value: { jobsList: [] } }, /did not report success:true/],
  ['jobsList of the wrong type', { success: true, value: { jobsList: 'oops', extra: 1 } }, /no jobsList array.*extra/],
  ['a value with no jobsList', { success: true, value: {} }, /no jobsList array/],
  ['value: null', { success: true, value: null }, /no jobsList array/],
  ['jobsList: null', { success: true, value: { page: 1, jobsList: null } }, /no jobsList array.*page/],
]) {
  test(`parser throws a descriptive error for ${label}`, () => {
    assert.throws(() => parseSchoolSpringPage(bad, 'X', ORIGIN), re);
  });
}

// ── fetch ───────────────────────────────────────────────────────────────────

test('a short first page makes one redirect-blocked request with the browser UA', async () => {
  const { impl, calls } = router(() => res(PAGE));
  const jobs = await fetchSchoolSpring(ENDPOINT, { fetchImpl: impl, company, ...noSleep });
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
  const u = new URL(calls[0].url);
  assert.equal(u.origin, 'https://api.schoolspring.com');
  assert.equal(u.searchParams.get('domainName'), 'example.schoolspring.com');
  assert.equal(u.searchParams.get('size'), '100');
});

test('fetch rejects unsafe endpoints before any I/O', async () => {
  const { impl, calls } = router(() => res(PAGE));
  for (const url of [
    'https://evil.example/',
    'http://example.schoolspring.com/',
    'https://api.schoolspring.com/',
    'https://example.schoolspring.com.evil.example/',
    'not a url',
  ]) {
    await assert.rejects(fetchSchoolSpring(url, { fetchImpl: impl, company: { name: 'Evil' }, ...noSleep }), /cannot derive district host/);
  }
  assert.equal(calls.length, 0);
});

test('its own DEFAULT_MAX_PAGES (20) stops an endless board and warns "raise max_pages"', async () => {
  const { impl, calls } = router((url) => res(distinctPage(url)));
  const { value: jobs, warnings } = await captureWarn(() => fetchSchoolSpring(ENDPOINT, { fetchImpl: impl, company, ...noSleep }));
  assert.equal(calls.length, 20);
  assert.equal(jobs.length, 2000);
  assert.ok(warnings.some((w) => /raise max_pages/.test(w)));
});

test('the inter-page pause runs between pages, not before the first', async () => {
  const pauses = [];
  const { impl } = router((url) => res(pageNo(url) < 3 ? distinctPage(url) : { success: true, value: { jobsList: [] } }));
  await fetchSchoolSpring(ENDPOINT, { fetchImpl: impl, company, retryDelayMs: 0, sleep: async (ms) => { pauses.push(ms); } });
  assert.equal(pauses.length, 2);
  assert.ok(pauses.every((ms) => ms > 0));
});

test('a repeating page adds no duplicates, stops at once, and does not blame max_pages', async () => {
  const { impl, calls } = router(() => res(fullPage(0)));
  const { value: jobs, warnings } = await captureWarn(() => fetchSchoolSpring(ENDPOINT, { fetchImpl: impl, company, ...noSleep }));
  assert.equal(jobs.length, 100);
  assert.equal(new Set(jobs.map((j) => j.url)).size, 100);
  assert.equal(calls.length, 2);
  assert.ok(!warnings.some((w) => /raise max_pages/.test(w)));
});

test('overlapping pages keep only the new postings', async () => {
  const { impl } = router((url) => res(
    pageNo(url) === 1 ? fullPage(0) : pageNo(url) === 2 ? fullPage(50) : { success: true, value: { jobsList: [] } },
  ));
  const jobs = await fetchSchoolSpring(ENDPOINT, { fetchImpl: impl, company, ...noSleep });
  assert.equal(jobs.length, 150);
  assert.equal(new Set(jobs.map((j) => j.url)).size, 150);
});

test('entry max_pages lowers the ceiling; an absurd override is capped at MAX_PAGES_CAP', async () => {
  let r = router((url) => res(distinctPage(url)));
  await captureWarn(() => fetchSchoolSpring(ENDPOINT, { fetchImpl: r.impl, company: { ...company, max_pages: 2 }, ...noSleep }));
  assert.equal(r.calls.length, 2);
  r = router((url) => res(distinctPage(url)));
  await captureWarn(() => fetchSchoolSpring(ENDPOINT, { fetchImpl: r.impl, company: { ...company, max_pages: 1_000_000 }, ...noSleep }));
  assert.equal(r.calls.length, 100);
});

test('a probe (opts.maxPages) makes one list request and does not blame max_pages', async () => {
  const { impl, calls } = router((url) => res(distinctPage(url)));
  const { warnings } = await captureWarn(() => fetchSchoolSpring(ENDPOINT, { fetchImpl: impl, company, maxPages: 1, ...noSleep }));
  assert.equal(calls.length, 1);
  assert.ok(!warnings.some((w) => /raise max_pages/.test(w)));
});

test('a transport rejection propagates unwrapped', async () => {
  class ProbeSentinel extends Error {}
  const sentinel = new ProbeSentinel('budget');
  // A no-status error is retried; the same sentinel is rethrown after the budget.
  const impl = async () => { throw sentinel; };
  await assert.rejects(fetchSchoolSpring(ENDPOINT, { fetchImpl: impl, company, maxPages: 1, ...noSleep }), (e) => e === sentinel);
});

test('a later page that keeps failing fails the company loudly after 3 attempts, without a max_pages warning', async () => {
  const { impl, calls } = router((url) => (pageNo(url) === 1 ? res(fullPage(0)) : res({}, 503)));
  const { warnings } = await captureWarn(() => assert.rejects(
    fetchSchoolSpring(ENDPOINT, { fetchImpl: impl, company, ...noSleep }),
    (e) => e.status === 503,
  ));
  assert.equal(calls.length, 1 + 3);
  assert.ok(!warnings.some((w) => /raise max_pages/.test(w)));
});

test('a permanent 4xx is not retried (dead-board contract)', async () => {
  const { impl, calls } = router(() => res({}, 404));
  await assert.rejects(fetchSchoolSpring(ENDPOINT, { fetchImpl: impl, company, ...noSleep }), (e) => e.status === 404);
  assert.equal(calls.length, 1);
});

test('a refused redirect is not retried', async () => {
  const { impl, calls } = router(() => {
    throw new TypeError('fetch failed', { cause: new Error('unexpected redirect') });
  });
  await assert.rejects(fetchSchoolSpring(ENDPOINT, { fetchImpl: impl, company, ...noSleep }), TypeError);
  assert.equal(calls.length, 1);
});

test('an API error envelope fails the company instead of reading as empty', async () => {
  const { impl } = router(() => res({ success: false, message: 'Domain not found' }));
  await assert.rejects(fetchSchoolSpring(ENDPOINT, { fetchImpl: impl, company, ...noSleep }), /Domain not found/);
});
