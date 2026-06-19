/**
 * Tests for the config-driven scanner sources ported from parent career-ops
 * v1.12.0: IBM, Arbeitsagentur, Glints, Jobstreet.
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
import { fetchJobstreet, assertJobstreetUrl, parseJobstreetItem } from '../server/lib/sources/jobstreet.mjs';
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

test('arbeitsagentur: buildLocation appends only non-DE country', () => {
  assert.equal(buildLocation({ ort: 'Berlin', region: 'Berlin', land: 'Deutschland' }), 'Berlin, Berlin');
  assert.equal(buildLocation({ ort: 'Wien', land: 'Österreich' }), 'Wien, Österreich');
});

test('arbeitsagentur: normalizeJob builds detail url + drops invalid', () => {
  assert.equal(normalizeJob({ titel: '', refnr: 'x' }), null);
  const j = normalizeJob({ titel: 'Remote Data Scientist', refnr: '10000-123/456', arbeitgeber: 'ACME' });
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
  const payload = { stellenangebote: [
    { titel: 'ML Engineer', refnr: 'A1', arbeitgeber: 'ACME', arbeitsort: { ort: 'Berlin', land: 'Deutschland' } },
    { titel: 'Data Scientist', refnr: 'A2', arbeitgeber: 'BetaCo' },
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
    assertJobstreetUrl('https://id.jobstreet.com/api/chalice-search/v4/search'),
    'https://id.jobstreet.com/api/chalice-search/v4/search',
  );
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
