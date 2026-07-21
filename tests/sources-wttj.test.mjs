/**
 * Welcome to the Jungle source + adapter tests (CI-isolated, fake fetchImpl).
 * No live network, no parent-project files, no port binding.
 *
 * Ports the meaningful cases from parent career-ops `tests/providers/wttj.test.mjs`,
 * adapted to the 12-field web-ui job shape (salary is a string; isRemote /
 * workplaceType / id / source added).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchWttj,
  parseEnvPayload,
  normalizeWttjHit,
  assertHost,
  ENV_URL,
} from '../server/lib/sources/wttj.mjs';
import { wttjAdapter } from '../server/lib/portals/adapters/wttj.mjs';

// ---------------------------------------------------------------------------
// Fixtures / fake fetch
// ---------------------------------------------------------------------------

const HEX_KEY = '0123456789abcdef0123456789abcdef';
const envText = (appId, apiKey) =>
  `window.env = ${JSON.stringify({
    PUBLIC_ALGOLIA_APPLICATION_ID: appId,
    PUBLIC_ALGOLIA_API_KEY_CLIENT: apiKey,
    OTHER: 'noise',
  })};`;
const ENV_OK = envText('AB12CD34', HEX_KEY);

const mkHit = (slug, title) => ({
  name: title,
  slug,
  organization: { name: 'Acme', slug: 'acme' },
  offices: [{ city: 'Paris', country: 'France' }],
});

// Response-like fake: env text on /api/env, Algolia JSON elsewhere. Records
// every call so header/host/param assertions can inspect them.
function mkFetch(env, hitsFor) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url.includes('/api/env')) {
      return { ok: true, status: 200, text: async () => env, json: async () => { throw new Error('env is not json'); } };
    }
    const params = new URLSearchParams(JSON.parse(opts.body).params);
    const info = { url, opts, query: params.get('query'), hitsPerPage: params.get('hitsPerPage') };
    return { ok: true, status: 200, json: async () => hitsFor(info), text: async () => '' };
  };
  return { calls, fetchImpl };
}

// ---------------------------------------------------------------------------
// parseEnvPayload
// ---------------------------------------------------------------------------

test('parseEnvPayload: extracts and trims the Algolia app id + client key', () => {
  const creds = parseEnvPayload(envText(' AB12CD34 ', HEX_KEY));
  assert.equal(creds.appId, 'AB12CD34');
  assert.equal(creds.apiKey, HEX_KEY);
});

test('parseEnvPayload: accepts a long non-hex (secured/base64) client key — length bounds only', () => {
  const securedKey = 'QWxnb2xpYSBzZWN1cmVkIGtleQ==' + 'x'.repeat(100);
  assert.equal(parseEnvPayload(envText('AB12CD34', securedKey)).apiKey, securedKey);
});

test('parseEnvPayload: rejects short key, non-alphanumeric app id, and malformed payloads', () => {
  assert.throws(() => parseEnvPayload(envText('AB12CD34', 'short')), /api key shape/);
  assert.throws(() => parseEnvPayload(envText('bad app id!', HEX_KEY)), /unexpected Algolia app id/);
  assert.throws(() => parseEnvPayload('window.env = undefined;'), /no JSON object/);
  assert.throws(() => parseEnvPayload('window.env = {not json};'), /not valid JSON/);
});

// ---------------------------------------------------------------------------
// normalizeWttjHit → 12-field web-ui shape
// ---------------------------------------------------------------------------

test('normalizeWttjHit: maps a full hit to the 12-field web-ui shape', () => {
  const j = normalizeWttjHit({
    name: '  Senior Data Engineer  ',
    slug: 'senior-data-engineer_abc123',
    organization: { name: 'Example SAS', slug: 'example-sas' },
    offices: [{ city: 'Paris', country: 'France' }, { city: 'Lyon', country: 'France' }],
    remote: 'fulltime',
    published_at_timestamp: 1751500800,
    salary_yearly_minimum: 60000,
    salary_maximum: 80000,
    salary_period: 'yearly',
    salary_currency: 'eur',
  });
  assert.equal(j.id, 'wttj-example-sas-senior-data-engineer_abc123');
  assert.equal(j.title, 'Senior Data Engineer');
  assert.equal(j.company, 'Example SAS');
  assert.equal(j.url, 'https://www.welcometothejungle.com/en/companies/example-sas/jobs/senior-data-engineer_abc123');
  assert.equal(j.location, 'Paris, France, Remote');
  assert.equal(j.isRemote, true);
  assert.equal(j.workplaceType, 'Remote');
  assert.equal(j.salary, '60000–80000 EUR');
  assert.equal(j.date, new Date(1751500800000).toISOString().slice(0, 10));
  assert.equal(j.relocates, false);
  assert.equal(j.snippet, '');
  assert.equal(j.source, 'wttj');
});

test('normalizeWttjHit: ignores a non-yearly salary_maximum (keeps the annualized minimum)', () => {
  const j = normalizeWttjHit({
    name: 'Job',
    slug: 'job-1',
    organization: { name: 'Acme', slug: 'acme' },
    salary_yearly_minimum: 50000,
    salary_maximum: 5000,
    salary_period: 'monthly',
    salary_currency: 'eur',
  });
  assert.equal(j.salary, '50000 EUR');
});

test('normalizeWttjHit: bare hit falls back to the board name and omits absent salary/date/location', () => {
  const j = normalizeWttjHit({ name: 'Job', slug: 'job-1', organization: { slug: 'acme' } });
  assert.equal(j.company, 'Welcome to the Jungle');
  assert.equal(j.location, '');
  assert.equal(j.salary, '');
  assert.equal(j.date, '');
  assert.equal(j.isRemote, false);
  assert.equal(j.workplaceType, 'Onsite');
  assert.equal(j.id, 'wttj-acme-job-1');
});

test('normalizeWttjHit: returns null for missing org slug, path-unsafe slugs, and non-objects', () => {
  assert.equal(normalizeWttjHit({ name: 'Job', slug: 'job-1', organization: {} }), null);
  assert.equal(normalizeWttjHit({ name: 'Job', slug: '../evil', organization: { slug: 'acme' } }), null);
  assert.equal(normalizeWttjHit(null), null);
  assert.equal(normalizeWttjHit('nope'), null);
});

// ---------------------------------------------------------------------------
// fetchWttj — env bootstrap, per-query Algolia calls, headers, dedup
// ---------------------------------------------------------------------------

test('fetchWttj: one Algolia query per search, dedups across queries, bootstraps /api/env with redirect error', async () => {
  const { calls, fetchImpl } = mkFetch(ENV_OK, ({ query }) => ({
    hits: query === 'finops'
      ? [mkHit('job-a', 'FinOps Lead'), mkHit('job-b', 'FinOps Analyst')]
      : [mkHit('job-b', 'FinOps Analyst'), mkHit('job-c', 'Snowflake Engineer')],
  }));
  const jobs = await fetchWttj(ENV_URL, {
    fetchImpl,
    company: { name: 'WTTJ', provider: 'wttj', wttj: { queries: ['finops', 'snowflake'] } },
  });

  assert.equal(jobs.length, 3); // job-b deduped
  const envCall = calls.find((c) => c.url.includes('/api/env'));
  assert.equal(envCall.url, ENV_URL);
  assert.equal(envCall.opts.redirect, 'error');

  const algoliaCalls = calls.filter((c) => !c.url.includes('/api/env'));
  assert.equal(algoliaCalls.length, 2);
  assert.equal(algoliaCalls[0].url, 'https://AB12CD34-dsn.algolia.net/1/indexes/wttj_jobs_production_en/query');
  const h = algoliaCalls[0].opts.headers;
  assert.equal(h['x-algolia-application-id'], 'AB12CD34');
  assert.equal(h['x-algolia-api-key'], HEX_KEY);
  assert.equal(h.referer, 'https://www.welcometothejungle.com/');
  assert.equal(algoliaCalls[0].opts.redirect, 'error');
});

test('fetchWttj: defaults to 100 hits per query and caps max_hits at 200', async () => {
  const def = mkFetch(ENV_OK, () => ({ hits: [] }));
  await fetchWttj(ENV_URL, { fetchImpl: def.fetchImpl, company: { provider: 'wttj', wttj: { queries: ['x'] } } });
  assert.equal(def.calls.find((c) => !c.url.includes('/api/env')).opts.body.includes('hitsPerPage=100'), true);

  const capped = mkFetch(ENV_OK, () => ({ hits: [] }));
  await fetchWttj(ENV_URL, { fetchImpl: capped.fetchImpl, company: { provider: 'wttj', wttj: { queries: ['x'], max_hits: 500 } } });
  assert.equal(capped.calls.find((c) => !c.url.includes('/api/env')).opts.body.includes('hitsPerPage=200'), true);
});

test('fetchWttj: throws without an explicit wttj.queries config (never scans the whole board)', async () => {
  const { fetchImpl } = mkFetch(ENV_OK, () => ({ hits: [] }));
  await assert.rejects(
    () => fetchWttj(ENV_URL, { fetchImpl, company: { provider: 'wttj' } }),
    /the WTTJ board is global/,
  );
});

test('fetchWttj: throws on an Algolia response without a hits array', async () => {
  const { fetchImpl } = mkFetch(ENV_OK, () => ({ error: 'nope' }));
  await assert.rejects(
    () => fetchWttj(ENV_URL, { fetchImpl, company: { provider: 'wttj', wttj: { queries: ['x'] } } }),
    /unexpected Algolia response/,
  );
});

// ---------------------------------------------------------------------------
// assertHost SSRF guard
// ---------------------------------------------------------------------------

test('assertHost: pins protocol + hostname', () => {
  assert.equal(assertHost(ENV_URL, 'www.welcometothejungle.com', 'env'), ENV_URL);
  assert.throws(() => assertHost('http://www.welcometothejungle.com/api/env', 'www.welcometothejungle.com', 'env'), /must use HTTPS/);
  assert.throws(() => assertHost('https://evil.com/api/env', 'www.welcometothejungle.com', 'env'), /untrusted env hostname/);
  assert.throws(() => assertHost('not-a-url', 'www.welcometothejungle.com', 'env'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('adapter: id/label, matches only provider=wttj, buildEndpoint + fetch wiring', async () => {
  assert.equal(wttjAdapter.id, 'wttj');
  assert.equal(wttjAdapter.label, 'Welcome to the Jungle');

  assert.equal(wttjAdapter.matches({ provider: 'wttj' }), true);
  assert.equal(wttjAdapter.matches({ provider: 'themuse' }), false);
  assert.equal(wttjAdapter.matches({ careers_url: 'https://www.welcometothejungle.com/en/jobs' }), false);

  assert.equal(wttjAdapter.buildEndpoint({ provider: 'wttj' }), ENV_URL);
  assert.equal(wttjAdapter.buildEndpoint({ provider: 'wttj', api: 'https://www.welcometothejungle.com/api/env' }), 'https://www.welcometothejungle.com/api/env');

  const { fetchImpl } = mkFetch(ENV_OK, () => ({ hits: [mkHit('job-a', 'FinOps Lead')] }));
  const jobs = await wttjAdapter.fetch(wttjAdapter.buildEndpoint({ provider: 'wttj' }), {
    fetchImpl,
    company: { provider: 'wttj', wttj: { queries: ['finops'] } },
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].source, 'wttj');
});
