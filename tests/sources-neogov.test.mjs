/**
 * NEOGOV source + adapter — CI-isolated tests (fake fetchImpl, no network, no
 * parent-project dependency, no port binding, nothing reads CAREER_OPS_ROOT).
 *
 * Parity with parent career-ops `tests/providers/neogov.test.mjs`: endpoint
 * host/path gating, the HTML parser (entities, off-site links, empty-vs-wrong
 * page) and the pagination contract (repeat detection, own ceiling + warning,
 * max_pages cap, probe cap, fail-loud on a page error, refused redirect).
 *
 * URL assertions use strict equality, never `String.includes` or an unanchored
 * regex over a URL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  resolveTarget,
  buildPageUrl,
  parseEndpoint,
  parseNeogovPage,
  fetchNeogov,
  INTER_PAGE_DELAY_MS,
} from '../server/lib/sources/neogov.mjs';
import { neogovAdapter } from '../server/lib/portals/adapters/neogov.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

const ORIGIN = 'https://www.schooljobs.com';
const ENDPOINT = `${ORIGIN}/careers/home/index?agency=exampleco&sort=PostingDate&isDescendingSort=true&page=1`;

const item = (id, slug, title, loc, folder = '') => `
    <li class="list-item" data-job-id="${id}">
      <h3 class="job-item-link-container">
        <a aria-label="${title}" class="item-details-link" data-department-name="X" href="/careers/exampleco/${folder}jobs/${id}/${slug}" rel="">${title}</a>
      </h3>
      <ul class="list-meta">
        <li>${loc}</li>
        <li>Part-time Hourly <span>-</span> $93.18 Hourly</li>
      </ul>
    </li>`;
const NOT_FOUND = '<div class="jobs-not-found-container"><h2 class="not-found-text">No jobs at this time.</h2></div>';
const pageOf = (start, n) => `<ul class="search-results-listing-container">${Array.from({ length: n }, (_, i) => item(start + i, `job-${start + i}`, `Job ${start + i}`, 'Vancouver, WA')).join('')}</ul>`;
const pageNo = (url) => Number(new URL(url).searchParams.get('page'));

function res(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body, headers: { get: () => null } };
}

/** Fake transport that records every call. */
function router(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { impl, calls };
}

const noSleep = { sleep: async () => {}, retryDelayMs: 0 };
const company = { name: 'Acme', careers_url: 'https://www.schooljobs.com/careers/exampleco' };

/** Capture console.warn for the duration of fn. */
async function captureWarn(fn) {
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...a) => { warnings.push(a.join(' ')); };
  try {
    return { result: await fn(), warnings };
  } finally {
    console.warn = realWarn;
  }
}

test('meta is the EN neogov source', () => {
  assert.deepEqual(meta, { value: 'neogov', label: 'NEOGOV (SchoolJobs / GovernmentJobs)', region: 'en' });
});

test('adapter shape: id, label, fetch', () => {
  assert.equal(neogovAdapter.id, 'neogov');
  assert.equal(neogovAdapter.label, meta.label);
  assert.equal(neogovAdapter.fetch, fetchNeogov);
});

// ── adapter recognition / buildEndpoint (parent detect()) ─────────────
for (const [careers_url, expected] of [
  ['https://www.schooljobs.com/careers/exampleco', ENDPOINT],
  ['https://www.schooljobs.com/careers/exampleco/facultypositions', `${ORIGIN}/careers/home/index?agency=exampleco&departmentFolder=facultypositions&sort=PostingDate&isDescendingSort=true&page=1`],
  ['https://schooljobs.com/careers/ExampleCo/', ENDPOINT],
  ['https://www.governmentjobs.com/careers/exampleco', 'https://www.governmentjobs.com/careers/home/index?agency=exampleco&sort=PostingDate&isDescendingSort=true&page=1'],
  ['https://GOVERNMENTJOBS.com/careers/exampleco?x=1#frag', 'https://www.governmentjobs.com/careers/home/index?agency=exampleco&sort=PostingDate&isDescendingSort=true&page=1'],
]) {
  test(`adapter recognises ${careers_url}`, () => {
    const entry = { name: 'Acme', careers_url };
    assert.equal(neogovAdapter.matches(entry), true);
    assert.equal(neogovAdapter.buildEndpoint(entry), expected);
  });
}

for (const [label, extra] of Object.entries({
  'a non-NEOGOV host': { careers_url: 'https://example.com/careers/exampleco' },
  'a path-spoofed URL': { careers_url: 'https://evil.example/www.schooljobs.com/careers/exampleco' },
  'a lookalike host (suffix)': { careers_url: 'https://www.schooljobs.com.evil.example/careers/exampleco' },
  'a lookalike host (prefix)': { careers_url: 'https://evilschooljobs.com/careers/exampleco' },
  'a subdomain that is not www': { careers_url: 'https://api.governmentjobs.com/careers/exampleco' },
  'http': { careers_url: 'http://www.schooljobs.com/careers/exampleco' },
  'a non-/careers path': { careers_url: 'https://www.schooljobs.com/jobs/exampleco' },
  'no agency': { careers_url: 'https://www.schooljobs.com/careers' },
  "the site's own /careers/home path": { careers_url: 'https://www.schooljobs.com/careers/home/index' },
  'an agency with illegal characters': { careers_url: 'https://www.schooljobs.com/careers/a%20b' },
  'a folder with illegal characters': { careers_url: 'https://www.schooljobs.com/careers/exampleco/a%2Fb' },
  'a malformed URL': { careers_url: 'not a url' },
  'null careers_url': { careers_url: null },
  'a non-string careers_url': { careers_url: 7 },
  'no careers_url': {},
})) {
  test(`adapter does not recognise ${label}`, () => {
    const entry = { name: 'X', ...extra };
    assert.equal(resolveTarget(entry), null);
    assert.equal(neogovAdapter.matches(entry), false);
    assert.equal(neogovAdapter.buildEndpoint(entry), null);
  });
}

test('explicit provider: neogov matches, but the endpoint stays host-pinned', () => {
  assert.equal(neogovAdapter.matches({ provider: 'neogov', careers_url: 'https://evil.example/careers/x' }), true);
  assert.equal(neogovAdapter.buildEndpoint({ provider: 'neogov', careers_url: 'https://evil.example/careers/x' }), null);
  assert.equal(neogovAdapter.matches(null), false);
  assert.equal(neogovAdapter.matches(undefined), false);
});

test('buildPageUrl / parseEndpoint round-trip', () => {
  const t = { origin: ORIGIN, agency: 'exampleco', folder: 'faculty' };
  assert.deepEqual(parseEndpoint(buildPageUrl(t, 3)), t);
});

for (const bad of [
  'http://www.schooljobs.com/careers/home/index?agency=exampleco',
  'https://schooljobs.com/careers/home/index?agency=exampleco',
  'https://www.schooljobs.com.evil.example/careers/home/index?agency=exampleco',
  'https://user:pw@www.schooljobs.com/careers/home/index?agency=exampleco',
  'https://www.schooljobs.com:8443/careers/home/index?agency=exampleco',
  'https://www.schooljobs.com/careers/exampleco',
  'https://www.schooljobs.com/careers/home/index',
  'https://www.schooljobs.com/careers/home/index?agency=home',
  'https://www.schooljobs.com/careers/home/index?agency=a/b',
  'https://www.schooljobs.com/careers/home/index?agency=ok&departmentFolder=../x',
  'not a url',
]) {
  test(`parseEndpoint rejects ${JSON.stringify(bad)}`, () => {
    assert.throws(() => parseEndpoint(bad), /^Error: neogov: /);
  });
}

// ── parser ────────────────────────────────────────────────────────────
const LIST_HTML = '<div class="listing-title"></div><ul class="unstyled search-results-listing-container job-listing-container ">'
  + item(11, 'math-professor', 'Part-time Math &amp; Science Professor &#8211; Pool', 'Vancouver, WA', 'faculty/')
  + item(12, 'it-professor', 'IT Professor', 'Ridgefield, WA')
  + '<li class="list-item"><a class="item-details-link" href="https://evil.example/careers/exampleco/jobs/13/x">Off-site</a></li>'
  + '<li class="list-item"><a class="item-details-link" href="/careers/exampleco/about">Not a job path</a></li>'
  + '<li class="list-item"><span>no link at all</span></li>'
  + '<li class="list-item"><a href="/careers/exampleco/jobs/14/remote" class="item-details-link">Remote Tutor</a><ul class="list-meta"><li>Remote</li></ul></li>'
  + '<li class="list-item"><a class="item-details-link" href="/careers/exampleco/jobs/15/blank">  </a></li>'
  + '</ul>';

test('parser keeps on-site /jobs/<id> links, drops off-site, non-job, link-less and untitled items', () => {
  const jobs = parseNeogovPage(LIST_HTML, 'Acme', ORIGIN);
  assert.deepEqual(jobs.map((j) => j.url), [
    `${ORIGIN}/careers/exampleco/faculty/jobs/11/math-professor`,
    `${ORIGIN}/careers/exampleco/jobs/12/it-professor`,
    `${ORIGIN}/careers/exampleco/jobs/14/remote`,
  ]);
});

test('parser emits the 12-field web-ui job shape with company and source', () => {
  const [first] = parseNeogovPage(LIST_HTML, 'Acme', ORIGIN);
  assert.deepEqual(first, {
    id: `neogov-${ORIGIN}/careers/exampleco/faculty/jobs/11/math-professor`,
    title: 'Part-time Math & Science Professor – Pool',
    company: 'Acme',
    url: `${ORIGIN}/careers/exampleco/faculty/jobs/11/math-professor`,
    salary: '',
    location: 'Vancouver, WA',
    isRemote: false,
    workplaceType: '',
    relocates: false,
    date: '',
    snippet: '',
    source: 'neogov',
  });
});

test('parser decodes entities in the title and takes the first list-meta <li> as location', () => {
  const jobs = parseNeogovPage(LIST_HTML, 'Acme', ORIGIN);
  assert.equal(jobs[0].title, 'Part-time Math & Science Professor – Pool');
  assert.equal(jobs[0].location, 'Vancouver, WA');
  assert.equal(jobs[1].location, 'Ridgefield, WA');
});

test('parser accepts href-before-class attribute order and flags a remote location', () => {
  const remote = parseNeogovPage(LIST_HTML, 'Acme', ORIGIN)[2];
  assert.equal(remote.title, 'Remote Tutor');
  assert.equal(remote.isRemote, true);
  assert.equal(remote.workplaceType, 'Remote');
});

test('parser drops a protocol-relative href to another host and strips fragments', () => {
  const html = '<ul class="search-results-listing-container">'
    + '<li class="list-item"><a class="item-details-link" href="//evil.example/careers/x/jobs/1/y">X</a></li>'
    + '<li class="list-item"><a class="item-details-link" href="/careers/x/jobs/2/y#apply">Y</a></li></ul>';
  const jobs = parseNeogovPage(html, 'Acme', ORIGIN);
  assert.deepEqual(jobs.map((j) => j.url), [`${ORIGIN}/careers/x/jobs/2/y`]);
});

for (const empty of ['', '  \n', null, undefined]) {
  test(`parser ${JSON.stringify(empty)} → []`, () => {
    assert.deepEqual(parseNeogovPage(empty, 'X', ORIGIN), []);
  });
}

test('parser "No jobs" page and an empty listing container → [] (empty board / past the last page)', () => {
  assert.deepEqual(parseNeogovPage(NOT_FOUND, 'X', ORIGIN), []);
  assert.deepEqual(parseNeogovPage('<ul class="search-results-listing-container"></ul>', 'X', ORIGIN), []);
});

test('parser throws a descriptive error on a page that is not the job list', () => {
  assert.throws(
    () => parseNeogovPage('<html><body>Please sign in</body></html>', 'X', ORIGIN),
    /not a NEOGOV job list/,
  );
});

// ── fetch ─────────────────────────────────────────────────────────────
test('fetch walks pages until one adds nothing and returns every posting', async () => {
  const { impl, calls } = router((url) => {
    const p = pageNo(url);
    return res(p === 1 ? pageOf(0, 10) : p === 2 ? pageOf(10, 10) : p === 3 ? pageOf(20, 3) : NOT_FOUND);
  });
  const jobs = await fetchNeogov(ENDPOINT, { fetchImpl: impl, company, ...noSleep });
  assert.equal(jobs.length, 23);
  assert.equal(calls.length, 4);
  assert.ok(jobs.every((j) => j.company === 'Acme' && j.source === 'neogov'));
});

test("fetch sends redirect:'error', the XHR header and the browser UA on every request, to the pinned www host only", async () => {
  const { impl, calls } = router((url) => res(pageNo(url) === 1 ? pageOf(0, 10) : NOT_FOUND));
  await fetchNeogov(ENDPOINT, { fetchImpl: impl, company, ...noSleep });
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.init.redirect, 'error');
    assert.equal(c.init.headers['X-Requested-With'], 'XMLHttpRequest');
    assert.equal(c.init.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
    assert.equal(new URL(c.url).origin, ORIGIN);
    assert.equal(new URL(c.url).pathname, '/careers/home/index');
    assert.equal(new URL(c.url).searchParams.get('agency'), 'exampleco');
  }
  assert.equal(calls[1].url, ENDPOINT.replace('page=1', 'page=2'));
});

test('fetch paces between pages', async () => {
  const sleeps = [];
  const { impl } = router((url) => res(pageNo(url) <= 2 ? pageOf(pageNo(url) * 10, 10) : NOT_FOUND));
  await fetchNeogov(ENDPOINT, { fetchImpl: impl, company, retryDelayMs: 0, sleep: async (ms) => { sleeps.push(ms); } });
  assert.deepEqual(sleeps, [INTER_PAGE_DELAY_MS, INTER_PAGE_DELAY_MS]);
});

test('fetch rejects an unsafe endpoint before any request', async () => {
  const { impl, calls } = router(() => res(pageOf(0, 10)));
  await assert.rejects(
    fetchNeogov('https://evil.example/careers/home/index?agency=exampleco', { fetchImpl: impl, company, ...noSleep }),
    /neogov: untrusted endpoint/,
  );
  assert.equal(calls.length, 0);
});

test('fetch stops when a page repeats what it already has (no runaway loop)', async () => {
  const { impl, calls } = router(() => res(pageOf(0, 10)));
  const jobs = await fetchNeogov(ENDPOINT, { fetchImpl: impl, company, ...noSleep });
  assert.equal(jobs.length, 10);
  assert.equal(calls.length, 2);
});

const endless = () => router((url) => res(pageOf(pageNo(url) * 10, 10)));

test('fetch stops at its own DEFAULT_MAX_PAGES (30) and warns "raise max_pages"', async () => {
  const { impl, calls } = endless();
  const { result, warnings } = await captureWarn(() => fetchNeogov(ENDPOINT, { fetchImpl: impl, company, ...noSleep }));
  assert.equal(calls.length, 30);
  assert.equal(result.length, 300);
  assert.ok(warnings.some((w) => /raise max_pages/.test(w)), JSON.stringify(warnings));
});

test('fetch honours entry.max_pages and caps it at MAX_PAGES_CAP (200)', async () => {
  let r = endless();
  await captureWarn(() => fetchNeogov(ENDPOINT, { fetchImpl: r.impl, company: { ...company, max_pages: 2 }, ...noSleep }));
  assert.equal(r.calls.length, 2);
  r = endless();
  await captureWarn(() => fetchNeogov(ENDPOINT, { fetchImpl: r.impl, company: { ...company, max_pages: 1_000_000 }, ...noSleep }));
  assert.equal(r.calls.length, 200);
});

test('a bounded probe (maxPages) stops after that many requests and does not blame max_pages', async () => {
  const { impl, calls } = endless();
  const { warnings } = await captureWarn(() => fetchNeogov(ENDPOINT, { fetchImpl: impl, company, maxPages: 1, ...noSleep }));
  assert.equal(calls.length, 1);
  assert.ok(!warnings.some((w) => /raise max_pages/.test(w)));
});

test('a transport rejection propagates unwrapped during a probe', async () => {
  class ProbeSentinel extends Error {}
  const sentinel = new ProbeSentinel('budget');
  await assert.rejects(
    fetchNeogov(ENDPOINT, { fetchImpl: async () => { throw sentinel; }, company, maxPages: 1, ...noSleep }),
    (e) => e === sentinel,
  );
});

test('a page that keeps failing is retried, then fails loud (no silent partial board, no max_pages warning)', async () => {
  const { impl, calls } = router((url) => (pageNo(url) === 1 ? res(pageOf(0, 10)) : res('busy', 503)));
  const { warnings } = await captureWarn(async () => {
    await assert.rejects(fetchNeogov(ENDPOINT, { fetchImpl: impl, company, ...noSleep }), (e) => e.status === 503);
  });
  assert.equal(calls.length, 4); // page 1 + page 2 × (1 attempt + 2 retries)
  assert.ok(!warnings.some((w) => /raise max_pages/.test(w)));
});

test('a transient error is retried, then succeeds', async () => {
  let n = 0;
  const { impl, calls } = router((url) => {
    if (pageNo(url) === 1 && n++ === 0) return res('busy', 429);
    return res(pageNo(url) === 1 ? pageOf(0, 3) : NOT_FOUND);
  });
  const jobs = await fetchNeogov(ENDPOINT, { fetchImpl: impl, company, ...noSleep });
  assert.equal(jobs.length, 3);
  assert.equal(calls.length, 3);
});

test('a permanent 4xx is not retried', async () => {
  const { impl, calls } = router(() => res('gone', 404));
  await assert.rejects(fetchNeogov(ENDPOINT, { fetchImpl: impl, company, ...noSleep }), (e) => e.status === 404);
  assert.equal(calls.length, 1);
});

test('a refused redirect (wrong agency slug) surfaces as an error, not an empty board, and is not retried', async () => {
  const { impl, calls } = router(() => {
    throw new TypeError('fetch failed', { cause: new Error('unexpected redirect') });
  });
  await assert.rejects(fetchNeogov(ENDPOINT, { fetchImpl: impl, company, ...noSleep }), TypeError);
  assert.equal(calls.length, 1);
});

test('a non-list 200 (login page) makes the fetch throw instead of reporting zero jobs', async () => {
  const { impl } = router(() => res('<html><body>Please sign in</body></html>'));
  await assert.rejects(fetchNeogov(ENDPOINT, { fetchImpl: impl, company, ...noSleep }), /not a NEOGOV job list/);
});

test('an empty board (not-found page on page 1) → []', async () => {
  const { impl, calls } = router(() => res(NOT_FOUND));
  assert.deepEqual(await fetchNeogov(ENDPOINT, { fetchImpl: impl, company, ...noSleep }), []);
  assert.equal(calls.length, 1);
});
