/**
 * Jobvite source — CI-isolated tests.
 * Uses a fake fetchImpl (no network, no parent-project dependency).
 * Parent career-ops `tests/providers/jobvite.test.mjs` parity.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchJobvite,
  parseJobvite,
  resolveCompanyId,
  buildApiUrl,
  assertJobviteUrl,
  JOBVITE_HOST,
  MAX_JOBS,
  meta,
} from '../server/lib/sources/jobvite.mjs';
import { jobviteAdapter } from '../server/lib/portals/adapters/jobvite.mjs';

const CAREERS = 'https://jobs.jobvite.com/stripe';
const API = 'https://jobs.jobvite.com/api/company/stripe/jobs';

// Validate derived URLs by their parsed hostname, never by substring-matching
// the whole URL string (CodeQL js/incomplete-url-substring-sanitization).
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return null; } };

// ---------------------------------------------------------------------------
// Fake response helpers — parent test fixture parity: 6 rows, 3 dropped
// (no-title, non-https applyURL, missing applyURL).
// ---------------------------------------------------------------------------

const SAMPLE_RESPONSE = {
  jobs: [
    {
      id: 'jv-1',
      title: 'Senior Software Engineer',
      location: 'San Francisco, CA',
      country: 'US',
      date: 'Mon, 02 Jun 2025 10:00:00 +0000',
      applyURL: 'https://jobs.jobvite.com/stripe/job/senior-swe',
      category: 'Engineering',
      jobType: 'Full-Time',
    },
    {
      id: 'jv-2',
      title: 'Product Manager',
      location: '',
      country: 'UK',
      date: 'Mon, 02 Jun 2025 11:00:00 +0000',
      applyURL: 'https://jobs.jobvite.com/stripe/job/pm',
    },
    { // no title — must be dropped
      id: 'jv-3',
      title: '',
      location: 'Remote',
      applyURL: 'https://jobs.jobvite.com/stripe/job/no-title',
    },
    { // non-https applyURL — must be dropped
      id: 'jv-4',
      title: 'Bad URL Role',
      location: 'Remote',
      applyURL: 'http://jobs.jobvite.com/stripe/job/bad-url',
    },
    { // missing applyURL — must be dropped
      id: 'jv-5',
      title: 'No URL Role',
      location: 'Remote',
    },
    { // branded domain applyURL — must be accepted (display-only, never fetched)
      id: 'jv-6',
      title: 'Branded Domain Role',
      location: 'New York, NY',
      country: 'US',
      date: 'Mon, 02 Jun 2025 12:00:00 +0000',
      applyURL: 'https://careers.stripe.com/jobs/branded-role',
    },
  ],
};

function fakeFetch(body) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, json: async () => body };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// meta — source-registry contract
// ---------------------------------------------------------------------------

test('meta: jobvite / Jobvite / en', () => {
  assert.deepEqual(meta, { value: 'jobvite', label: 'Jobvite', region: 'en' });
});

// ---------------------------------------------------------------------------
// assertJobviteUrl — SSRF guard
// ---------------------------------------------------------------------------

test('assertJobviteUrl: accepts the pinned host, rejects lookalikes, HTTP, junk', () => {
  assert.equal(assertJobviteUrl(API), API);
  // Host-suffix spoof: trusted fragment inside a longer evil host.
  assert.throws(() => assertJobviteUrl('https://jobs.jobvite.com.evil.example/stripe'), /untrusted hostname/);
  // Path spoof: jobvite host in the path, not the host.
  assert.throws(() => assertJobviteUrl('https://evil.example/jobs.jobvite.com/stripe'), /untrusted hostname/);
  assert.throws(() => assertJobviteUrl('http://jobs.jobvite.com/stripe'), /HTTPS/);
  assert.throws(() => assertJobviteUrl('not a url'), /invalid URL/);
  assert.equal(JOBVITE_HOST, 'jobs.jobvite.com');
});

// ---------------------------------------------------------------------------
// resolveCompanyId / buildApiUrl
// ---------------------------------------------------------------------------

test('resolveCompanyId: extracts slug from bare and /jobs careers_url forms', () => {
  assert.equal(resolveCompanyId({ careers_url: CAREERS }), 'stripe');
  assert.equal(resolveCompanyId({ careers_url: `${CAREERS}/jobs` }), 'stripe');
});

test('resolveCompanyId: prefers api: over careers_url', () => {
  assert.equal(
    resolveCompanyId({
      api: 'https://jobs.jobvite.com/api/company/acme-corp/jobs',
      careers_url: 'https://jobs.jobvite.com/other',
    }),
    'acme-corp',
  );
});

test('resolveCompanyId: null for empty, wrong host, http, non-string, bare /api', () => {
  assert.equal(resolveCompanyId({}), null);
  assert.equal(resolveCompanyId(null), null);
  assert.equal(resolveCompanyId({ careers_url: 'https://evil.example.com/stripe' }), null); // SSRF guard
  assert.equal(resolveCompanyId({ careers_url: 'http://jobs.jobvite.com/stripe' }), null);
  assert.equal(resolveCompanyId({ careers_url: null }), null);
  assert.equal(resolveCompanyId({ careers_url: 42 }), null);
  assert.equal(resolveCompanyId({ careers_url: 'https://jobs.jobvite.com/api' }), null);
});

test('buildApiUrl: canonical host-pinned API URL, slug URI-encoded', () => {
  assert.equal(buildApiUrl('stripe'), API);
  const odd = buildApiUrl('a b/c');
  assert.equal(hostOf(odd), 'jobs.jobvite.com');
  assert.ok(odd.includes('/api/company/a%20b%2Fc/jobs'));
});

// ---------------------------------------------------------------------------
// parseJobvite
// ---------------------------------------------------------------------------

test('parseJobvite: maps rows to the web-ui job shape, drops invalid rows (3 of 6)', () => {
  const jobs = parseJobvite(SAMPLE_RESPONSE, 'Stripe');
  assert.equal(jobs.length, 3); // dropped: no-title, non-https, missing URL

  const [a, b, c] = jobs;
  assert.equal(a.id, 'jobvite-jv-1');
  assert.equal(a.title, 'Senior Software Engineer');
  assert.equal(a.company, 'Stripe');
  assert.equal(a.url, 'https://jobs.jobvite.com/stripe/job/senior-swe');
  assert.equal(a.location, 'San Francisco, CA');
  assert.equal(a.date, '2025-06-02T10:00:00.000Z'); // RFC-2822 date parsed to ISO
  assert.equal(a.snippet, 'Engineering · Full-Time');
  assert.equal(a.salary, '');
  assert.equal(a.isRemote, false);
  assert.equal(a.workplaceType, '');
  assert.equal(a.relocates, false);
  assert.equal(a.source, 'jobvite');

  // Location fallback to country when location is an empty string.
  assert.equal(b.location, 'UK');
  assert.equal(b.snippet, '');

  // Branded-domain https applyURL accepted (display-only, never fetched).
  assert.equal(c.url, 'https://careers.stripe.com/jobs/branded-role');
});

test('parseJobvite: remote detection from location/title sets isRemote + workplaceType', () => {
  const jobs = parseJobvite({
    jobs: [
      { id: 1, title: 'Remote Data Engineer', location: '', country: 'US', applyURL: 'https://jobs.jobvite.com/x/job/1' },
      { id: 2, title: 'Data Engineer', location: 'Remote - US', applyURL: 'https://jobs.jobvite.com/x/job/2' },
    ],
  }, 'X');
  assert.equal(jobs.length, 2);
  for (const j of jobs) {
    assert.equal(j.isRemote, true);
    assert.equal(j.workplaceType, 'Remote');
  }
});

test('parseJobvite: unparseable/missing dates → ""; missing id falls back to url', () => {
  const jobs = parseJobvite({
    jobs: [
      { title: 'A', date: 'not-a-date', applyURL: 'https://jobs.jobvite.com/x/job/a' },
      { title: 'B', applyURL: 'https://jobs.jobvite.com/x/job/b' },
    ],
  }, 'X');
  assert.equal(jobs[0].date, '');
  assert.equal(jobs[1].date, '');
  assert.equal(jobs[0].id, 'jobvite-https://jobs.jobvite.com/x/job/a');
});

test('parseJobvite: [] for null / non-object / non-array jobs bodies (fail-soft)', () => {
  for (const body of [null, undefined, 'string', 42, {}, { jobs: 'not-an-array' }, { jobs: null }, { jobs: [null, 'x', 7] }]) {
    assert.equal(parseJobvite(body, 'X').length, 0);
  }
});

test('parseJobvite: output capped at MAX_JOBS', () => {
  const rows = Array.from({ length: MAX_JOBS + 25 }, (_, i) => ({
    id: i, title: `Role ${i}`, applyURL: `https://jobs.jobvite.com/x/job/${i}`,
  }));
  assert.equal(parseJobvite({ jobs: rows }, 'X').length, MAX_JOBS);
});

// ---------------------------------------------------------------------------
// fetchJobvite — canonical URL, headers, SSRF, error propagation
// ---------------------------------------------------------------------------

test('fetchJobvite: rebuilds the canonical API URL from the slug; redirect:error + UA/Accept', async () => {
  const fetchImpl = fakeFetch(SAMPLE_RESPONSE);
  const jobs = await fetchJobvite(CAREERS, { fetchImpl, company: { name: 'Stripe' } });
  assert.equal(jobs.length, 3);
  assert.equal(jobs[0].company, 'Stripe');
  assert.equal(fetchImpl.calls.length, 1);
  const { url, opts } = fetchImpl.calls[0];
  assert.equal(url, API); // canonical form, never the user-supplied path
  assert.equal(hostOf(url), 'jobs.jobvite.com');
  assert.equal(opts.redirect, 'error');
  assert.match(opts.headers['User-Agent'], /career-ops-web-ui/);
  assert.equal(opts.headers.Accept, 'application/json');
});

test('fetchJobvite: accepts the api-form endpoint too, same canonical request', async () => {
  const fetchImpl = fakeFetch({ jobs: [] });
  const jobs = await fetchJobvite(API, { fetchImpl });
  assert.deepEqual(jobs, []);
  assert.equal(fetchImpl.calls[0].url, API);
});

test('fetchJobvite: rejects a non-Jobvite endpoint before any network call', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  await assert.rejects(() => fetchJobvite('https://evil.example/stripe', { fetchImpl }), /cannot derive company ID/);
  await assert.rejects(() => fetchJobvite('http://jobs.jobvite.com/stripe', { fetchImpl }), /cannot derive company ID/);
  assert.equal(called, false);
});

test('fetchJobvite: HTTP error propagates with .status (dead board reads as failure)', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchJobvite(CAREERS, { fetchImpl }), (err) => {
    assert.match(err.message, /HTTP 503/);
    assert.equal(err.status, 503);
    return true;
  });
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('jobviteAdapter: matches provider or jobvite host, endpoint is the canonical API URL', () => {
  assert.equal(jobviteAdapter.id, 'jobvite');
  assert.equal(jobviteAdapter.label, 'Jobvite');
  assert.ok(jobviteAdapter.matches({ provider: 'jobvite' }));
  assert.ok(jobviteAdapter.matches({ careers_url: CAREERS }));
  assert.ok(jobviteAdapter.matches({ api: API }));
  assert.ok(!jobviteAdapter.matches({ careers_url: 'https://jobs.lever.co/stripe' }));
  assert.ok(!jobviteAdapter.matches({ careers_url: 'https://jobs.jobvite.com.evil.example/stripe' }));
  assert.ok(!jobviteAdapter.matches({ careers_url: 'http://jobs.jobvite.com/stripe' }));
  assert.ok(!jobviteAdapter.matches({}));
  assert.ok(!jobviteAdapter.matches(null));

  // Endpoint is rebuilt from the slug — canonical, host-pinned.
  assert.equal(jobviteAdapter.buildEndpoint({ careers_url: CAREERS }), API);
  assert.equal(jobviteAdapter.buildEndpoint({ careers_url: `${CAREERS}/jobs` }), API);
  // api: wins over careers_url (custom slugs).
  assert.equal(
    jobviteAdapter.buildEndpoint({
      api: 'https://jobs.jobvite.com/api/company/acme-corp/jobs',
      careers_url: 'https://jobs.jobvite.com/other',
    }),
    'https://jobs.jobvite.com/api/company/acme-corp/jobs',
  );
  // Explicit provider with an un-pinnable URL → null endpoint (never fetched).
  assert.equal(jobviteAdapter.buildEndpoint({ provider: 'jobvite', careers_url: 'https://careers.branded.com' }), null);
  assert.equal(jobviteAdapter.buildEndpoint({}), null);
  assert.equal(jobviteAdapter.buildEndpoint(null), null);
});
