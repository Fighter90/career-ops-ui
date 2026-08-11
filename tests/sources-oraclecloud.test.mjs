/**
 * Oracle Recruiting Cloud (ORC) source — CI-isolated tests.
 * Uses a fake fetchImpl (no network, no parent-project dependency).
 * Parent career-ops `tests/providers/oraclecloud.test.mjs` parity.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchOraclecloud,
  parseOraclecloud,
  resolveSite,
  buildApiUrl,
  buildJobUrl,
  assertOraclecloudUrl,
  ORACLE_HOST_RE,
  PAGE_SIZE,
  MAX_PAGES,
} from '../server/lib/sources/oraclecloud.mjs';
import { oraclecloudAdapter } from '../server/lib/portals/adapters/oraclecloud.mjs';

const CAREERS = 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1002/jobs';
const SITE = { host: 'jpmc.fa.oraclecloud.com', lang: 'en', siteNumber: 'CX_1002' };

// Validate derived URLs by their parsed hostname, never by substring-matching
// the whole URL string (CodeQL js/incomplete-url-substring-sanitization).
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return null; } };

// ---------------------------------------------------------------------------
// Fake response helpers
// ---------------------------------------------------------------------------

function makeReq(overrides = {}) {
  return {
    Id: '210577366',
    Title: 'Client Service Associate',
    PrimaryLocation: 'Newark, DE, United States',
    PostedDate: '2026-07-15',
    WorkplaceTypeCode: 'ORA_ON_SITE',
    ShortDescriptionStr: 'Support the Private Bank &amp; clients',
    ...overrides,
  };
}

function makePage(reqs, total, hasMore = false) {
  return { items: [{ TotalJobsCount: total ?? reqs.length, requisitionList: reqs }], hasMore };
}

function fakeFetch(bodyForUrl) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    const body = typeof bodyForUrl === 'function' ? bodyForUrl(url, calls.length) : bodyForUrl;
    return { ok: true, json: async () => body };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// assertOraclecloudUrl / ORACLE_HOST_RE — SSRF guard
// ---------------------------------------------------------------------------

test('assertOraclecloudUrl: accepts base, <region>, and .ocs. host variants', () => {
  assert.equal(assertOraclecloudUrl(CAREERS), CAREERS);
  const region = 'https://oracle.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs';
  assert.equal(assertOraclecloudUrl(region), region);
  const ocs = 'https://acme.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs';
  assert.equal(assertOraclecloudUrl(ocs), ocs);
  // Numbered apex family oraclecloud1.com … oraclecloud99.com (parent #2683).
  const numbered = 'https://tenant.fa.ocs.oraclecloud26.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs';
  assert.equal(assertOraclecloudUrl(numbered), numbered);
});

test('assertOraclecloudUrl: the numbered apex stays a BOUNDED family (no leading zero, ≤2 digits)', () => {
  // oraclecloud100.com (3 digits) and oraclecloud0.com (leading zero) must NOT
  // widen into a wildcard apex — the pin enumerates a finite family only.
  assert.throws(() => assertOraclecloudUrl('https://t.fa.oraclecloud100.com/jobs'), /untrusted hostname/);
  assert.throws(() => assertOraclecloudUrl('https://t.fa.oraclecloud0.com/jobs'), /untrusted hostname/);
});

test('assertOraclecloudUrl: rejects lookalike hosts, plain HTTP, and junk', () => {
  // Host-suffix spoof: trusted fragment inside a longer evil host.
  assert.throws(
    () => assertOraclecloudUrl('https://x.fa.oraclecloud.com.evil.example/hcmUI/CandidateExperience/en/sites/CX_1/jobs'),
    /untrusted hostname/,
  );
  // Path spoof: oracle host in the path, not the host.
  assert.throws(
    () => assertOraclecloudUrl('https://evil.example/x.fa.oraclecloud.com/sites/CX_1/jobs'),
    /untrusted hostname/,
  );
  // Missing the .fa. label entirely.
  assert.throws(() => assertOraclecloudUrl('https://tenant.oraclecloud.com/jobs'), /untrusted hostname/);
  assert.throws(() => assertOraclecloudUrl('http://jpmc.fa.oraclecloud.com/jobs'), /HTTPS/);
  assert.throws(() => assertOraclecloudUrl('not a url'), /invalid URL/);
  assert.ok(!ORACLE_HOST_RE.test('fa.oraclecloud.com')); // no tenant label
});

// ---------------------------------------------------------------------------
// resolveSite
// ---------------------------------------------------------------------------

test('resolveSite: extracts host, lang and the sites/<n> segment; defaults CX_1', () => {
  assert.deepEqual(resolveSite(CAREERS), {
    host: 'jpmc.fa.oraclecloud.com', lang: 'en', siteNumber: 'CX_1002', locationId: null,
  });
  // No /sites/<n>/ in the path → CX_1; lang read after CandidateExperience.
  const bare = resolveSite('https://acme.fa.oraclecloud.com/hcmUI/CandidateExperience/fr/');
  assert.deepEqual(bare, { host: 'acme.fa.oraclecloud.com', lang: 'fr', siteNumber: 'CX_1', locationId: null });
});

test('resolveSite: honors siteNumber/locationId overrides, rejects non-ORC URLs', () => {
  const over = resolveSite(CAREERS, { siteNumber: 'CX_2001', locationId: 300000000123456 });
  assert.equal(over.siteNumber, 'CX_2001');
  assert.equal(over.locationId, '300000000123456');
  assert.equal(resolveSite('https://example.com/careers'), null);
  assert.equal(resolveSite('http://jpmc.fa.oraclecloud.com/x'), null);
  assert.equal(resolveSite(''), null);
  assert.equal(resolveSite(null), null);
});

// ---------------------------------------------------------------------------
// buildApiUrl / buildJobUrl
// ---------------------------------------------------------------------------

test('buildApiUrl: expand + findReqs; finder grammar, limit/offset in both places', () => {
  const url = buildApiUrl({ ...SITE, locationId: '30012' }, 200, 200);
  assert.equal(hostOf(url), 'jpmc.fa.oraclecloud.com');
  assert.equal(new URL(url).pathname, '/hcmRestApi/resources/latest/recruitingCEJobRequisitions');
  assert.ok(url.includes('onlyData=true'));
  assert.ok(url.includes(`expand=${encodeURIComponent('requisitionList.workLocation,requisitionList.secondaryLocations')}`));
  // Finder grammar: a ';' after findReqs, then comma-separated pairs.
  assert.ok(url.includes('finder=findReqs;siteNumber=CX_1002,'));
  assert.ok(!url.includes('findReqs,siteNumber'));
  assert.ok(url.includes('facetsList=LOCATIONS%3B'));
  assert.ok(url.includes('sortBy=POSTING_DATES_DESC'));
  assert.ok(url.includes('locationId=30012'));
  // limit/offset in BOTH the finder and top-level (some tenants honor only one).
  assert.ok(url.includes(',limit=200,') && url.includes(',offset=200'));
  assert.ok(url.includes('&limit=200&offset=200'));
});

test('buildJobUrl: builds the /sites/<site>/job/<Id> posting URL', () => {
  assert.equal(
    buildJobUrl(SITE, '210577366'),
    'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1002/job/210577366',
  );
});

// ---------------------------------------------------------------------------
// parseOraclecloud
// ---------------------------------------------------------------------------

test('parseOraclecloud: maps requisitions to the web-ui job shape', () => {
  const page = makePage([
    makeReq(),
    makeReq({
      Id: '999',
      Title: 'Remote Engineer &amp; Architect',
      PrimaryLocation: undefined,
      PostedDate: undefined,
      WorkplaceTypeCode: 'ORA_REMOTE',
      workLocation: [{ TownOrCity: 'Austin', Region: 'TX', Country: 'United States' }],
      ShortDescriptionStr: undefined,
    }),
  ], 2);
  const { jobs, total, listLen } = parseOraclecloud(page, SITE, 'JPMorgan Chase');
  assert.equal(total, 2);
  assert.equal(listLen, 2);
  assert.equal(jobs.length, 2);

  const [a, b] = jobs;
  assert.equal(a.id, 'oraclecloud-210577366');
  assert.equal(a.title, 'Client Service Associate');
  assert.equal(a.company, 'JPMorgan Chase');
  assert.equal(a.url, 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1002/job/210577366');
  assert.equal(a.location, 'Newark, DE, United States');
  assert.equal(a.workplaceType, 'Onsite');
  assert.equal(a.isRemote, false);
  assert.equal(a.date, '2026-07-15T00:00:00.000Z');
  assert.equal(a.snippet, 'Support the Private Bank & clients'); // entities decoded
  assert.equal(a.source, 'oraclecloud');
  assert.equal(a.salary, '');
  assert.equal(a.relocates, false);

  // Entity decoding of titles + expanded workLocation + remote flag.
  assert.equal(b.title, 'Remote Engineer & Architect');
  assert.equal(b.location, 'Austin, TX, United States');
  assert.equal(b.workplaceType, 'Remote');
  assert.equal(b.isRemote, true);
  assert.equal(b.date, '');
});

test('parseOraclecloud: prefers a same-host ExternalURL, pins off-host ones back to the built URL', () => {
  const ext = 'https://jpmc.fa.oraclecloud.com/some/external/link';
  const page = makePage([
    makeReq({ ExternalURL: ext }),
    makeReq({ Id: '2', ExternalURL: 'https://evil.example/hijack' }),
  ]);
  const { jobs } = parseOraclecloud(page, SITE, 'X');
  assert.equal(jobs[0].url, ext);
  assert.equal(jobs[1].url, buildJobUrl(SITE, '2')); // off-host → built URL
});

test('parseOraclecloud: RequisitionNumber fallback; rows with no resolvable URL dropped', () => {
  const page = makePage([
    { RequisitionNumber: 'R-42', Title: 'Fallback' },
    { Title: 'No Id No URL' },
    makeReq({ Id: '1', Title: 'Keep' }),
  ]);
  const { jobs } = parseOraclecloud(page, SITE, 'X');
  assert.equal(jobs.length, 2);
  assert.ok(jobs[0].url.endsWith('/job/R-42'));
  assert.equal(jobs[1].title, 'Keep');
});

test('parseOraclecloud: epoch-0 and invalid PostedDate are guarded (NaN-safe)', () => {
  const page = makePage([
    makeReq({ Id: '1', PostedDate: '1970-01-01' }), // epoch 0 — must survive
    makeReq({ Id: '2', PostedDate: 'not-a-date' }),
    makeReq({ Id: '3', PostedDate: null }),
  ]);
  const { jobs } = parseOraclecloud(page, SITE, 'X');
  assert.equal(jobs[0].date, '1970-01-01T00:00:00.000Z');
  assert.equal(jobs[1].date, '');
  assert.equal(jobs[2].date, '');
});

test('parseOraclecloud: returns empty for null/{}/{items:null}/non-array bodies (no crash)', () => {
  for (const body of [null, {}, { items: null }, { items: [] }, { items: [{ requisitionList: 'nope' }] }, 'string']) {
    const { jobs, listLen } = parseOraclecloud(body, SITE, 'X');
    assert.equal(jobs.length, 0);
    assert.equal(listLen, 0);
  }
});

// ---------------------------------------------------------------------------
// fetchOraclecloud — headers, SSRF, pagination, caps, fail-soft
// ---------------------------------------------------------------------------

test('fetchOraclecloud: GETs the trusted host with browser UA, Accept json, redirect:error', async () => {
  const fetchImpl = fakeFetch(makePage([makeReq({ Id: '5', Title: 'Solo' })], 1));
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl, company: { name: 'JPMC' } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'JPMC');
  assert.ok(jobs[0].url.endsWith('/job/5'));
  assert.equal(fetchImpl.calls.length, 1);
  const { url, opts } = fetchImpl.calls[0];
  assert.equal(hostOf(url), 'jpmc.fa.oraclecloud.com');
  assert.ok(new URL(url).pathname.startsWith('/hcmRestApi/'));
  assert.equal(opts.redirect, 'error');
  assert.match(opts.headers['User-Agent'], /Mozilla/);
  assert.equal(opts.headers.Accept, 'application/json');
});

test('fetchOraclecloud: rejects a non-ORC endpoint before any network call', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  await assert.rejects(
    () => fetchOraclecloud('https://example.com/careers', { fetchImpl }),
    /untrusted hostname/,
  );
  assert.equal(called, false);
});

test('fetchOraclecloud: paginates by offset and stops on a short page (3 pages → 450)', async () => {
  const fetchImpl = fakeFetch((url) => {
    const offset = parseInt(new URL(url).searchParams.get('offset') || '0', 10);
    const len = offset < 400 ? PAGE_SIZE : 50; // offsets 0/200 full, 400 short
    return makePage(
      Array.from({ length: len }, (_, i) => makeReq({ Id: `p${offset}-${i}`, Title: `Role ${i}` })),
      450,
      true, // hasMore:true even on the last page — length/total drive the stop
    );
  });
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 3);
  assert.equal(jobs.length, 450);
});

test('fetchOraclecloud: ignores unreliable hasMore:false while pages are full (JPMC quirk)', async () => {
  // total 350: page 0 full (200), page 1 short (150) → 2 requests, even though
  // every response claims hasMore:false (parent parity — trusting it would cap
  // the scan at one page).
  const fetchImpl = fakeFetch((url) => {
    const offset = parseInt(new URL(url).searchParams.get('offset') || '0', 10);
    const len = offset === 0 ? PAGE_SIZE : 150;
    return makePage(
      Array.from({ length: len }, (_, i) => makeReq({ Id: `h${offset}-${i}`, Title: `R${i}` })),
      350,
      false,
    );
  });
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, 350);
});

test('fetchOraclecloud: honors max_pages from the entry, hard-capped at MAX_PAGES', async () => {
  const fullPage = () => makePage(
    Array.from({ length: PAGE_SIZE }, (_, i) => makeReq({ Id: `${Math.random()}-${i}` })),
    100000,
    true,
  );
  const capped = fakeFetch(() => fullPage());
  await fetchOraclecloud(CAREERS, { fetchImpl: capped, company: { max_pages: 2 } });
  assert.equal(capped.calls.length, 2);

  const uncapped = fakeFetch(() => fullPage());
  await fetchOraclecloud(CAREERS, { fetchImpl: uncapped, company: { max_pages: 9999 } });
  assert.equal(uncapped.calls.length, MAX_PAGES);
});

test('fetchOraclecloud: first-request failure throws; mid-run blip keeps collected jobs', async () => {
  const failing = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchOraclecloud(CAREERS, { fetchImpl: failing }), /HTTP 503/);

  let call = 0;
  const blippy = async () => {
    call++;
    if (call === 1) {
      return {
        ok: true,
        json: async () => makePage(
          Array.from({ length: PAGE_SIZE }, (_, i) => makeReq({ Id: `q-${i}` })),
          1000,
        ),
      };
    }
    return { ok: false, status: 429 };
  };
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl: blippy });
  assert.equal(jobs.length, PAGE_SIZE);
});

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

test('oraclecloudAdapter: matches provider or ORC host (incl. variants), endpoint host-pinned', () => {
  assert.equal(oraclecloudAdapter.id, 'oraclecloud');
  assert.equal(oraclecloudAdapter.label, 'Oracle Cloud (ORC)');
  assert.ok(oraclecloudAdapter.matches({ provider: 'oraclecloud' }));
  assert.ok(oraclecloudAdapter.matches({ careers_url: CAREERS }));
  assert.ok(oraclecloudAdapter.matches({ careers_url: 'https://oracle.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs' }));
  assert.ok(oraclecloudAdapter.matches({ careers_url: 'https://acme.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs' }));
  assert.ok(!oraclecloudAdapter.matches({ careers_url: 'https://x.fa.oraclecloud.com.evil.example/jobs' }));
  assert.ok(!oraclecloudAdapter.matches({ careers_url: 'https://evil.example/x.fa.oraclecloud.com/jobs' }));
  assert.ok(!oraclecloudAdapter.matches({ careers_url: 'http://jpmc.fa.oraclecloud.com/jobs' }));
  assert.ok(!oraclecloudAdapter.matches(null));

  // Endpoint is the entry's own host-pinned URL; `api:` wins over careers_url.
  assert.equal(oraclecloudAdapter.buildEndpoint({ careers_url: CAREERS }), CAREERS);
  const api = 'https://tenant.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1005/jobs';
  assert.equal(
    oraclecloudAdapter.buildEndpoint({ careers_url: 'https://careers.branded.com', api }),
    api,
  );
  // Explicit provider with an un-pinnable URL → null endpoint (never fetched).
  assert.equal(
    oraclecloudAdapter.buildEndpoint({ provider: 'oraclecloud', careers_url: 'https://careers.branded.com' }),
    null,
  );
});
