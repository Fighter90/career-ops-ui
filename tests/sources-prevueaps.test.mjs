/**
 * PrevueAPS source + adapter. Two-step per-tenant fetch (/jobs/ page →
 * domainId → /core/jobs/{id} JSON), host-pinned to <tenant>.prevueaps.ca.
 * CI-isolated: fetchImpl is faked, no network, no parent dependency.
 * Ported from parent career-ops tests/providers/prevueaps.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta, PREVUEAPS_HOST_RE, MAX_JOBS, assertPrevueapsUrl, resolveOrigin,
  extractDomainId, buildApiUrl, parsePrevueapsResponse, fetchPrevueaps,
} from '../server/lib/sources/prevueaps.mjs';
import { prevueapsAdapter } from '../server/lib/portals/adapters/prevueaps.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

const TENANT = 'https://examplecoca.prevueaps.ca';
const ENDPOINT = `${TENANT}/jobs/`;
const EXPECTED_API = `${TENANT}/core/jobs/889?getParams=%7B%22showDate%22%3Atrue%2C%22showLocation%22%3Atrue%2C%22showEmploymentType%22%3Atrue%2C%22showCategory%22%3Atrue%2C%22showClassification%22%3Atrue%2C%22showWorkplaceType%22%3Atrue%2C%22customCategoryTitle%22%3A%22%22%7D`;

// Real observed shape (tbca.prevueaps.ca), trimmed of irrelevant fields only.
const REAL_SHAPE = {
  success: true,
  data: {
    jobs: [
      {
        id: 31380,
        title: 'Accounting & Finance Assistant Manager',
        city: 'Woodstock',
        subdomain: 'tbca',
        abbreviation: 'ON',
        classification: 'Finance',
        siteId: 889,
        startDateRef: 'Aug 17, 2026',
        stateName: 'Ontario',
        workplaceType: 'Onsite',
        employmentType: 'Full Time',
        payType: 'Salary',
        payTypeFrame: 'per year',
        minSalary: '91,000',
        maxSalary: '136,500',
        jobLocation: 'Woodstock, ON, Canada',
        jobUrl: 'https://tbca.prevueaps.ca/jobs/31380',
      },
    ],
    jobCount: 1,
    displayText: '<p>Below is a list...</p>',
  },
};

/** Minimal Response stub. */
function res(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  };
}

/** Fake fetch routing the /jobs/ page vs the /core/jobs API; records calls. */
function fakeFetch({ html = '<script>fetch("/core/jobs/889?getParams=%7B%7D")</script>', json = REAL_SHAPE, htmlStatus = 200, jsonStatus = 200 } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/core/jobs/')) return res(json, { status: jsonStatus });
    return res(html, { status: htmlStatus });
  };
  return { impl, calls };
}

// ── meta / adapter surface ───────────────────────────────────────────────

test('meta + adapter surface', () => {
  assert.deepEqual(meta, { value: 'prevueaps', label: 'PrevueAPS', region: 'en' });
  assert.equal(prevueapsAdapter.id, 'prevueaps');
  assert.equal(prevueapsAdapter.label, 'PrevueAPS');
  assert.equal(prevueapsAdapter.fetch, fetchPrevueaps);
});

test('adapter.matches: tenant host or explicit provider; rejects spoofs', () => {
  assert.ok(prevueapsAdapter.matches({ careers_url: ENDPOINT }));
  assert.ok(prevueapsAdapter.matches({ api: 'https://tbca.prevueaps.ca/jobs/31380' }));
  assert.ok(prevueapsAdapter.matches({ provider: 'prevueaps' }));
  assert.ok(!prevueapsAdapter.matches({ careers_url: 'https://example.com/careers' }));
  assert.ok(!prevueapsAdapter.matches({ careers_url: 'https://evil.example/examplecoca.prevueaps.ca/foo' }));
  assert.ok(!prevueapsAdapter.matches({ careers_url: 'http://examplecoca.prevueaps.ca/jobs/' }));
  assert.ok(!prevueapsAdapter.matches({}));
});

test('adapter.buildEndpoint: <tenant>.prevueaps.ca → /jobs/ (parent detect())', () => {
  assert.equal(prevueapsAdapter.buildEndpoint({ name: 'ExampleCo', careers_url: ENDPOINT }), ENDPOINT);
  // Deep link collapses to the tenant origin.
  assert.equal(prevueapsAdapter.buildEndpoint({ careers_url: 'https://tbca.prevueaps.ca/jobs/31380?x=1' }), 'https://tbca.prevueaps.ca/jobs/');
  // api: wins over careers_url.
  assert.equal(
    prevueapsAdapter.buildEndpoint({ api: 'https://a.prevueaps.ca/', careers_url: 'https://b.prevueaps.ca/' }),
    'https://a.prevueaps.ca/jobs/',
  );
  // Non-prevueaps / path-spoof / non-https / malformed / non-string → null.
  assert.equal(prevueapsAdapter.buildEndpoint({ careers_url: 'https://example.com/careers' }), null);
  assert.equal(prevueapsAdapter.buildEndpoint({ careers_url: 'https://evil.example/examplecoca.prevueaps.ca/foo' }), null);
  assert.equal(prevueapsAdapter.buildEndpoint({ careers_url: 'http://examplecoca.prevueaps.ca/jobs/' }), null);
  assert.equal(prevueapsAdapter.buildEndpoint({ careers_url: 'not a url' }), null);
  assert.equal(prevueapsAdapter.buildEndpoint({ careers_url: null }), null);
  assert.equal(prevueapsAdapter.buildEndpoint({ careers_url: 7 }), null);
  // Explicit provider does NOT unpin the host.
  assert.equal(prevueapsAdapter.buildEndpoint({ provider: 'prevueaps', careers_url: 'https://evil.com/' }), null);
});

test('resolveOrigin: null/undefined entry → null (no throw)', () => {
  assert.equal(resolveOrigin(null), null);
  assert.equal(resolveOrigin(undefined), null);
  assert.equal(resolveOrigin('https://x.prevueaps.ca'), null);
  assert.equal(resolveOrigin({ careers_url: '  https://x.prevueaps.ca/jobs/  ' }), 'https://x.prevueaps.ca');
});

test('PREVUEAPS_HOST_RE: anchored — no prefix/suffix spoofs', () => {
  assert.ok(PREVUEAPS_HOST_RE.test('tbca.prevueaps.ca'));
  assert.ok(PREVUEAPS_HOST_RE.test('my-tenant.prevueaps.ca'));
  assert.ok(!PREVUEAPS_HOST_RE.test('prevueaps.ca'));
  assert.ok(!PREVUEAPS_HOST_RE.test('a.b.prevueaps.ca'));
  assert.ok(!PREVUEAPS_HOST_RE.test('tbca.prevueaps.ca.evil.com'));
  assert.ok(!PREVUEAPS_HOST_RE.test('tbca.evilprevueaps.ca'));
  assert.ok(!PREVUEAPS_HOST_RE.test('-bad.prevueaps.ca'));
});

test('assertPrevueapsUrl: https + tenant host only', () => {
  assert.equal(assertPrevueapsUrl(ENDPOINT), ENDPOINT);
  assert.throws(() => assertPrevueapsUrl('http://tbca.prevueaps.ca/jobs/'), /HTTPS/);
  assert.throws(() => assertPrevueapsUrl('https://evil.com/jobs/'), /untrusted hostname/);
  assert.throws(() => assertPrevueapsUrl('nonsense'), /invalid URL/);
});

// ── extractDomainId ──────────────────────────────────────────────────────

test('extractDomainId: each signal in priority order', () => {
  assert.equal(extractDomainId('<script>fetch("/core/jobs/889?getParams=%7B%7D")</script>'), '889');
  assert.equal(extractDomainId('<div data-domain-id="813" id="jobs-widget"></div>'), '813');
  assert.equal(extractDomainId('<script>var config = { domainId: 1024, showDate: true };</script>'), '1024');
  assert.equal(extractDomainId('<script>window.siteId = "42";</script>'), '42');
  assert.equal(extractDomainId('<script>{"domainId":"77"}</script>'), '77');
});

test('extractDomainId: /core/jobs path beats weaker signals', () => {
  const html = '<div data-domain-id="1"></div><script>var domainId = 2; fetch("/core/jobs/3")</script>';
  assert.equal(extractDomainId(html), '3');
  assert.equal(extractDomainId('<script>var siteId = 5; var domainId = 6;</script>'), '6');
});

test('extractDomainId: no match / bad input → null (no throw)', () => {
  assert.equal(extractDomainId('<html><body>No jobs widget here</body></html>'), null);
  assert.equal(extractDomainId(null), null);
  assert.equal(extractDomainId(undefined), null);
  assert.equal(extractDomainId(''), null);
  assert.equal(extractDomainId(42), null);
});

test('buildApiUrl: fixed getParams constant, URL-encoded', () => {
  assert.equal(buildApiUrl(TENANT, '889'), EXPECTED_API);
});

// ── parsePrevueapsResponse ───────────────────────────────────────────────

test('parse: real observed shape → full web-ui job object', () => {
  const jobs = parsePrevueapsResponse(REAL_SHAPE, 'ExampleCo');
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.equal(j.id, 'prevueaps-https://tbca.prevueaps.ca/jobs/31380');
  assert.equal(j.title, 'Accounting & Finance Assistant Manager');
  assert.equal(j.company, 'ExampleCo');
  assert.equal(j.url, 'https://tbca.prevueaps.ca/jobs/31380');
  assert.equal(j.location, 'Woodstock, ON, Canada'); // explicit jobLocation
  assert.equal(j.salary, '91,000 - 136,500 per year');
  assert.equal(j.isRemote, false);
  assert.equal(j.workplaceType, 'Onsite');
  assert.equal(j.relocates, false);
  assert.equal(j.date, '');
  assert.equal(j.source, 'prevueaps');
  // employmentType + classification + salary folded in (parent's description).
  assert.equal(j.snippet, 'Full Time · Finance · 91,000 - 136,500 per year');
  assert.equal(Object.keys(j).length, 12);
});

test('parse: zero-jobs shape → [] cleanly', () => {
  assert.deepEqual(
    parsePrevueapsResponse({ success: true, message: 'No job found', data: { jobs: [], jobCount: 0 } }, 'X'),
    [],
  );
});

test('parse: malformed envelope THROWS (never silently [])', () => {
  for (const bad of [{}, { data: {} }, { data: { jobs: null } }, { data: { jobs: 'x' } }, null, undefined]) {
    assert.throws(() => parsePrevueapsResponse(bad, 'X'), /unexpected response shape for X/);
  }
});

test('parse: drops rows missing title/url, non-https/malformed url, blank/non-string title', () => {
  const rows = parsePrevueapsResponse({
    data: {
      jobs: [
        null,
        { title: 'No URL' },
        { title: 'Insecure URL', jobUrl: 'http://tbca.prevueaps.ca/jobs/1' },
        { title: 'Malformed URL', jobUrl: 'not a url' },
        { jobUrl: 'https://tbca.prevueaps.ca/jobs/2' },
        { title: '', jobUrl: 'https://tbca.prevueaps.ca/jobs/4' },
        { title: '   ', jobUrl: 'https://tbca.prevueaps.ca/jobs/5' },
        { title: 42, jobUrl: 'https://tbca.prevueaps.ca/jobs/6' },
        { title: 'Good row', jobUrl: 'https://tbca.prevueaps.ca/jobs/3', city: 'Toronto', abbreviation: 'ON' },
      ],
    },
  }, 'X');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Good row');
  // Location assembled from city/abbreviation when jobLocation is absent.
  assert.equal(rows[0].location, 'Toronto, ON');
  assert.equal(rows[0].salary, '');
  assert.equal(rows[0].snippet, '');
});

test('parse: trims title; stateName fallback; min-only salary; remote workplace', () => {
  const [a, b] = parsePrevueapsResponse({
    data: {
      jobs: [
        { title: '  Padded Title  ', jobUrl: 'https://tbca.prevueaps.ca/jobs/7', city: 'Halifax', stateName: 'Nova Scotia', minSalary: '25.00', payTypeFrame: 'per hour' },
        { title: 'Remote Dev', jobUrl: 'https://tbca.prevueaps.ca/jobs/8', workplaceType: 'Remote', jobLocation: '  ' },
      ],
    },
  }, 'X');
  assert.equal(a.title, 'Padded Title');
  assert.equal(a.location, 'Halifax, Nova Scotia');
  assert.equal(a.salary, '25.00 per hour');
  assert.equal(b.isRemote, true);
  assert.equal(b.workplaceType, 'Remote');
  assert.equal(b.location, ''); // whitespace jobLocation, no city → empty
});

test('parse: duplicate jobUrl collapses; MAX_JOBS caps output', () => {
  const dup = parsePrevueapsResponse({
    data: { jobs: [
      { title: 'A', jobUrl: 'https://tbca.prevueaps.ca/jobs/1' },
      { title: 'A again', jobUrl: 'https://tbca.prevueaps.ca/jobs/1' },
    ] },
  }, 'X');
  assert.equal(dup.length, 1);

  const many = Array.from({ length: MAX_JOBS + 5 }, (_, i) => ({ title: `T${i}`, jobUrl: `https://tbca.prevueaps.ca/jobs/${i}` }));
  assert.equal(parsePrevueapsResponse({ data: { jobs: many } }, 'X').length, MAX_JOBS);
});

// ── fetchPrevueaps ───────────────────────────────────────────────────────

test('fetch: /jobs/ page → domainId → /core/jobs/{id}, redirect:error + browser UA', async () => {
  const { impl, calls } = fakeFetch({
    json: { data: { jobs: [{ title: 'Good Job', jobUrl: 'https://examplecoca.prevueaps.ca/jobs/1' }] } },
  });
  const jobs = await fetchPrevueaps(ENDPOINT, { fetchImpl: impl, company: { name: 'ExampleCo' } });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, ENDPOINT);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.headers['user-agent'], BROWSER_LIKE_USER_AGENT);
  assert.equal(calls[1].url, EXPECTED_API);
  assert.equal(calls[1].init.redirect, 'error');
  assert.equal(calls[1].init.headers['user-agent'], BROWSER_LIKE_USER_AGENT);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'ExampleCo');
  assert.equal(jobs[0].title, 'Good Job');
});

test('fetch: untrusted / non-https endpoint throws BEFORE any request', async () => {
  const { impl, calls } = fakeFetch();
  await assert.rejects(fetchPrevueaps('https://evil.example.com/careers', { fetchImpl: impl }), /untrusted hostname/);
  await assert.rejects(fetchPrevueaps('http://examplecoca.prevueaps.ca/jobs/', { fetchImpl: impl }), /HTTPS/);
  assert.equal(calls.length, 0);
});

test('fetch: unresolvable domainId throws descriptively; API never called', async () => {
  const { impl, calls } = fakeFetch({ html: '<html><body>nothing recognizable here</body></html>' });
  await assert.rejects(
    fetchPrevueaps(ENDPOINT, { fetchImpl: impl, company: { name: 'NoDomainId' } }),
    /could not resolve domainId for NoDomainId/,
  );
  assert.equal(calls.length, 1);
});

test('fetch: dead board — /jobs/ page or API non-2xx propagates with .status', async () => {
  const page404 = fakeFetch({ htmlStatus: 404 });
  await assert.rejects(fetchPrevueaps(ENDPOINT, { fetchImpl: page404.impl }), (e) => e.status === 404);
  assert.equal(page404.calls.length, 1);

  const api503 = fakeFetch({ jsonStatus: 503 });
  await assert.rejects(fetchPrevueaps(ENDPOINT, { fetchImpl: api503.impl }), (e) => e.status === 503);
});

test('fetch: malformed API envelope surfaces (not an empty result)', async () => {
  const { impl } = fakeFetch({ json: { success: false } });
  await assert.rejects(
    fetchPrevueaps(ENDPOINT, { fetchImpl: impl, company: { name: 'Bad' } }),
    /unexpected response shape for Bad/,
  );
});

test('fetch: deep-link endpoint still requests the tenant /jobs/ page', async () => {
  const { impl, calls } = fakeFetch();
  await fetchPrevueaps('https://examplecoca.prevueaps.ca/jobs/31380', { fetchImpl: impl, company: { name: 'X' } });
  assert.equal(calls[0].url, ENDPOINT);
});
