/**
 * Tests for the config-driven scanner sources:
 * IBM, Arbeitsagentur, Glints, Jobstreet.
 *
 * These read per-entry config from `opts.company.<provider>` and POST / paginate
 * against public JSON APIs. CI-isolated: HTTP is never hit; a fake fetchImpl is
 * injected and `opts.company` is passed explicitly the same way en-scanner does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchIbm, buildPostFilter, parseIbmResponse } from '../server/lib/sources/ibm.mjs';
import {
  fetchArbeitsagentur, parseArbeitsagenturConfig, buildLocation, normalizeJob,
} from '../server/lib/sources/arbeitsagentur.mjs';
import { fetchGlints, assertGlintsUrl, parseGlintsItem } from '../server/lib/sources/glints.mjs';
import { fetchJobstreet, assertJobstreetUrl, parseJobstreetItem, DEFAULT_API } from '../server/lib/sources/jobstreet.mjs';
import { ibmAdapter } from '../server/lib/portals/adapters/ibm.mjs';
import { arbeitsagenturAdapter } from '../server/lib/portals/adapters/arbeitsagentur.mjs';
import { glintsAdapter } from '../server/lib/portals/adapters/glints.mjs';
import { jobstreetAdapter } from '../server/lib/portals/adapters/jobstreet.mjs';
import { resolveAdapter } from '../server/lib/portals/registry.mjs';

const okJson = (data) => async () => ({ ok: true, json: async () => data });

// ──────────────────────────────── IBM ───────────────────────────────
test('ibm: buildPostFilter sanitizes categories + country, drops junk', () => {
  const pf = buildPostFilter({ country: ' Germany ', categories: ['Software Engineering', '', 42, '  '] });
  assert.deepEqual(pf, {
    bool: {
      must: [
        { bool: { should: [{ term: { field_keyword_08: 'Software Engineering' } }] } },
        { term: { field_keyword_05: 'Germany' } },
      ],
    },
  });
});

test('ibm: buildPostFilter empty config → empty must', () => {
  assert.deepEqual(buildPostFilter({}), { bool: { must: [] } });
});

test('ibm: parseIbmResponse throws on bad shape', () => {
  assert.throws(() => parseIbmResponse({ nope: 1 }), /unexpected API response/);
});

test('ibm: fetchIbm normalizes hits and threads company.ibm config', async () => {
  const page = {
    hits: {
      hits: [
        { _source: { title: 'ML Engineer', url: 'https://ibm.com/careers/1', field_keyword_19: 'Berlin', field_keyword_17: 'Remote' } },
        { _source: { title: 'No URL', field_keyword_19: 'Munich' } }, // dropped — no url
      ],
    },
  };
  const jobs = await fetchIbm(undefined, { fetchImpl: okJson(page), company: { ibm: { country: 'Germany' } } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'ML Engineer');
  assert.equal(jobs[0].company, 'IBM');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].source, 'ibm');
  assert.match(jobs[0].id, /^ibm-/);
});

// ──────────────────────────── Arbeitsagentur ─────────────────────────
test('arbeitsagentur: parseArbeitsagenturConfig clamps + filters', () => {
  const cfg = parseArbeitsagenturConfig({ arbeitsagentur: { keywords: ['ML', '', '  ', 'KI'], umkreis: 9999, days: 0, size: 500 } });
  assert.deepEqual(cfg.keywords, ['ML', 'KI']);
  assert.equal(cfg.umkreis, 1000); // clamped to max
  assert.equal(cfg.days, 1); // clamped to min
  assert.equal(cfg.size, 100); // clamped to API max
});

test('arbeitsagentur: buildLocation (v6 stellenlokationen) drops region enum, appends only non-DE country', () => {
  // v6 nests the address under stellenlokationen[].adresse and its `region` is an
  // uppercase federal-state enum, deliberately dropped rather than joined (#2494).
  assert.equal(buildLocation([{ adresse: { ort: 'Berlin', region: 'BERLIN', land: 'DEUTSCHLAND' } }]), 'Berlin');
  assert.equal(buildLocation([{ adresse: { ort: 'Wien', land: 'Österreich' } }]), 'Wien, Österreich');
});

test('arbeitsagentur: normalizeJob (v6 fields) builds detail url + drops invalid', () => {
  assert.equal(normalizeJob({ stellenangebotsTitel: '', referenznummer: 'x' }), null);
  const j = normalizeJob({ stellenangebotsTitel: 'Remote Data Scientist', referenznummer: '10000-123/456', firma: 'ACME' });
  assert.equal(j.company, 'ACME');
  assert.equal(j.isRemote, true);
  assert.ok(j.url.startsWith('https://www.arbeitsagentur.de/jobsuche/jobdetail/'));
});

test('arbeitsagentur: fetchArbeitsagentur throws when no keywords', async () => {
  await assert.rejects(
    () => fetchArbeitsagentur(undefined, { fetchImpl: okJson({}), company: { name: 'X', arbeitsagentur: {} } }),
    /no arbeitsagentur.keywords/,
  );
});

test('arbeitsagentur: fetchArbeitsagentur dedups by refnr across keywords', async () => {
  const payload = { ergebnisliste: [
    { stellenangebotsTitel: 'ML Engineer', referenznummer: 'A1', firma: 'ACME', stellenlokationen: [{ adresse: { ort: 'Berlin', land: 'Deutschland' } }] },
    { stellenangebotsTitel: 'Data Scientist', referenznummer: 'A2', firma: 'BetaCo' },
  ] };
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl: okJson(payload),
    company: { arbeitsagentur: { keywords: ['ML', 'Data'] } }, // 2 keywords, same payload
  });
  // 2 unique refnrs despite 2 keyword passes
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => !('refnr' in j)), 'refnr stripped from output');
});

// ─────────────────────────────── Glints ─────────────────────────────
test('glints: assertGlintsUrl rejects untrusted host + non-https', () => {
  assert.throws(() => assertGlintsUrl('https://evil.com/api'), /untrusted hostname/);
  assert.throws(() => assertGlintsUrl('http://glints.com/api'), /must use HTTPS/);
  assert.equal(assertGlintsUrl('https://glints.com/api/graphql'), 'https://glints.com/api/graphql');
});

test('glints: parseGlintsItem resolves relative url + rejects bad host', () => {
  const ok = parseGlintsItem({ id: 7, title: 'Remote ML', url: '/opportunities/7', company: { name: 'Gojek' }, location: 'Jakarta' }, 'https://glints.com', '');
  assert.equal(ok.url, 'https://glints.com/opportunities/7');
  assert.equal(ok.isRemote, true);
  assert.equal(ok.source, 'glints');
  assert.equal(parseGlintsItem({ title: 'X', url: 'https://evil.com/x' }, 'https://glints.com', ''), null);
});

test('glints: fetchGlints maps GraphQL data shape', async () => {
  const resp = { data: { opportunities: { data: [
    { id: 1, title: 'Data Scientist', url: 'https://glints.com/j/1', company: { name: 'Tokopedia' }, location: 'Jakarta' },
  ], totalCount: 1 } } };
  const jobs = await fetchGlints(undefined, { fetchImpl: okJson(resp), company: { glints: { searchKeywords: 'ML' } } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Tokopedia');
});

test('glints: fetchGlints throws on bad first-page shape', async () => {
  await assert.rejects(
    () => fetchGlints(undefined, { fetchImpl: okJson({ data: {} }), company: {} }),
    /unexpected API response/,
  );
});

// ────────────────────────────── Jobstreet ───────────────────────────
test('jobstreet: assertJobstreetUrl host allowlist', () => {
  assert.throws(() => assertJobstreetUrl('https://evil.com/api'), /untrusted hostname/);
  assert.equal(
    assertJobstreetUrl('https://id.jobstreet.com/api/jobsearch/v5/search'),
    'https://id.jobstreet.com/api/jobsearch/v5/search',
  );
  // http:// is rejected even on an allowlisted host.
  assert.throws(() => assertJobstreetUrl('http://id.jobstreet.com/api/jobsearch/v5/search'), /must use HTTPS/);
});

test('jobstreet: SEEK Hong Kong (hk.jobsdb.com / HK-Main) is an allowed market', () => {
  assert.equal(
    assertJobstreetUrl('https://hk.jobsdb.com/api/jobsearch/v5/search'),
    'https://hk.jobsdb.com/api/jobsearch/v5/search',
  );
  // A near-miss on the JobsDB brand must NOT open the allowlist up.
  assert.throws(() => assertJobstreetUrl('https://jobsdb.com/api/jobsearch/v5/search'), /untrusted hostname/);
  assert.throws(() => assertJobstreetUrl('https://hk.jobsdb.com.evil.test/x'), /untrusted hostname/);
});

test('jobstreet: DEFAULT_API is the v5 endpoint, not the dead chalice v4', () => {
  assert.equal(DEFAULT_API, 'https://id.jobstreet.com/api/jobsearch/v5/search');
  assert.equal(jobstreetAdapter.buildEndpoint({ provider: 'jobstreet' }), DEFAULT_API);
});

test('jobstreet: an entry still pinning the dead v4 path is queried on v5', async () => {
  const seen = [];
  const fetchImpl = async (url) => { seen.push(String(url)); return { ok: true, json: async () => ({ data: [] }) }; };
  await fetchJobstreet('https://hk.jobsdb.com/api/chalice-search/v4/search', {
    fetchImpl, company: { jobstreet: { siteKey: 'HK-Main', searchKeywords: 'business intelligence' } },
  });
  assert.equal(seen.length, 1);
  const u = new URL(seen[0]);
  assert.equal(u.hostname, 'hk.jobsdb.com');           // market preserved
  assert.equal(u.pathname, '/api/jobsearch/v5/search'); // path upgraded
  assert.equal(u.searchParams.get('siteKey'), 'HK-Main');
  assert.equal(u.searchParams.get('keywords'), 'business intelligence');
  assert.equal(u.searchParams.get('solrFields'), null); // v4-only projection param is gone
});

test('jobstreet: parseJobstreetItem reads the v5 item shape', () => {
  const j = parseJobstreetItem(
    {
      id: '92996157',
      title: 'Facility Engineer',
      advertiser: { description: 'PT YOFC International Indonesia' },
      companyName: 'YOFC International',
      locations: [{ label: 'Karawang, West Java', countryCode: 'ID' }],
      listingDate: '2026-06-29T02:53:00Z',
      salaryLabel: 'IDR 10,000,000',
    },
    'https://hk.jobsdb.com', 'Fallback',
  );
  // URL is derived from the id — v5 ships no absolute job URL.
  assert.equal(j.url, 'https://hk.jobsdb.com/id/job/92996157');
  // advertiser.description wins over the shorter companyName.
  assert.equal(j.company, 'PT YOFC International Indonesia');
  assert.equal(j.location, 'Karawang, West Java');
  assert.equal(j.salary, 'IDR 10,000,000');
  assert.equal(j.date, '2026-06-29T02:53:00.000Z');
  assert.equal(j.source, 'jobstreet');
});

test('jobstreet: a v5 item with no id yields no job (no URL to link to)', () => {
  assert.equal(parseJobstreetItem({ title: 'Ghost' }, 'https://id.jobstreet.com', 'Acme'), null);
});

test('jobstreet: parseJobstreetItem resolves relative url + company fallback chain', () => {
  const j = parseJobstreetItem(
    { id: 99, title: 'Senior DS', jobUrl: '/id/job/99', branding: { companyName: 'Bukalapak' }, location: 'Jakarta', listingDate: '2026-06-15T00:00:00Z' },
    'https://id.jobstreet.com', 'Fallback',
  );
  assert.equal(j.url, 'https://id.jobstreet.com/id/job/99');
  assert.equal(j.company, 'Bukalapak');
  assert.match(j.id, /^jobstreet-/);
  // bad host rejected
  assert.equal(parseJobstreetItem({ title: 'X', jobUrl: 'https://evil.com/x' }, 'https://id.jobstreet.com', ''), null);
});

test('jobstreet: fetchJobstreet maps data[] shape', async () => {
  const resp = { data: [
    { id: 1, title: 'ML Engineer', jobUrl: '/id/job/1', branding: { companyName: 'GoTo' }, location: 'Jakarta' },
  ] };
  const jobs = await fetchJobstreet(undefined, { fetchImpl: okJson(resp), company: { jobstreet: { searchKeywords: 'ML' } } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'GoTo');
});

// ─────────────────────────── adapter contracts ──────────────────────
test('config adapters: match only on explicit provider, return base endpoint', () => {
  for (const [adapter, slug] of [
    [ibmAdapter, 'ibm'],
    [arbeitsagenturAdapter, 'arbeitsagentur'],
    [glintsAdapter, 'glints'],
    [jobstreetAdapter, 'jobstreet'],
  ]) {
    assert.equal(adapter.matches({ provider: slug }), true);
    assert.equal(adapter.matches({ careers_url: 'https://job-boards.greenhouse.io/x' }), false);
    assert.ok(/^https:\/\//.test(adapter.buildEndpoint({ provider: slug })));
    assert.equal(resolveAdapter({ provider: slug }).adapter.id, slug);
  }
});
