/**
 * Agentic Jobs source — REST API version (parent career-ops
 * providers/agentic-jobs.mjs parity, #2143/#2167). The site's HTML markup
 * changed and the old `data-impression-slug` scraper broke; the source now
 * pages the public `{API_BASE}/jobs?page=N` REST endpoint. Provider-selected.
 * CI-isolated (fake fetchImpl serving canned JSON, no network).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countryName,
  stripHtml,
  normalizeAgenticLocation,
  normalizeAgenticSalary,
  salaryToString,
  normalizeAgenticJob,
  parseAgenticJobs,
  fetchAgenticJobs,
  assertAgenticUrl,
  FEED_URL,
  meta,
} from '../server/lib/sources/agenticjobs.mjs';
import { agenticjobsAdapter } from '../server/lib/portals/adapters/agenticjobs.mjs';

// --- fake fetch serving canned per-page JSON (fetchJson expects res.ok + res.json())
const mkRec = (n) => ({ title: `Engineer ${n}`, companyName: `Company ${n}`, slug: `engineer-${n}`, location: 'Remote' });
const mkFetch = (pages) => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    const page = Number(new URL(url).searchParams.get('page'));
    const body = pages[page - 1] ?? { data: [], meta: { total: 0, page, per_page: 50 } };
    return { ok: true, json: async () => body };
  };
  return { calls, fetchImpl };
};
// No real inter-page pause in tests.
const NO_DELAY = { pageDelayMs: 0 };

test('meta: id/label/region + adapter.id', () => {
  assert.equal(meta.value, 'agenticjobs');
  assert.equal(meta.label, 'Agentic Jobs');
  assert.equal(meta.region, 'en');
  assert.equal(agenticjobsAdapter.id, 'agenticjobs');
  assert.equal(FEED_URL, 'https://agentic-engineering-jobs.com/api/v1/jobs');
});

test('countryName: resolves ISO alpha-2 codes case-insensitively, "" for invalid', () => {
  assert.equal(countryName('US'), 'United States');
  assert.equal(countryName('de'), 'Germany');
  assert.equal(countryName('XX'), '');
  assert.equal(countryName('USA'), '');
  assert.equal(countryName(null), '');
  assert.equal(countryName(42), '');
});

test('stripHtml: drops tags/script/style, decodes entities, collapses whitespace', () => {
  const html =
    '<script>var x = 1;</script><style>.a{}</style><p>Ship &amp; iterate</p><ul><li>Node.js</li><li>Go</li></ul>';
  assert.equal(stripHtml(html), 'Ship & iterate Node.js Go');
  assert.equal(stripHtml(''), '');
  assert.equal(stripHtml(null), '');
  assert.equal(stripHtml(undefined), '');
});

test('normalizeAgenticLocation: location string → deduped countries → geoRegion → ""', () => {
  assert.equal(normalizeAgenticLocation({ location: 'Remote (EU)', countries: ['DE'] }), 'Remote (EU)');
  assert.equal(normalizeAgenticLocation({ location: '', countries: ['CA', 'GB'] }), 'Canada / United Kingdom');
  assert.equal(normalizeAgenticLocation({ location: null, countries: [], geoRegion: 'global' }), 'global');
  assert.equal(normalizeAgenticLocation({}), '');
});

test('normalizeAgenticSalary: maps flat bounds, uppercases currency, omits null bounds', () => {
  const both = normalizeAgenticSalary({ salaryMin: 196875, salaryMax: 246094, salaryCurrency: 'usd' });
  assert.deepEqual(both, { min: 196875, max: 246094, currency: 'USD' });
  const minOnly = normalizeAgenticSalary({ salaryMin: 100000, salaryMax: null, salaryCurrency: 'USD' });
  assert.equal(minOnly.min, 100000);
  assert.ok(!('max' in minOnly));
  assert.equal(normalizeAgenticSalary({ salaryMin: null, salaryMax: null, salaryCurrency: null }), null);
});

test('salaryToString: renders the STRING salary field, "" when no comp data', () => {
  assert.equal(salaryToString({ min: 120000, max: 160000, currency: 'USD' }), '120000–160000 USD');
  assert.equal(salaryToString({ min: 100000, currency: 'USD' }), 'from 100000 USD');
  assert.equal(salaryToString({ max: 160000 }), 'up to 160000');
  assert.equal(salaryToString(null), '');
});

test('normalizeAgenticJob: full API record → web-ui job shape', () => {
  const job = normalizeAgenticJob({
    title: 'Senior Backend Engineer (Ruby)',
    companyName: 'Acme AI',
    slug: 'senior-backend-engineer-ruby-acme',
    location: 'Remote - Canada; Remote - United Kingdom',
    countries: ['CA', 'GB'],
    description: '<p>Ship &amp; iterate with <strong>Ruby on Rails</strong>.</p>',
    postedAt: '2026-07-01T12:00:00.000Z',
    salaryMin: 120000,
    salaryMax: 160000,
    salaryCurrency: 'usd',
  });
  assert.equal(job.title, 'Senior Backend Engineer (Ruby)');
  assert.equal(job.company, 'Acme AI');
  assert.equal(job.url, 'https://agentic-engineering-jobs.com/jobs/senior-backend-engineer-ruby-acme');
  assert.equal(job.id, 'agenticjobs-https://agentic-engineering-jobs.com/jobs/senior-backend-engineer-ruby-acme');
  assert.equal(job.location, 'Remote - Canada; Remote - United Kingdom');
  assert.equal(job.isRemote, true);
  assert.equal(job.workplaceType, 'Remote');
  assert.equal(job.relocates, false);
  assert.equal(job.date, '2026-07-01');
  assert.equal(job.salary, '120000–160000 USD');
  assert.equal(job.snippet, 'Ship & iterate with Ruby on Rails .');
  assert.equal(job.source, 'agenticjobs');
});

test('normalizeAgenticJob: derives location from countries + non-Remote → isRemote false', () => {
  const job = normalizeAgenticJob({ title: 'X', companyName: 'Y', slug: 'x-y', countries: ['DE'] });
  assert.equal(job.location, 'Germany');
  assert.equal(job.isRemote, false);
  assert.equal(job.workplaceType, '');
});

test('normalizeAgenticJob: accepts a same-host HTTPS `url`/`company` fallback shape', () => {
  const job = normalizeAgenticJob({
    title: 'Platform Engineer',
    company: 'Globex',
    url: 'https://agentic-engineering-jobs.com/jobs/platform-engineer-globex',
  });
  assert.equal(job.company, 'Globex');
  assert.equal(job.url, 'https://agentic-engineering-jobs.com/jobs/platform-engineer-globex');
  // A validated slug is preferred over a supplied url field.
  const both = normalizeAgenticJob({
    title: 'X',
    companyName: 'Y',
    slug: 'slug-wins',
    url: 'https://agentic-engineering-jobs.com/jobs/url-loses',
  });
  assert.equal(both.url, 'https://agentic-engineering-jobs.com/jobs/slug-wins');
});

test('normalizeAgenticJob: rejects off-host / non-HTTPS / path-unsafe slug + missing required', () => {
  assert.equal(normalizeAgenticJob({ title: 'X', company: 'Y', url: 'https://evil.com/x' }), null);
  assert.equal(normalizeAgenticJob({ title: 'X', company: 'Y', url: 'http://agentic-engineering-jobs.com/x' }), null);
  for (const slug of ['bad slug!', '../admin', 'a/b', 'x?y=1', 'x#frag']) {
    assert.equal(normalizeAgenticJob({ title: 'X', companyName: 'Y', slug }), null, `slug ${slug} should reject`);
  }
  assert.equal(normalizeAgenticJob({ companyName: 'Y', slug: 'x' }), null); // no title
  assert.equal(normalizeAgenticJob({ title: 'X', slug: 'x' }), null); // no company
  assert.equal(normalizeAgenticJob({ title: 'X', companyName: 'Y' }), null); // no url source
  assert.equal(normalizeAgenticJob(null), null);
});

test('normalizeAgenticJob: empty salary/date/snippet when the record carries none', () => {
  const job = normalizeAgenticJob({ title: 'X', companyName: 'Y', slug: 'x-y', location: 'Berlin' });
  assert.equal(job.salary, '');
  assert.equal(job.date, '');
  assert.equal(job.snippet, '');
});

test('parseAgenticJobs: maps a page, dedups repeated urls, honors cap, tolerates non-array', () => {
  const json = { data: [mkRec(1), mkRec(2), mkRec(1)], meta: { total: 3, page: 1, per_page: 50 } };
  const jobs = parseAgenticJobs(json);
  assert.equal(jobs.length, 2); // third record repeats slug → deduped
  assert.ok(jobs.every((j) => j.source === 'agenticjobs'));
  assert.equal(parseAgenticJobs(json, 1).length, 1); // cap honored
  assert.deepEqual(parseAgenticJobs(12345), []);
  assert.deepEqual(parseAgenticJobs({ data: 'nope' }), []);
});

test('fetchAgenticJobs: stops after a short (< per_page) page; redirect:error + JSON accept', async () => {
  const { calls, fetchImpl } = mkFetch([
    { data: [mkRec(1), mkRec(2)], meta: { total: 2, page: 1, per_page: 50 } },
  ]);
  const jobs = await fetchAgenticJobs(FEED_URL, { fetchImpl, ...NO_DELAY });
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://agentic-engineering-jobs.com/api/v1/jobs?page=1');
  assert.equal(calls[0].opts.redirect, 'error');
  assert.equal(calls[0].opts.headers.accept, 'application/json');
  assert.ok(jobs.every((j) => new URL(j.url).hostname === 'agentic-engineering-jobs.com'));
});

test('fetchAgenticJobs: pages until meta.total is covered', async () => {
  const fullPage = Array.from({ length: 50 }, (_, i) => mkRec(i + 1));
  const { calls, fetchImpl } = mkFetch([
    { data: fullPage, meta: { total: 51, page: 1, per_page: 50 } },
    { data: [mkRec(51)], meta: { total: 51, page: 2, per_page: 50 } },
  ]);
  const jobs = await fetchAgenticJobs(FEED_URL, { fetchImpl, ...NO_DELAY });
  assert.equal(jobs.length, 51);
  assert.equal(calls.length, 2);
});

test('fetchAgenticJobs: dedups a job repeated across two different pages', async () => {
  const { fetchImpl } = mkFetch([
    { data: [mkRec(1), mkRec(2)], meta: { total: 3, page: 1, per_page: 2 } },
    { data: [mkRec(2), mkRec(3)], meta: { total: 3, page: 2, per_page: 2 } },
  ]);
  const jobs = await fetchAgenticJobs(FEED_URL, { fetchImpl, ...NO_DELAY });
  assert.equal(jobs.length, 3);
  assert.equal(new Set(jobs.map((j) => j.url)).size, 3);
});

test('fetchAgenticJobs: throws on a malformed mid-pagination page (no silent truncation)', async () => {
  const { fetchImpl } = mkFetch([
    { data: [mkRec(1), mkRec(2)], meta: { total: 99, page: 1, per_page: 2 } },
    { meta: { total: 99, page: 2, per_page: 2 } }, // "data" missing entirely
  ]);
  await assert.rejects(
    () => fetchAgenticJobs(FEED_URL, { fetchImpl, ...NO_DELAY }),
    /unexpected API response shape on page 2/,
  );
});

test('fetchAgenticJobs: throws when the API yields zero jobs (response-shape-change canary)', async () => {
  const { fetchImpl } = mkFetch([{ data: [], meta: { total: 0, page: 1, per_page: 50 } }]);
  await assert.rejects(
    () => fetchAgenticJobs(FEED_URL, { fetchImpl, ...NO_DELAY }),
    /parsed 0 jobs from the API/,
  );
});

test('assertAgenticUrl: pins host to agentic-engineering-jobs.com over HTTPS', () => {
  assert.equal(assertAgenticUrl(FEED_URL), FEED_URL);
  assert.throws(() => assertAgenticUrl('https://evil.com/'), /untrusted hostname/);
  assert.throws(() => assertAgenticUrl('http://agentic-engineering-jobs.com/'), /must use HTTPS/);
  assert.throws(() => assertAgenticUrl('not a url'), /invalid URL/);
});

test('adapter: matches only on provider=agenticjobs; buildEndpoint default/override/off-host', () => {
  assert.ok(agenticjobsAdapter.matches({ provider: 'agenticjobs' }));
  assert.equal(agenticjobsAdapter.matches({ careers_url: 'https://agentic-engineering-jobs.com/' }), false);
  assert.equal(agenticjobsAdapter.matches({}), false);
  assert.equal(agenticjobsAdapter.buildEndpoint({ provider: 'agenticjobs' }), FEED_URL);
  const mirror = 'https://agentic-engineering-jobs.com/api/v1/jobs?mirror=1';
  assert.equal(agenticjobsAdapter.buildEndpoint({ agenticjobs: mirror }), mirror);
  assert.equal(agenticjobsAdapter.buildEndpoint({ api: 'https://evil.com/' }), FEED_URL);
  assert.equal(agenticjobsAdapter.buildEndpoint({ agenticjobs: 'http://agentic-engineering-jobs.com/' }), FEED_URL);
});
