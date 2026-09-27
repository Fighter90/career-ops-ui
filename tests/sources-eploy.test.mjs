/**
 * Eploy source + adapter — CI-isolated tests (fake fetchImpl, no network, no
 * parent-project dependency, no port binding, nothing reads CAREER_OPS_ROOT).
 *
 * Parity with parent career-ops `tests/providers/eploy.test.mjs`. The fixtures
 * below are inlined copies of the parent's `eploy-live-jobs-branded.xml`,
 * `eploy-live-jobs-hosted.xml`, `eploy-detail-jsonld.html` and
 * `eploy-detail-legacy.html` (shapes observed live on 2026-09-09).
 *
 * URL assertions use strict equality, never `String.includes` or an unanchored
 * regex over a URL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  resolveEployOrigin,
  buildFeedUrl,
  assertEployUrl,
  isAllowedJobUrl,
  titleFromSlug,
  parseEploySitemap,
  parseEployDetail,
  parseEployConfig,
  fetchEploy,
  DETAIL_PACE_MS,
} from '../server/lib/sources/eploy.mjs';
import { eployAdapter } from '../server/lib/portals/adapters/eploy.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

const BRANDED_XML = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://careers.example.com/vacancies/101/learning-and-development-advisor.html</loc>
    <lastmod>2026-09-09</lastmod>
  </url>
  <url>
    <loc>https://careers.example.com/vacancies/102/hr-and-ai-specialist.html</loc>
    <lastmod>2026-09-08</lastmod>
  </url>
</urlset>`;

const HOSTED_XML = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Some branded tenants publish canonical job links on their Eploy host. -->
  <url>
    <loc>https://exampletenant.eploy.net/vacancies/201/implementation-consultant--hcm.html</loc>
    <lastmod>2026-09-09T10:30:00Z</lastmod>
  </url>
  <url><loc>https://evil.example/vacancies/202/off-host-role.html</loc></url>
  <url><loc>https://exampletenant.eploy.net.attacker.com/vacancies/205/suffix-spoof-role.html</loc></url>
  <url><loc>http://exampletenant.eploy.net/vacancies/203/insecure-role.html</loc></url>
  <url><loc>https://exampletenant.eploy.net/not-vacancies/204/wrong-path.html</loc></url>
</urlset>`;

const DETAIL_JSONLD = `<!doctype html>
<html><head>
  <script type="application/ld+json">[{"@context":"https://schema.org","@type":"JobPosting","datePosted":"2026-09-08","title":"Implementation Consultant - HCM","description":"&lt;p&gt;Deliver HR &amp;amp; payroll implementations.&lt;/p&gt;","jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Watford","addressRegion":"Hertfordshire","addressCountry":"United Kingdom"}}}]</script>
</head><body><div class="vac-details__description">Rendered job body</div></body></html>`;

const DETAIL_LEGACY = `<!doctype html>
<html><head>
  <meta name="description" content="Support asset operations &amp; client service." />
</head><body>
  <div id="div_VacV_LocationID" class="item is-read-only">
    <div class="label"><span>Location:</span></div>
    <div data-id="div_content_VacV_LocationID" class="content"><span id="ctl00_Content_VacV_LocationID">Manchester</span></div>
  </div>
</body></html>`;

const ORIGIN = new URL('https://careers.example.com');
const FEED = 'https://careers.example.com/live-jobs.xml';

function res(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body, headers: { get: () => null } };
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

test('meta is the EN eploy source', () => {
  assert.deepEqual(meta, { value: 'eploy', label: 'Eploy', region: 'en' });
});

test('adapter shape: id, label, fetch', () => {
  assert.equal(eployAdapter.id, 'eploy');
  assert.equal(eployAdapter.label, 'Eploy');
  assert.equal(eployAdapter.fetch, fetchEploy);
});

test('buildEndpoint resolves an explicit branded careers URL to live-jobs.xml', () => {
  const entry = {
    name: 'Example employer', provider: 'eploy',
    careers_url: 'https://careers.example.com/vacancies/vacancy-search-results.aspx?view=list',
  };
  assert.equal(eployAdapter.matches(entry), true);
  assert.equal(eployAdapter.buildEndpoint(entry), FEED);
  assert.equal(typeof eployAdapter.buildEndpoint(entry), 'string');
});

test('adapter is explicit-only for indistinguishable branded domains', () => {
  assert.equal(eployAdapter.matches({ name: 'Lookalike', careers_url: 'https://eploy.example/jobs' }), false);
  assert.equal(eployAdapter.matches({ name: 'Hosted', careers_url: 'https://acme.eploy.net/vacancies/' }), false);
  assert.equal(eployAdapter.matches({ name: 'Other', provider: 'avature', careers_url: 'https://careers.example.com' }), false);
  assert.equal(eployAdapter.matches(null), false);
  assert.equal(eployAdapter.matches(undefined), false);
});

test('trailing-dot host and case are normalized in the endpoint', () => {
  assert.equal(
    eployAdapter.buildEndpoint({ provider: 'eploy', careers_url: 'https://Careers.Example.COM./jobs' }),
    FEED,
  );
  assert.equal(buildFeedUrl(new URL('https://acme.eploy.net')), 'https://acme.eploy.net/live-jobs.xml');
});

for (const careers_url of [
  'http://careers.example.com/jobs',
  'https://127.0.0.1/jobs',
  'https://169.254.169.254/jobs',
  'https://[::1]/jobs',
  'https://localhost/jobs',
  'https://app.localhost/jobs',
  'https://printer.local/jobs',
  'https://jobs.internal/jobs',
  'https://singlelabel/jobs',
  'https://user:pass@careers.example.com/jobs',
  'https://careers.example.com:8443/jobs',
  'ftp://careers.example.com/jobs',
  'not a url',
  '',
]) {
  test(`buildEndpoint rejects unsafe careers_url: ${JSON.stringify(careers_url)}`, () => {
    assert.equal(resolveEployOrigin(careers_url), null);
    assert.equal(eployAdapter.buildEndpoint({ name: 'Bad', provider: 'eploy', careers_url }), null);
    assert.throws(() => assertEployUrl(careers_url), /eploy: .*not a public HTTPS careers URL/);
  });
}

test('buildEndpoint returns null for a missing / non-string careers_url', () => {
  assert.equal(eployAdapter.buildEndpoint({ provider: 'eploy' }), null);
  assert.equal(eployAdapter.buildEndpoint({ provider: 'eploy', careers_url: 42 }), null);
  assert.equal(eployAdapter.buildEndpoint(null), null);
});

test('titleFromSlug capitalizes words, maps acronyms, and splits on double hyphens', () => {
  assert.equal(titleFromSlug('learning-and-development-advisor'), 'Learning And Development Advisor');
  assert.equal(titleFromSlug('hr-and-ai-specialist'), 'HR And AI Specialist');
  assert.equal(titleFromSlug('implementation-consultant--hcm'), 'Implementation Consultant - HCM');
  assert.equal(titleFromSlug('senior_ux__designer'), 'Senior UX Designer');
  assert.equal(titleFromSlug('caf%C3%A9-manager'), 'Café Manager');
  // A malformed percent-escape falls back to the raw slug instead of throwing.
  assert.equal(titleFromSlug('100%-remote'), '100% Remote');
  assert.equal(titleFromSlug('--'), '');
});

test('parser normalizes branded sitemap URLs and does not mislabel lastmod as a date', () => {
  const jobs = parseEploySitemap(BRANDED_XML, ORIGIN, 'Acme');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Learning And Development Advisor');
  assert.equal(jobs[1].title, 'HR And AI Specialist');
  assert.equal(jobs[0].url, 'https://careers.example.com/vacancies/101/learning-and-development-advisor.html');
  assert.equal(jobs[0].id, 'eploy-careers.example.com-101');
  for (const job of jobs) {
    assert.equal(job.company, 'Acme');
    assert.equal(job.location, '');
    assert.equal(job.date, '');
    assert.equal(job.source, 'eploy');
    assert.equal('postedAt' in job, false);
    assert.deepEqual(Object.keys(job).sort(), [
      'company', 'date', 'id', 'isRemote', 'location', 'relocates', 'salary',
      'snippet', 'source', 'title', 'url', 'workplaceType',
    ]);
  }
});

test('parser permits canonical tenant.eploy.net links and drops off-host, suffix-spoofed, insecure and off-pattern locs', () => {
  const jobs = parseEploySitemap(HOSTED_XML, ORIGIN, 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Implementation Consultant - HCM');
  assert.equal(jobs[0].url, 'https://exampletenant.eploy.net/vacancies/201/implementation-consultant--hcm.html');
});

test('isAllowedJobUrl rejects the bare eploy.net apex, query strings, fragments, ports and credentials', () => {
  const ok = (u) => isAllowedJobUrl(new URL(u), ORIGIN);
  assert.equal(ok('https://careers.example.com/vacancies/1/a.html'), true);
  assert.equal(ok('https://careers.example.com/vacancies/1/a.html/'), true);
  assert.equal(ok('https://eploy.net/vacancies/1/a.html'), false);
  assert.equal(ok('https://careers.example.com/vacancies/1/a.html?x=1'), false);
  assert.equal(ok('https://careers.example.com/vacancies/1/a.html#top'), false);
  assert.equal(ok('https://careers.example.com:444/vacancies/1/a.html'), false);
  assert.equal(ok('https://u:p@careers.example.com/vacancies/1/a.html'), false);
  assert.equal(ok('https://careers.example.com/vacancies/abc/a.html'), false);
  assert.equal(ok('https://careers.example.com/vacancies/1/a.aspx'), false);
});

test('parser deduplicates one vacancy ID across branded and tenant hosts (first loc wins)', () => {
  const jobs = parseEploySitemap(`<?xml version="1.0"?>
    <urlset>
      <url><loc>https://careers.example.com/vacancies/301/learning-designer.html</loc></url>
      <url><loc>https://exampletenant.eploy.net/vacancies/301/learning-designer.html/</loc></url>
    </urlset>`, ORIGIN, 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://careers.example.com/vacancies/301/learning-designer.html');
});

test('parser decodes entity-escaped locs and skips url blocks with no / unparseable loc', () => {
  const jobs = parseEploySitemap(`<urlset>
      <url><lastmod>2026-01-01</lastmod></url>
      <url><loc>::not a url::</loc></url>
      <url><loc>https://careers.example.com/vacancies/7/data-&amp;-ml-engineer.html</loc></url>
    </urlset>`, ORIGIN, 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Data & ML Engineer');
});

test('empty body and valid empty urlset return []', () => {
  assert.deepEqual(parseEploySitemap('', ORIGIN, 'Acme'), []);
  assert.deepEqual(parseEploySitemap('   \n', ORIGIN, 'Acme'), []);
  assert.deepEqual(parseEploySitemap(null, ORIGIN, 'Acme'), []);
  assert.deepEqual(parseEploySitemap('<?xml version="1.0"?><urlset></urlset>', ORIGIN, 'Acme'), []);
});

test('a recognizable non-sitemap response throws descriptively', () => {
  assert.throws(
    () => parseEploySitemap('<html><body>Sign in</body></html>', ORIGIN, 'Acme'),
    /expected an XML urlset/i,
  );
});

test('detail parser reads the schema.org JobPosting shape', () => {
  const d = parseEployDetail(DETAIL_JSONLD);
  assert.equal(d.title, 'Implementation Consultant - HCM');
  assert.equal(d.location, 'Watford, Hertfordshire, United Kingdom');
  assert.equal(d.description, 'Deliver HR & payroll implementations.');
  assert.equal(d.postedAt, Date.parse('2026-09-08'));
});

test('detail parser handles @graph, typed arrays, object countries and multiple locations', () => {
  const html = `<script type='application/ld+json'>{"@graph":[{"@type":"Organization"},{"@type":["JobPosting"],"title":"QA Lead","jobLocation":[{"address":{"addressLocality":"Leeds","addressCountry":{"name":"UK"}}},{"address":{"addressLocality":"York","addressRegion":"York"}}]}]}</script>`;
  const d = parseEployDetail(html);
  assert.equal(d.title, 'QA Lead');
  assert.equal(d.location, 'Leeds, UK; York');
  assert.equal(d.description, '');
  assert.equal('postedAt' in d, false);
});

test('detail parser reads the legacy Eploy Web Forms field shape', () => {
  const d = parseEployDetail(DETAIL_LEGACY);
  assert.equal(d.location, 'Manchester');
  assert.equal(d.description, 'Support asset operations & client service.');
  assert.equal('postedAt' in d, false);
});

test('malformed detail payload degrades to the two empty legacy fields (parent quirk)', () => {
  const d = parseEployDetail('<script type="application/ld+json">oops</script>');
  assert.deepEqual(d, { location: '', description: '' });
  assert.deepEqual(parseEployDetail(''), {});
  assert.deepEqual(parseEployDetail(undefined), {});
});

test('parseEployConfig: opt-in details, detailLimit clamped to 1..100 with default 25', () => {
  assert.deepEqual(parseEployConfig({}), { fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseEployConfig({ eploy: { fetchDetails: 'true' } }), { fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseEployConfig({ eploy: { fetchDetails: true, detailLimit: 0 } }), { fetchDetails: true, detailLimit: 1 });
  assert.deepEqual(parseEployConfig({ eploy: { detailLimit: 1000 } }), { fetchDetails: false, detailLimit: 100 });
  assert.deepEqual(parseEployConfig({ eploy: { detailLimit: 'abc' } }), { fetchDetails: false, detailLimit: 25 });
  assert.deepEqual(parseEployConfig({ eploy: { detailLimit: 7.9 } }), { fetchDetails: false, detailLimit: 7 });
  assert.deepEqual(parseEployConfig(null), { fetchDetails: false, detailLimit: 25 });
});

test('default fetch makes one redirect-blocked sitemap request with the browser UA', async () => {
  const { impl, calls } = router(() => res(BRANDED_XML));
  const company = { name: 'Acme', provider: 'eploy', careers_url: 'https://careers.example.com/jobs' };
  const jobs = await fetchEploy(eployAdapter.buildEndpoint(company), { fetchImpl: impl, company, ...noSleep });
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, FEED);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
  assert.equal(jobs[0].company, 'Acme');
});

test('fetch always requests the fixed feed path, whatever path the endpoint carries', async () => {
  const { impl, calls } = router(() => res(BRANDED_XML));
  await fetchEploy('https://careers.example.com/some/other/path?x=1', { fetchImpl: impl, company: { name: 'Acme' }, ...noSleep });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, FEED);
});

test('opt-in details are bounded, redirect-safe, retry transient errors, and fail open per job', async () => {
  const sleeps = [];
  const detailCalls = [];
  const { impl } = router((url, init) => {
    if (url === FEED) return res(BRANDED_XML);
    detailCalls.push({ url, init });
    if (new URL(url).pathname.startsWith('/vacancies/102/')) return res('down', 503);
    return res(DETAIL_JSONLD);
  });
  const company = {
    name: 'Acme', provider: 'eploy', careers_url: 'https://careers.example.com/jobs',
    eploy: { fetchDetails: true, detailLimit: 2 },
  };
  const jobs = await fetchEploy(FEED, {
    fetchImpl: impl, company, retryDelayMs: 0, sleep: async (ms) => { sleeps.push(ms); },
  });
  // 1 call for job 101 + 3 attempts (1 + 2 retries) for the 503 on job 102.
  assert.equal(detailCalls.length, 4);
  assert.ok(detailCalls.every((c) => c.init.redirect === 'error'));
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Implementation Consultant - HCM');
  assert.equal(jobs[0].location, 'Watford, Hertfordshire, United Kingdom');
  assert.equal(jobs[0].description, 'Deliver HR & payroll implementations.');
  assert.equal(jobs[0].snippet, 'Deliver HR & payroll implementations.');
  assert.equal(jobs[0].date, '2026-09-08');
  // The failed detail keeps the sitemap row untouched.
  assert.equal(jobs[1].title, 'HR And AI Specialist');
  assert.equal(jobs[1].location, '');
  assert.equal('description' in jobs[1], false);
});

test('a permanent 4xx on a detail page is not retried', async () => {
  const detailCalls = [];
  const { impl } = router((url) => {
    if (url === FEED) return res(BRANDED_XML);
    detailCalls.push(url);
    return res('gone', 404);
  });
  const jobs = await fetchEploy(FEED, {
    fetchImpl: impl, company: { name: 'Acme', eploy: { fetchDetails: true } }, ...noSleep,
  });
  assert.equal(detailCalls.length, 2);
  assert.equal(jobs.length, 2);
});

test('detail batches pace between request groups', async () => {
  const fourRows = BRANDED_XML.replace(
    '</urlset>',
    '<url><loc>https://careers.example.com/vacancies/103/qa-lead.html</loc></url><url><loc>https://careers.example.com/vacancies/104/ux-lead.html</loc></url></urlset>',
  );
  let detailCalls = 0;
  const paced = [];
  const { impl } = router((url) => {
    if (url === FEED) return res(fourRows);
    detailCalls += 1;
    return res('');
  });
  const jobs = await fetchEploy(FEED, {
    fetchImpl: impl,
    company: { name: 'Acme', eploy: { fetchDetails: true, detailLimit: 4 } },
    retryDelayMs: 0,
    sleep: async (ms) => { paced.push(ms); },
  });
  assert.equal(detailCalls, 4);
  assert.deepEqual(paced, [DETAIL_PACE_MS]); // 4 jobs, batch of 3, one pause
  assert.equal(DETAIL_PACE_MS, 250);
  assert.equal(jobs[2].title, 'QA Lead');
  assert.equal(jobs[3].title, 'UX Lead');
});

test('a bounded probe (maxPages) stays on the single inventory request and skips details', async () => {
  const { impl, calls } = router(() => res(BRANDED_XML));
  const jobs = await fetchEploy(FEED, {
    fetchImpl: impl, maxPages: 1, company: { name: 'Acme', eploy: { fetchDetails: true } }, ...noSleep,
  });
  assert.equal(calls.length, 1);
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => !j.description));
});

test('sitemap transient error is retried, then succeeds', async () => {
  let n = 0;
  const { impl, calls } = router(() => (++n === 1 ? res('busy', 503) : res(BRANDED_XML)));
  const jobs = await fetchEploy(FEED, { fetchImpl: impl, company: { name: 'Acme' }, ...noSleep });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 2);
});

test('sitemap permanent failure propagates with its status (dead-board contract)', async () => {
  const { impl, calls } = router(() => res('nope', 404));
  await assert.rejects(
    fetchEploy(FEED, { fetchImpl: impl, company: { name: 'Acme' }, ...noSleep }),
    (err) => err.status === 404,
  );
  assert.equal(calls.length, 1);
});

test('a refused redirect on the sitemap is not retried', async () => {
  const { impl, calls } = router(() => {
    throw new TypeError('fetch failed', { cause: new Error('unexpected redirect') });
  });
  await assert.rejects(fetchEploy(FEED, { fetchImpl: impl, company: { name: 'Acme' }, ...noSleep }), TypeError);
  assert.equal(calls.length, 1);
});

test('a non-sitemap 200 (login page) makes the fetch throw instead of reporting zero jobs', async () => {
  const { impl } = router(() => res('<html><body>Sign in</body></html>'));
  await assert.rejects(
    fetchEploy(FEED, { fetchImpl: impl, company: { name: 'Acme' }, ...noSleep }),
    /expected an XML urlset/,
  );
});

test('fetch rejects unsafe endpoints before any I/O', async () => {
  let io = 0;
  const impl = async () => { io += 1; return res(''); };
  for (const url of ['http://careers.example.com', 'https://169.254.169.254/jobs', 'https://jobs.internal', 'https://localhost']) {
    await assert.rejects(fetchEploy(url, { fetchImpl: impl, company: { name: 'Bad' }, ...noSleep }), /eploy:/);
  }
  assert.equal(io, 0);
});
