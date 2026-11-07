/**
 * HiBob source (upstream #6502 port) — CI-isolated suite.
 *
 * A HiBob tenant board (`<tenant>.careers.hibob.com`) serves its whole
 * inventory from one anonymous JSON endpoint (`/api/job-ad`, tenant named by
 * the `companyidentifier` header) — no pagination, full posting text on every
 * row. The parser must fail CLOSED on a body without jobAdDetails[] (a
 * silent zero would look like an empty board) while a present-and-empty
 * array is []. Ported cases: tenant resolution (https + suffix host +
 * label shape, suffixed labels kept, any path on the tenant claimed), the
 * fetch contract (one GET with the lower-cased companyidentifier header,
 * redirect:'error', a 401 reported as a missing board whose message never
 * says "network"), the row mapping (uuid posting URL, site/country location
 * fold with Remote, publishedAt/language/description, annual-only salary),
 * the fail-closed parse gates, and the normalized scanner rows. No network —
 * fetchHibob runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  resolveHibobTenant,
  resolveTenant,
  apiOriginFor,
  parseHibobSalary,
  parseHibobJobAds,
  fetchHibob,
} from '../server/lib/sources/hibob.mjs';
import { hibobAdapter } from '../server/lib/portals/adapters/hibob.mjs';

const ORIGIN = 'https://acme.careers.hibob.com';
const API = `${ORIGIN}/api/job-ad`;

function row(overrides = {}) {
  return {
    id: '0b1c2d3e-0000-4000-8000-000000000001',
    title: 'Senior Backend Engineer',
    site: 'Berlin',
    country: 'Germany',
    language: 'en',
    description: '<p>Build &amp; run <b>services</b>.</p>',
    requirements: '<ul><li>Node.js</li></ul>',
    responsibilities: '<p>Own the API.</p>',
    benefits: '<p>Learning budget.</p>',
    publishedAt: '2026-08-19T10:25:44.289429Z',
    workspaceTypeId: 'hybrid',
    payTransparencyMinSalary: null,
    payTransparencyMaxSalary: null,
    payTransparencySalaryCurrency: null,
    payTransparencySalaryPayPeriod: null,
    ...overrides,
  };
}

function payload(rows) {
  return {
    filterGroups: { departments: [], sites: [], jobTypes: [], workspaceTypes: [] },
    jobAdDetails: rows,
    jobOpeningMetadata: [{ dataPath: 'title', name: 'Job title' }],
  };
}

function makeFetch(answer) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    if (answer instanceof Error) throw answer;
    return { ok: true, status: 200, json: async () => answer, headers: { get: () => null } };
  };
  return { calls, impl };
}

const SLEEP = async () => {};

// ── registry meta + adapter contract ─────────────────────────────────────────

test('hibob: meta — value, label, region en; adapter contract shape', () => {
  assert.deepEqual(meta, { value: 'hibob', label: 'HiBob', region: 'en' });
  assert.equal(hibobAdapter.id, 'hibob');
  assert.equal(hibobAdapter.label, 'HiBob');
  assert.equal(typeof hibobAdapter.matches, 'function');
  assert.equal(typeof hibobAdapter.buildEndpoint, 'function');
  assert.equal(typeof hibobAdapter.fetch, 'function');
});

test('hibob: adapter claims the board root, a posting link, an apply link and a suffixed label; endpoint is the API string', () => {
  for (const careers_url of [
    'https://acme.careers.hibob.com',
    'https://acme.careers.hibob.com/jobs',
    'https://acme.careers.hibob.com/jobs/0b1c2d3e-0000-4000-8000-000000000001/apply',
    'https://ACME.careers.hibob.com:8443/jobs?x=1#top',
    'https://exampleco-641e1b39232b.careers.hibob.com/jobs',
  ]) {
    assert.equal(hibobAdapter.matches({ name: 'Acme', careers_url }), true, careers_url);
  }
  assert.equal(hibobAdapter.matches({ name: 'Acme', api: `${API}` }), true, 'an explicit api: URL is claimed');
  assert.equal(hibobAdapter.matches({ name: 'Acme', provider: 'hibob' }), true, 'explicit provider override');
  assert.equal(hibobAdapter.buildEndpoint({ careers_url: 'https://ACME.careers.hibob.com:8443/jobs?x=1' }), API, 'the tenant label is lower-cased; path/port/query dropped');
  assert.equal(hibobAdapter.buildEndpoint({ careers_url: 'https://exampleco-641e1b39232b.careers.hibob.com/jobs' }), 'https://exampleco-641e1b39232b.careers.hibob.com/api/job-ad');
  const rejects = [
    ['non-https', 'http://acme.careers.hibob.com/jobs'],
    ['the bare suffix host is not a tenant', 'https://careers.hibob.com/jobs'],
    ['the vendor marketing host', 'https://www.hibob.com/careers/'],
    ['suffix-spoofed host', 'https://acme.careers.hibob.com.evil.example/jobs'],
    ['prefix look-alike', 'https://evilcareers.hibob.com/jobs'],
    ['two tenant labels', 'https://a.b.careers.hibob.com/jobs'],
    ['label starting with a hyphen', 'https://-acme.careers.hibob.com/jobs'],
    ['path-only mention', 'https://evil.example/acme.careers.hibob.com/jobs'],
    ['malformed', 'not a url'],
  ];
  for (const [name, u] of rejects) {
    assert.equal(hibobAdapter.matches({ careers_url: u }), false, `${name} must be rejected`);
    assert.equal(hibobAdapter.buildEndpoint({ careers_url: u }), null, `${name} yields no endpoint`);
  }
  assert.equal(hibobAdapter.matches(null), false);
  assert.equal(hibobAdapter.matches(7), false);
  assert.equal(hibobAdapter.matches({}), false);
});

test('hibob: resolveHibobTenant reads only the host label; resolveTenant prefers api:', () => {
  assert.equal(resolveHibobTenant('https://acme.careers.hibob.com/jobs/x/apply'), 'acme');
  assert.equal(resolveHibobTenant('https://acme.careers.hibob.com.evil.example'), null);
  assert.equal(resolveHibobTenant('http://acme.careers.hibob.com'), null);
  assert.equal(resolveHibobTenant(''), null);
  assert.equal(resolveHibobTenant(42), null);
  assert.equal(resolveTenant({ api: 'https://acme.careers.hibob.com/api/job-ad', careers_url: 'https://example.com' }), 'acme');
  assert.equal(resolveTenant({ careers_url: 'https://acme.careers.hibob.com/jobs' }), 'acme');
  assert.equal(resolveTenant({}), null);
  assert.equal(resolveTenant(null), null);
  assert.equal(apiOriginFor('acme'), API);
});

test('hibob: fetch sends one GET with the lower-cased tenant header and redirect:"error"', async () => {
  const { calls, impl } = makeFetch(payload([row()]));
  await fetchHibob('https://ExampleCo-641E1B39232B.careers.hibob.com/jobs', { fetchImpl: impl, company: { name: 'Acme' }, sleep: SLEEP });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://exampleco-641e1b39232b.careers.hibob.com/api/job-ad', 'the origin is rebuilt from the tenant label alone');
  assert.equal(calls[0].opts.redirect, 'error');
  assert.equal(calls[0].opts.headers.companyidentifier, 'exampleco-641e1b39232b');
  assert.equal(calls[0].opts.headers.accept, 'application/json');
});

test('hibob: fetch refuses a non-tenant URL before any request', async () => {
  let touched = 0;
  for (const careers_url of ['https://acme.careers.hibob.com.evil.example/jobs', 'http://acme.careers.hibob.com/jobs', 'https://example.com/jobs']) {
    await assert.rejects(
      () => fetchHibob(careers_url, { fetchImpl: async () => { touched += 1; return { ok: true, status: 200, json: async () => ({}) }; } }),
      /not a HiBob careers site|untrusted hostname|must use HTTPS/,
      `${careers_url} must fail loud before any request`,
    );
  }
  assert.equal(touched, 0, 'the endpoint is validated before the fetch');
});

test('hibob: parseHibobJobAds maps a posting — uuid URL, location fold, dates, language, joined description', () => {
  const jobs = parseHibobJobAds(payload([row()]), ORIGIN, 'Acme');
  assert.equal(jobs.length, 1);
  const [job] = jobs;
  assert.equal(job.title, 'Senior Backend Engineer');
  assert.equal(job.url, `${ORIGIN}/jobs/0b1c2d3e-0000-4000-8000-000000000001`);
  assert.equal(job.company, 'Acme');
  assert.equal(job.location, 'Berlin, Germany');
  assert.equal(job.postedAt, Date.parse('2026-08-19T10:25:44.289429Z'));
  assert.equal(job.language, 'en');
  assert.equal(job.description, 'Build & run services . Own the API. Node.js Learning budget.', 'the four text sections join and reduce to plain text');
  assert.equal('requisitionId' in job, false, 'the posting id is never a requisition id');
  assert.equal('salary' in job, false, 'no pay figures → no salary');
});

test('hibob: parseHibobSalary — annual figures only, one-sided ranges filled, bounds swapped, 0 = not set', () => {
  const s = (min, max, period = 'Annual', currency = 'USD') => parseHibobSalary({
    payTransparencyMinSalary: min, payTransparencyMaxSalary: max,
    payTransparencySalaryCurrency: currency, payTransparencySalaryPayPeriod: period,
  });
  assert.deepEqual(s(48000, 55000, 'Annual', 'eur'), { min: 48000, max: 55000, currency: 'EUR' });
  assert.deepEqual(s(90000, null), { min: 90000, max: 90000, currency: 'USD' });
  assert.deepEqual(s(null, '120000'), { min: 120000, max: 120000, currency: 'USD' });
  assert.deepEqual(s(150000, 120000), { min: 120000, max: 150000, currency: 'USD' });
  assert.deepEqual(s(50000, 60000, 'Annual', null), { min: 50000, max: 60000, currency: '' });
  assert.equal(s(0, 0), null, 'a bound of 0 means not set');
  assert.equal(s(null, null), null);
  assert.equal(s('abc', -5), null);
  assert.equal(s(4000, 5000, 'Monthly'), null, 'an unseen period is not annualized by guess');
  assert.equal(s(40, 60, 'Hourly'), null);
  assert.equal(parseHibobSalary(null), null);
});

test('hibob: location folds the country and marks Remote; salary rides the parsed job and the scanner row', () => {
  const jobs = parseHibobJobAds(payload([
    row({ id: 'a1', site: 'Germany', country: 'Germany' }),
    row({ id: 'a2', site: 'Lisbon', country: 'Portugal', workspaceTypeId: 'remote' }),
    row({ id: 'a3', site: 'APAC - Remote - India', country: 'India', workspaceTypeId: 'remote' }),
    row({ id: 'a4', site: 'Office HQ - Berlin', country: 'Germany', workspaceTypeId: 'on_site' }),
    row({ id: 'a5', site: '', country: 'France', workspaceTypeId: 'remote' }),
    row({
      id: 'a6', site: 'Warsaw', country: 'Poland',
      payTransparencyMinSalary: 48000, payTransparencyMaxSalary: 55000,
      payTransparencySalaryCurrency: 'eur', payTransparencySalaryPayPeriod: 'Annual',
    }),
  ]), ORIGIN, 'Acme');
  assert.deepEqual(jobs.map((j) => j.location), [
    'Germany',
    'Lisbon, Portugal, Remote',
    'APAC - Remote - India',
    'Office HQ - Berlin, Germany',
    'France, Remote',
    'Warsaw, Poland',
  ]);
  assert.deepEqual(jobs[5].salary, { min: 48000, max: 55000, currency: 'EUR' });
});

test('hibob: rows without a title or id are skipped; a lone-surrogate id drops one row, not the page', () => {
  const jobs = parseHibobJobAds(payload([
    row({ id: 'keep', title: 'QA Engineer' }),
    row({ id: 'no-title', title: '' }),
    row({ id: '', title: 'No Id' }),
    row({ id: 42, title: "Numeric Id" }),
    row({ id: 'ok-\uD800', title: 'Bad surrogate' }),
    null,
    'junk',
  ]), ORIGIN, 'Acme');
  assert.deepEqual(jobs.map((j) => j.title), ['QA Engineer'], 'a non-string id is not a usable id');
});

test('hibob: optional fields are left out when absent or malformed', () => {
  const [job] = parseHibobJobAds(payload([
    row({ publishedAt: 'not a date', language: null, description: null, requirements: null, responsibilities: null, benefits: null }),
  ]), ORIGIN, 'Acme');
  assert.equal('postedAt' in job, false);
  assert.equal('language' in job, false);
  assert.equal('description' in job, false);
});

test('hibob: an empty jobAdDetails is an empty board; any other envelope throws via the shape guard', () => {
  assert.deepEqual(parseHibobJobAds(payload([]), ORIGIN, 'Acme'), []);
  for (const bad of [{}, { jobAdDetails: null }, { jobAdDetails: {} }, { jobs: [] }, '', null, 7]) {
    assert.throws(() => parseHibobJobAds(bad, ORIGIN, 'Acme'), /hibob/, JSON.stringify(bad));
  }
});

test('hibob: a 401 is a missing board whose message never says "network"; other failures propagate', async () => {
  const unauthorized = makeFetch(Object.assign(new Error('HTTP 401'), { status: 401 }));
  await assert.rejects(
    () => fetchHibob(ORIGIN, { fetchImpl: unauthorized.impl, company: { name: 'Acme' }, sleep: SLEEP }),
    (e) => e.status === 404 && /not a HiBob careers site/.test(e.message),
  );
  // A tenant label may contain the word "network" — the mapped error must
  // never read as a network failure downstream.
  const label = makeFetch(Object.assign(new Error('HTTP 401'), { status: 401 }));
  await assert.rejects(
    () => fetchHibob('https://acme-network.careers.hibob.com/jobs', { fetchImpl: label.impl, company: { name: 'Acme Network' }, sleep: SLEEP }),
    (e) => e.status === 404 && !/network/i.test(e.message),
  );

  class FakeSentinel extends Error {}
  const other = makeFetch(new FakeSentinel('boom'));
  await assert.rejects(
    () => fetchHibob(ORIGIN, { fetchImpl: other.impl, company: { name: 'Acme' }, sleep: SLEEP }),
    FakeSentinel,
  );
});

test('hibob: fetch normalizes to scanner rows — id/source/date/salary string/snippet', async () => {
  const { impl } = makeFetch(payload([
    row(),
    row({
      id: 'a7', title: 'Remote Data Engineer', site: 'Warsaw', country: 'Poland', workspaceTypeId: 'remote',
      payTransparencyMinSalary: 48000, payTransparencyMaxSalary: 55000,
      payTransparencySalaryCurrency: 'eur', payTransparencySalaryPayPeriod: 'Annual',
    }),
  ]));
  const jobs = await fetchHibob(`${ORIGIN}/jobs`, { fetchImpl: impl, company: { name: 'Acme' }, sleep: SLEEP });
  assert.equal(jobs.length, 2);
  const [a, b] = jobs;
  assert.equal(a.id, `hibob-${a.url}`);
  assert.equal(a.source, 'hibob');
  assert.equal(a.company, 'Acme');
  assert.equal(a.salary, '');
  assert.equal(a.date, new Date(Date.parse('2026-08-19T10:25:44.289429Z')).toISOString());
  assert.ok(a.snippet.includes('Learning budget'), 'the joined description becomes the snippet');
  assert.equal(b.isRemote, true);
  assert.equal(b.salary, '48000–55000 EUR');
});
