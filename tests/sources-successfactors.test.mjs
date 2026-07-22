/**
 * SAP SuccessFactors (RMK) source + adapter — ported from parent career-ops
 * `providers/successfactors.mjs`. Public, zero-auth HTML tile fragment,
 * host-pinned per tenant. CI-isolated: fetchImpl is faked, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSuccessfactors, cityFromSlug, fetchSuccessfactors,
  assertSuccessfactorsUrl, meta, SF_HOST_RE,
  resolveTenantBase,
} from '../server/lib/sources/successfactors.mjs';
import { successfactorsAdapter } from '../server/lib/portals/adapters/successfactors.mjs';

const JOB_BASE = 'https://jobs.zf.com';
const ENDPOINT = 'https://jobs.zf.com/tile-search-results/';

// Small canned fragment: one full tile with a rendered city, one that recovers
// the city from the slug, one title-less (dropped), one url-less (dropped),
// and one with an off-host absolute data-url (dropped by the host pin).
const HTML = `
<ul>
  <li class="job-tile job-id-1001">
    <a class="jobTitle-link" href="#" data-url="/job/Friedrichshafen-Senior-AI-Engineer-BW-12345/1001/">Senior AI Engineer</a>
    <div id="job-1001-section-city-value">Friedrichshafen</div>
  </li>
  <li class="job-tile job-id-1002">
    <a class="jobTitle-link" data-url="/job/Munich-Data-Scientist-BY-67890/1002/">Data Scientist</a>
  </li>
  <li class="job-tile job-id-1003">
    <a class="jobTitle-link" data-url="/job/Berlin-Nobody-99999/1003/"></a>
  </li>
  <li class="job-tile job-id-1004">
    <a class="jobTitle-link" href="#">No URL Here</a>
  </li>
  <li class="job-tile job-id-1005">
    <a class="jobTitle-link" data-url="https://evil.com/job/Somewhere-Hacker-000/1005/">Off Host Role</a>
  </li>
</ul>`;

test('meta + adapter surface: provider-selected + SF-host-detected, host-pinned', () => {
  assert.equal(meta.value, 'successfactors');
  assert.equal(meta.region, 'en');
  assert.equal(meta.label, 'SAP SuccessFactors');

  assert.equal(successfactorsAdapter.id, 'successfactors');
  assert.equal(successfactorsAdapter.label, 'SAP SuccessFactors');
  assert.equal(successfactorsAdapter.fetch, fetchSuccessfactors);

  // matches: explicit provider
  assert.ok(successfactorsAdapter.matches({ provider: 'successfactors' }));
  // matches: literal successfactors / jobs2web host
  assert.ok(successfactorsAdapter.matches({ careers_url: 'https://career5.successfactors.eu/career' }));
  assert.ok(successfactorsAdapter.matches({ api: 'https://foo.jobs2web.com/x' }));
  // no match: branded RMK host without an explicit provider (must be wired)
  assert.ok(!successfactorsAdapter.matches({ careers_url: 'https://jobs.zf.com/' }));
  assert.ok(!successfactorsAdapter.matches({}));

  // buildEndpoint host-pins to the entry origin's tile-search fragment
  // #2099: a path in the configured URL is a brand/tenant prefix and is
  // PRESERVED (pre-#2099 it collapsed to the origin, silently returning the
  // parent brand's postings for multi-brand RMK holdings).
  assert.equal(
    successfactorsAdapter.buildEndpoint({ provider: 'successfactors', careers_url: 'https://jobs.zf.com/some/path' }),
    'https://jobs.zf.com/some/path/tile-search-results/',
  );
  assert.equal(successfactorsAdapter.buildEndpoint({ provider: 'successfactors' }), null);
  assert.equal(successfactorsAdapter.buildEndpoint({ careers_url: 'http://jobs.zf.com/' }), null); // non-https
});

test('SF_HOST_RE only claims literal successfactors/jobs2web hosts', () => {
  assert.ok(SF_HOST_RE.test('career5.successfactors.eu'));
  assert.ok(SF_HOST_RE.test('performancemanager.successfactors.com'));
  assert.ok(SF_HOST_RE.test('foo.jobs2web.com'));
  assert.ok(!SF_HOST_RE.test('jobs.zf.com'));
  assert.ok(!SF_HOST_RE.test('successfactors.evil.com'));
});

test('parseSuccessfactors: tiles → jobs, drops title-less/url-less/off-host', () => {
  const jobs = parseSuccessfactors(HTML, { jobBase: JOB_BASE, fallbackCompany: 'ZF' });
  assert.equal(jobs.length, 2); // 1001 + 1002; 1003 (no title), 1004 (no url), 1005 (off host) dropped

  const [a, b] = jobs;
  assert.equal(a.id, 'successfactors-1001');
  assert.equal(a.title, 'Senior AI Engineer');
  assert.equal(a.company, 'ZF');
  assert.equal(a.url, 'https://jobs.zf.com/job/Friedrichshafen-Senior-AI-Engineer-BW-12345/1001/');
  assert.equal(a.location, 'Friedrichshafen'); // rendered city div
  assert.equal(a.source, 'successfactors');
  assert.equal(a.date, '');
  assert.equal(a.salary, '');
  assert.equal(a.isRemote, false);
  assert.equal(a.workplaceType, '');
  assert.equal(a.relocates, false);
  assert.equal(a.snippet, '');

  assert.equal(b.id, 'successfactors-1002');
  assert.equal(b.title, 'Data Scientist');
  assert.equal(b.location, 'Munich'); // recovered from the slug (no city div)
  assert.equal(b.url, 'https://jobs.zf.com/job/Munich-Data-Scientist-BY-67890/1002/');
});

test('parseSuccessfactors: bad inputs → []', () => {
  assert.deepEqual(parseSuccessfactors('', { jobBase: JOB_BASE }), []);
  assert.deepEqual(parseSuccessfactors(HTML, {}), []); // no jobBase
  assert.deepEqual(parseSuccessfactors(HTML, { jobBase: 'not a url' }), []);
  assert.deepEqual(parseSuccessfactors(null, { jobBase: JOB_BASE }), []);
});

test('cityFromSlug: recovers leading city segment, empty when unresolvable', () => {
  assert.equal(cityFromSlug('/job/Munich-Data-Scientist-BY-67890/1002/', 'Data Scientist'), 'Munich');
  assert.equal(cityFromSlug('/job/San-Jose-Senior-Engineer-000/9/', 'Senior Engineer'), 'San Jose');
  assert.equal(cityFromSlug('/no/job/path/here', 'X'), '');
  assert.equal(cityFromSlug('/job/Senior-Engineer-000/9/', 'Senior Engineer'), ''); // title starts the slug → no city
});

test('assertSuccessfactorsUrl: https + real host, throws off-scheme/hostless', () => {
  assert.equal(assertSuccessfactorsUrl(ENDPOINT), ENDPOINT);
  assert.throws(() => assertSuccessfactorsUrl('http://jobs.zf.com/tile-search-results/'), /HTTPS/);
  assert.throws(() => assertSuccessfactorsUrl('ftp://jobs.zf.com/x'), /HTTPS/);
  assert.throws(() => assertSuccessfactorsUrl('nonsense'), /invalid URL/);
});

const htmlFetch = (byStartrow) => async (url, opts) => {
  assert.equal(opts.redirect, 'error');
  const startrow = Number((url.match(/[?&]startrow=(\d+)/) || [])[1] || 0);
  return { ok: true, status: 200, text: async () => (byStartrow[startrow] ?? '') };
};

test('fetchSuccessfactors: paginates by startrow until an empty page, CI-isolated', async () => {
  // page 0 → the canned fixture (2 usable tiles), page 2 → empty → stop.
  let calls = 0;
  const fetchImpl = (url, opts) => { calls += 1; return htmlFetch({ 0: HTML, 2: '' })(url, opts); };
  const jobs = await fetchSuccessfactors(ENDPOINT, { fetchImpl, company: { name: 'ZF' } });
  assert.equal(calls, 2); // startrow=0 (2 tiles) → startrow=2 (empty) → stop
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.source === 'successfactors'));
  assert.ok(jobs.every((j) => j.company === 'ZF'));
});

test('fetchSuccessfactors: host guard rejects an off-host endpoint before fetch', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, status: 200, text: async () => '' }; };
  await assert.rejects(() => fetchSuccessfactors('http://jobs.zf.com/tile-search-results/', { fetchImpl }), /HTTPS/);
  assert.equal(called, false); // guard fires before any fetch
});

test('resolveTenantBase: multi-brand RMK path preserved; endpoint segments never doubled (#2099)', () => {
  // Single-domain tenant unaffected: base === origin.
  assert.equal(resolveTenantBase({ careers_url: 'https://jobs.zf.com' }), 'https://jobs.zf.com');
  // Brand path survives; trailing /search/ stripped.
  assert.equal(
    resolveTenantBase({ api: 'https://careers.nemetschek.com/Bluebeam/search/' }),
    'https://careers.nemetschek.com/Bluebeam',
  );
  // Brand path without /search/ resolves the same.
  assert.equal(
    resolveTenantBase({ careers_url: 'https://careers.nemetschek.com/Bluebeam/' }),
    'https://careers.nemetschek.com/Bluebeam',
  );
  // An api: pointing straight at the tile endpoint must not double the segment.
  assert.equal(
    successfactorsAdapter.buildEndpoint({ api: 'https://careers.nemetschek.com/Bluebeam/tile-search-results/' }),
    'https://careers.nemetschek.com/Bluebeam/tile-search-results/',
  );
  // Adapter endpoint carries the brand path end-to-end.
  assert.equal(
    successfactorsAdapter.buildEndpoint({ careers_url: 'https://careers.nemetschek.com/Bluebeam/' }),
    'https://careers.nemetschek.com/Bluebeam/tile-search-results/',
  );
  // Unparseable / non-https / empty → null.
  assert.equal(resolveTenantBase({ careers_url: 'not a url' }), null);
  assert.equal(resolveTenantBase({ careers_url: 'http://careers.nemetschek.com/Bluebeam/' }), null);
  assert.equal(resolveTenantBase({}), null);
});
